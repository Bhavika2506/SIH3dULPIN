"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Map,
  NavigationControl,
  ScaleControl,
  Popup,
  LngLatBounds,
  Marker,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type {
  ParsedBuilding,
  Property2D,
} from "@/src/lib/parser/types";
import { useLanguage } from "@/src/context/LanguageContext";

setWorkerUrl(
  "/maplibre/maplibre-gl-worker.mjs"
);

/* ============================================================
   TYPES
   ============================================================ */

interface SearchResultItem {
  id: string;
  type: "PROPERTY" | "BUILDING";
  title: string;
  subtitle: string;
  landUse?: string;
  area?: number;
  ulpin?: string;
  unitNumber?: string;
  buildingName: string;
  building: ParsedBuilding;
  unit?: Property2D;
  coordinates: [number, number];
}

interface RealWorldMapViewerProps {
  /**
   * Single-building mode.
   */
  building?: ParsedBuilding | null;

  /**
   * Multi-building mode.
   *
   * Used by Public Viewer.
   */
  buildings?: ParsedBuilding[];

  approvalStatus?:
    | "PENDING_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | string;

  onPropertySelect?: (
    property: Property2D
  ) => void;

  onPropertyNavigate?: (
    property: Property2D
  ) => void;

  onBuildingSelect?: (
    building: ParsedBuilding
  ) => void;
}

type PointLike =
  | Point2D
  | [number, number]
  | {
      x?: number;
      y?: number;
      lng?: number;
      lat?: number;
    };

interface Point2D {
  x: number;
  y: number;
}

/* ============================================================
   IDS
   ============================================================ */

const SOURCE_ID =
  "ulpin-cadastral-source";

const FOOTPRINT_LAYER =
  "ulpin-cadastral-footprints";

const EXTRUSION_LAYER =
  "ulpin-cadastral-extrusions";

const OUTLINE_LAYER =
  "ulpin-cadastral-outlines";

// Satellite imagery is rendered as a raster basemap while the existing
// OpenFreeMap vector style stays underneath/above it for map labels.
const SATELLITE_SOURCE_ID =
  "ulpin-satellite-source";

const SATELLITE_LAYER_ID =
  "ulpin-satellite-layer";

const MAPTILER_KEY =
  process.env.NEXT_PUBLIC_MAPTILER_KEY;

/* ============================================================
   HELPERS
   ============================================================ */

/**
 * Parse a possible JSON string safely.
 */
function parseMaybeJSON<T>(
  value: unknown,
  fallback: T
): T {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  if (
    typeof value !== "string"
  ) {
    return value as T;
  }

  try {
    return JSON.parse(
      value
    ) as T;
  } catch {
    return fallback;
  }
}

/**
 * Extract x/y from different possible point shapes.
 */
function getXY(
  point: PointLike
): [number, number] {
  if (
    Array.isArray(point)
  ) {
    return [
      Number(point[0]) || 0,
      Number(point[1]) || 0,
    ];
  }

  const obj = point as {
    x?: number;
    y?: number;
    lng?: number;
    lat?: number;
  };

  return [
    Number(
      obj.x ??
        obj.lng ??
        0
    ) || 0,

    Number(
      obj.y ??
        obj.lat ??
        0
    ) || 0,
  ];
}

/**
 * A local floor-plan coordinate can easily be:
 *
 * [6,0]
 * [8,27]
 *
 * so merely checking the valid longitude/latitude range
 * is NOT enough.
 */
function isProbablyGeographic(
  points: PointLike[],
  anchorLng: number,
  anchorLat: number
) {
  if (
    !points.length
  ) {
    return false;
  }

  /**
   * Geographic polygon should be near the anchor.
   */
  return points.every(
    (point) => {
      const [x, y] =
        getXY(point);

      return (
        x >= -180 &&
        x <= 180 &&
        y >= -90 &&
        y <= 90 &&
        Math.abs(
          x - anchorLng
        ) < 0.05 &&
        Math.abs(
          y - anchorLat
        ) < 0.05
      );
    }
  );
}

/**
 * Convert local metre offsets into WGS84.
 */
function localToLngLat(
  x: number,
  y: number,
  anchorLng: number,
  anchorLat: number
): [number, number] {
  const metersPerDegreeLat =
    111320;

  const metersPerDegreeLng =
    111320 *
    Math.cos(
      (anchorLat *
        Math.PI) /
        180
    );

  return [
    anchorLng +
      x /
        metersPerDegreeLng,

    anchorLat +
      y /
        metersPerDegreeLat,
  ];
}

/**
 * Normalize a DB building.
 *
 * Handles:
 * - floors as array
 * - floors as JSON string
 * - units as array
 * - units as JSON string
 * - polygon as JSON string
 * - latitude / longitude at different nesting levels
 */
function normalizeBuilding(
  input: any
): ParsedBuilding | null {
  if (!input) {
    return null;
  }

  const latitude = Number(
    input?.georeference
      ?.latitude ??
      input?.latitude ??
      input?.lat
  );

  const longitude = Number(
    input?.georeference
      ?.longitude ??
      input?.longitude ??
      input?.lng
  );

  const hasCoordinates =
    Number.isFinite(
      latitude
    ) &&
    Number.isFinite(
      longitude
    ) &&
    Math.abs(latitude) <=
      90 &&
    Math.abs(longitude) <=
      180;

  let floors =
    parseMaybeJSON<any[]>(
      input?.floors,
      []
    );

  if (
    !Array.isArray(
      floors
    )
  ) {
    floors = [];
  }

  /**
   * Some records may store a direct `units`
   * collection rather than nested floors.
   */
  if (
    floors.length === 0 &&
    input?.units
  ) {
    const directUnits =
      parseMaybeJSON<any[]>(
        input.units,
        []
      );

    if (
      Array.isArray(
        directUnits
      ) &&
      directUnits.length
    ) {
      floors = [
        {
          floorNumber: 0,
          elevation: 0,
          height: 3.2,
          units: directUnits,
        },
      ];
    }
  }

  /**
   * Some database serializers wrap the data.
   */
  if (
    floors.length === 0 &&
    input?.data
  ) {
    const data =
      parseMaybeJSON<any>(
        input.data,
        null
      );

    if (
      data?.floors
    ) {
      floors =
        parseMaybeJSON<any[]>(
          data.floors,
          []
        );
    }
  }

  return {
    id: String(
      input?.id ??
        `BUILDING-${Date.now()}-${Math.random()}`
    ),

    name:
      input?.name ??
      input?.buildingName ??
      input?.title ??
      "Cadastral Building",

    ...(hasCoordinates
      ? {
          georeference: {
            latitude,
            longitude,
          },
        }
      : {}),

    floors: floors.map(
      (
        floor: any,
        floorIndex: number
      ) => {
        const parsedUnits =
          parseMaybeJSON<any[]>(
            floor?.units,
            []
          );

        const units =
          Array.isArray(
            parsedUnits
          )
            ? parsedUnits
            : [];

        return {
          floorNumber:
            Number(
              floor?.floorNumber ??
                floor?.level ??
                floorIndex
            ) || 0,

          elevation:
            Number(
              floor?.elevation ??
                floor?.elevationMeters ??
                floorIndex * 3.2
            ) || 0,

          height:
            Number(
              floor?.height ??
                floor?.heightMeters ??
                3.2
            ) || 3.2,

          units: units.map(
            (
              unit: any,
              unitIndex: number
            ) => {
              let polygon =
                parseMaybeJSON<
                  any[]
                >(
                  unit?.polygon ??
                    unit?.geometry
                      ?.coordinates?.[0],
                  []
                );

              /**
               * Normalize GeoJSON geometry.
               */
              if (
                unit?.geometry
                  ?.type ===
                  "Polygon"
              ) {
                polygon =
                  unit
                    .geometry
                    .coordinates?.[0] ??
                  polygon;
              }

              return {
                id: String(
                  unit?.id ??
                    `UNIT-${floorIndex}-${unitIndex}`
                ),

                unitNumber: String(
                  unit?.unitNumber ??
                    unit?.unit ??
                    unit?.name ??
                    unit?.id ??
                    `UNIT-${unitIndex + 1}`
                ),

                floorNumber:
                  Number(
                    floor?.floorNumber ??
                      floor?.level ??
                      floorIndex
                  ) || 0,

                area:
                  Number(
                    unit?.area ??
                      unit?.areaSqm ??
                      unit?.areaMeters
                  ) || 0,

                polygon:
                  Array.isArray(
                    polygon
                  )
                    ? polygon
                    : [],

                ulpin:
                  unit?.ulpin ??
                  unit?.ULPIN ??
                  undefined,

                spaceType:
                  unit?.spaceType ??
                  unit?.category ??
                  "RESIDENTIAL",

                fillColor:
                  unit?.fillColor ??
                  unit?.color ??
                  unit?.properties?.fillColor ??
                  unit?.properties?.color ??
                  undefined,
              };
            }
          ),
        };
      }
    ),
  };
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function RealWorldMapViewer({
  building,
  buildings = [],
  approvalStatus,
  onPropertySelect,
  onPropertyNavigate,
  onBuildingSelect,
}: RealWorldMapViewerProps) {
  const { t } = useLanguage();

  const containerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const mapRef =
    useRef<Map | null>(
      null
    );

  const minimapContainerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const minimapRef =
    useRef<Map | null>(
      null
    );

  const minimapCenterMarkerRef =
    useRef<Marker | null>(
      null
    );

  const markerRefs =
    useRef<Marker[]>([]);

  const [mapReady, setMapReady] =
    useState(false);

  const [is3D, setIs3D] =
    useState(true);

  const [showParcels, setShowParcels] =
    useState(true);

  const [rotating, setRotating] =
    useState(false);

  const [basemapMode, setBasemapMode] =
    useState<"satellite" | "street">("satellite");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [isSearchDropdownOpen, setIsSearchDropdownOpen] =
    useState(false);

  const [selectedUnitDetails, setSelectedUnitDetails] =
    useState<Property2D | null>(null);

  const [selectedBuildingDetails, setSelectedBuildingDetails] =
    useState<ParsedBuilding | null>(null);

  const [activeSelectedFeatureId, setActiveSelectedFeatureId] =
    useState<string | null>(null);

  /**
   * Normalize incoming records.
   */
  const normalizedBuildings =
    useMemo(() => {
      const input =
        buildings.length > 0
          ? buildings
          : building
            ? [building]
            : [];

      return input
        .map(
          normalizeBuilding
        )
        .filter(
          (
            item
          ): item is ParsedBuilding =>
            item !== null
        );
    }, [
      buildings,
      building,
    ]);

  /**
   * Buildings with coordinates.
   */
  const mapBuildings =
    useMemo(() => {
      return normalizedBuildings.filter(
        (item) =>
          item.georeference &&
          Number.isFinite(
            item.georeference
              .latitude
          ) &&
          Number.isFinite(
            item.georeference
              .longitude
          )
      );
    }, [
      normalizedBuildings,
    ]);

  /**
   * Calculate public search matches across buildings and property units.
   */
  const searchResults = useMemo<SearchResultItem[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    const items: SearchResultItem[] = [];

    for (const b of mapBuildings) {
      const anchor = b.georeference;
      if (!anchor) continue;

      // Building name or ID match
      const bNameMatch = b.name?.toLowerCase().includes(query);
      const bIdMatch = b.id.toLowerCase().includes(query);

      if (bNameMatch || bIdMatch) {
        items.push({
          id: `bld-${b.id}`,
          type: "BUILDING",
          title: b.name || "Cadastral Building",
          subtitle: `${b.floors?.length || 0} Levels • Verified Cadastre`,
          buildingName: b.name || "Cadastral Building",
          building: b,
          coordinates: [anchor.longitude, anchor.latitude],
        });
      }

      // Units match across floors
      for (const floor of b.floors ?? []) {
        for (const unit of floor.units ?? []) {
          const uUlpinMatch = unit.ulpin?.toLowerCase().includes(query);
          const uNumMatch = unit.unitNumber.toLowerCase().includes(query);
          const uSpaceMatch = unit.spaceType?.toLowerCase().includes(query);
          const uIdMatch = unit.id.toLowerCase().includes(query);

          if (uUlpinMatch || uNumMatch || uSpaceMatch || uIdMatch) {
            let centerLng = anchor.longitude;
            let centerLat = anchor.latitude;

            const rawPoly = Array.isArray(unit.polygon) ? unit.polygon : [];
            if (rawPoly.length >= 3) {
              const geographic = isProbablyGeographic(
                rawPoly as PointLike[],
                anchor.longitude,
                anchor.latitude
              );

              let sumX = 0;
              let sumY = 0;
              rawPoly.forEach((pt) => {
                const [x, y] = getXY(pt as PointLike);
                sumX += x;
                sumY += y;
              });
              const avgX = sumX / rawPoly.length;
              const avgY = sumY / rawPoly.length;

              if (geographic) {
                centerLng = avgX;
                centerLat = avgY;
              } else {
                const [lng, lat] = localToLngLat(
                  avgX,
                  avgY,
                  anchor.longitude,
                  anchor.latitude
                );
                centerLng = lng;
                centerLat = lat;
              }
            }

            items.push({
              id: `${b.id}-${unit.id}`,
              type: "PROPERTY",
              title: unit.ulpin || `Survey / Unit ${unit.unitNumber}`,
              subtitle: `${b.name} • Floor ${floor.floorNumber}${unit.spaceType ? ` • ${unit.spaceType}` : ""}`,
              landUse: unit.spaceType,
              area: unit.area,
              ulpin: unit.ulpin,
              unitNumber: unit.unitNumber,
              buildingName: b.name || "Cadastral Building",
              building: b,
              unit: unit,
              coordinates: [centerLng, centerLat],
            });
          }
        }
      }
    }

    return items;
  }, [mapBuildings, searchQuery]);

  /**
   * Handle selecting a property or building result from search dropdown.
   */
  const handleSelectSearchResult = (result: SearchResultItem) => {
    setIsSearchDropdownOpen(false);
    const map = mapRef.current;

    if (result.type === "PROPERTY" && result.unit) {
      setSelectedUnitDetails(result.unit);
      setSelectedBuildingDetails(result.building);
      onPropertySelect?.(result.unit);

      const featureId = `${result.building.id}-${result.unit.id}`;
      if (map && map.getSource(SOURCE_ID)) {
        if (activeSelectedFeatureId) {
          map.setFeatureState(
            { source: SOURCE_ID, id: activeSelectedFeatureId },
            { selected: false }
          );
        }
        map.setFeatureState(
          { source: SOURCE_ID, id: featureId },
          { selected: true }
        );
        setActiveSelectedFeatureId(featureId);
      }

      if (map) {
        map.flyTo({
          center: result.coordinates,
          zoom: 18.5,
          pitch: is3D ? 55 : 0,
          duration: 900,
        });
      }
    } else if (result.type === "BUILDING") {
      setSelectedUnitDetails(null);
      setSelectedBuildingDetails(result.building);
      onBuildingSelect?.(result.building);

      if (map) {
        map.flyTo({
          center: result.coordinates,
          zoom: 17,
          pitch: is3D ? 50 : 0,
          duration: 900,
        });
      }
    }
  };

  /**
   * Clear active selection and remove map highlights.
   */
  const handleClearSelection = () => {
    setSelectedUnitDetails(null);
    setSelectedBuildingDetails(null);
    const map = mapRef.current;
    if (map && map.getSource(SOURCE_ID) && activeSelectedFeatureId) {
      map.setFeatureState(
        { source: SOURCE_ID, id: activeSelectedFeatureId },
        { selected: false }
      );
    }
    setActiveSelectedFeatureId(null);
  };

  const multiBuildingMode =
    buildings.length > 0;

  /**
   * ----------------------------------------------------------
   * CREATE GEOJSON
   * ----------------------------------------------------------
   */
  const createGeoJSON =
    () => {
      const features: any[] =
        [];

      for (const currentBuilding of mapBuildings) {
        const anchor =
          currentBuilding.georeference!;

        for (const floor of
          currentBuilding.floors ??
          []) {
          for (const unit of
            floor.units ??
            []) {
            const rawPolygon =
              Array.isArray(
                unit.polygon
              )
                ? unit.polygon
                : [];

            if (
              rawPolygon.length <
              3
            ) {
              continue;
            }

            const geographic =
              isProbablyGeographic(
                rawPolygon as PointLike[],
                anchor.longitude,
                anchor.latitude
              );

            const geoPolygon =
              rawPolygon.map(
                (point) => {
                  const [
                    x,
                    y,
                  ] =
                    getXY(
                      point as PointLike
                    );

                  return geographic
                    ? [x, y]
                    : localToLngLat(
                        x,
                        y,
                        anchor.longitude,
                        anchor.latitude
                      );
                }
              );

            const first =
              geoPolygon[0];

            const last =
              geoPolygon[
                geoPolygon.length -
                  1
              ];

            if (
              first &&
              last &&
              (first[0] !==
                last[0] ||
                first[1] !==
                  last[1])
            ) {
              geoPolygon.push([
                first[0],
                first[1],
              ]);
            }

            if (
              geoPolygon.length <
              4
            ) {
              continue;
            }

            const space =
              `${unit.spaceType ?? ""} ${unit.unitNumber ?? ""}`.toLowerCase();

            /*
             * IMPORTANT:
             * The C-block GeoJSON currently contains fillColor="#428AFE"
             * on every unit. If custom fillColor is checked first, MapLibre
             * receives the same blue value for every feature and the map
             * becomes entirely blue.
             *
             * Resolve the semantic/unit color FIRST. A custom color is only
             * honored when the source explicitly marks it as intentional.
             * This keeps the map colors consistent with the volumetric view.
             */
            const semanticColor =
              space.includes("stair") ||
              space.includes("staircase")
                ? "#f97316"       // Orange
                : space.includes("lift") ||
                  space.includes("elevator")
                  ? "#06b6d4"     // Cyan
                  : space.includes("corridor") ||
                    space.includes("passage")
                    ? "#a855f7"   // Purple
                    : space.includes("toilet") ||
                      space.includes("restroom") ||
                      space.includes("utility") ||
                      space.includes("w/c")
                      ? "#ec4899" // Pink
                      : space.includes("lab")
                        ? "#3b82f6" // Blue
                        : space.includes("office") ||
                          space.includes("cell")
                          ? "#10b981" // Emerald
                          : space.includes("hall") ||
                            space.includes("canteen")
                            ? "#eab308" // Amber
                            : "#3b82f6"; // Standard Unit Blue

            const explicitColor =
              (unit as any).mapFillColor ??
              (unit as any).customFillColor ??
              (unit as any).properties?.mapFillColor ??
              (unit as any).properties?.customFillColor;

            const fillColor =
              typeof explicitColor === "string" && explicitColor.trim()
                ? explicitColor
                : semanticColor;

            const base =
              Number(
                floor.elevation
              ) || 0;

            const height =
              base +
              (Number(
                floor.height
              ) || 3.2);

            features.push({
              type:
                "Feature",

              id:
                `${currentBuilding.id}-${unit.id}`,

              properties: {
                buildingId:
                  currentBuilding.id,

                buildingName:
                  currentBuilding.name ??
                  "Cadastral Building",

                unitId:
                  unit.id,

                unitNumber:
                  unit.unitNumber,

                floorNumber:
                  floor.floorNumber,

                area:
                  unit.area,

                ulpin:
                  unit.ulpin ??
                  "",

                spaceType:
                  unit.spaceType ??
                  "RESIDENTIAL",

                base,

                height,

                fillColor,
                renderColor: fillColor,
                mapFillColor: fillColor,
              },

              geometry: {
                type:
                  "Polygon",

                coordinates: [
                  geoPolygon,
                ],
              },
            });
          }
        }
      }

      return {
        type:
          "FeatureCollection" as const,

        features,
      };
    };

  /**
   * ----------------------------------------------------------
   * FIT ALL BUILDINGS
   * ----------------------------------------------------------
   */
  const fitAllBuildings =
    () => {
      const map =
        mapRef.current;

      if (
        !map ||
        mapBuildings.length ===
          0
      ) {
        return;
      }

      const bounds =
        new LngLatBounds();

      for (const item of mapBuildings) {
        const anchor =
          item.georeference!;

        bounds.extend([
          anchor.longitude,
          anchor.latitude,
        ]);

        for (const floor of
          item.floors ??
          []) {
          for (const unit of
            floor.units ??
            []) {
            const polygon =
              Array.isArray(
                unit.polygon
              )
                ? unit.polygon
                : [];

            if (
              polygon.length <
              3
            ) {
              continue;
            }

            const geographic =
              isProbablyGeographic(
                polygon as PointLike[],
                anchor.longitude,
                anchor.latitude
              );

            for (const point of polygon) {
              const [
                x,
                y,
              ] =
                getXY(
                  point as PointLike
                );

              const coordinate =
                geographic
                  ? [x, y]
                  : localToLngLat(
                      x,
                      y,
                      anchor.longitude,
                      anchor.latitude
                    );

              bounds.extend(
                coordinate as [
                  number,
                  number
                ]
              );
            }
          }
        }
      }

      if (
        !bounds.isEmpty()
      ) {
        map.fitBounds(
          bounds,
          {
            padding:
              multiBuildingMode
                ? {
                    top: 120,
                    right: 180,
                    bottom: 160,
                    left: 180,
                  }
                : {
                    top: 120,
                    right: 220,
                    bottom: 180,
                    left: 220,
                  },

            maxZoom:
              multiBuildingMode
                ? 16
                : 18,

            pitch:
              is3D
                ? multiBuildingMode
                  ? 45
                  : 55
                : 0,

            duration:
              700,
          }
        );
      }
    };

  /**
   * ----------------------------------------------------------
   * DEFAULT CITY OVERVIEW CENTER (STATIC MINIMAP)
   * ----------------------------------------------------------
   */
  const defaultCityCenter = useMemo<[number, number]>(() => {
    if (mapBuildings.length > 0 && mapBuildings[0].georeference) {
      return [
        mapBuildings[0].georeference.longitude,
        mapBuildings[0].georeference.latitude,
      ];
    }
    return [73.8567, 18.5204]; // Pune City Overview
  }, [mapBuildings]);

  /**
   * ----------------------------------------------------------
   * INITIALIZE STATIC MINIMAP
   * ----------------------------------------------------------
   */
  useEffect(() => {
    if (!minimapContainerRef.current) return;
    if (minimapRef.current) return;

    const miniMap = new Map({
      container: minimapContainerRef.current,
      style: "https://tiles.openfreemap.org/styles/bright",
      center: defaultCityCenter,
      zoom: 11,
      pitch: 0,
      bearing: 0,
      interactive: false,
      attributionControl: false,
    });

    minimapRef.current = miniMap;

    const indicatorEl = document.createElement("div");
    indicatorEl.style.width = "12px";
    indicatorEl.style.height = "12px";
    indicatorEl.style.borderRadius = "9999px";
    indicatorEl.style.backgroundColor = "#2563eb";
    indicatorEl.style.border = "2px solid #ffffff";
    indicatorEl.style.boxShadow = "0 0 10px rgba(37,99,235,0.8)";

    const marker = new Marker({
      element: indicatorEl,
      anchor: "center",
    })
      .setLngLat(defaultCityCenter)
      .addTo(miniMap);

    minimapCenterMarkerRef.current = marker;

    miniMap.on("load", () => {
      miniMap.resize();
    });

    return () => {
      marker.remove();
      miniMap.remove();
      minimapRef.current = null;
      minimapCenterMarkerRef.current = null;
    };
  }, [defaultCityCenter]);

  /**
   * Update main map center indicator on static minimap without moving minimap viewport
   */
  useEffect(() => {
    const mainMap = mapRef.current;
    if (!mainMap || !mapReady) return;

    const handleMainMapMove = () => {
      if (minimapCenterMarkerRef.current) {
        const center = mainMap.getCenter();
        minimapCenterMarkerRef.current.setLngLat([center.lng, center.lat]);
      }
    };

    mainMap.on("move", handleMainMapMove);
    return () => {
      mainMap.off("move", handleMainMapMove);
    };
  }, [mapReady]);

  /**
   * ----------------------------------------------------------
   * INITIALIZE MAIN MAP
   * ----------------------------------------------------------
   */
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    if (mapRef.current) {
      return;
    }

    const anchorLng =
      mapBuildings.length > 0
        ? mapBuildings[0].georeference!.longitude
        : 73.8567;

    const anchorLat =
      mapBuildings.length > 0
        ? mapBuildings[0].georeference!.latitude
        : 18.5204;

    const map = new Map({
      container: containerRef.current,

      style: "https://tiles.openfreemap.org/styles/bright",

      center: [anchorLng, anchorLat],

      zoom: mapBuildings.length > 0 ? (multiBuildingMode ? 13 : 16) : 12,

      minZoom: 3,

      maxZoom: 22,

      pitch: mapBuildings.length > 0 ? (multiBuildingMode ? 42 : 55) : 30,

      bearing: 0,
    });

    mapRef.current =
      map;

    map.addControl(
      new NavigationControl({
        showCompass: true,
        showZoom: false,
        visualizePitch:
          true,
      }),
      "top-right"
    );

    map.addControl(
      new ScaleControl({
        maxWidth: 140,
        unit: "metric",
      }),
      "bottom-left"
    );

    map.on(
      "load",
      () => {
        if (!map.getSource(SATELLITE_SOURCE_ID)) {
          const satelliteSource = MAPTILER_KEY
            ? {
                type: "raster" as const,
                url: `https://api.maptiler.com/tiles/satellite-v4/tiles.json?key=${MAPTILER_KEY}`,
              }
            : {
                type: "raster" as const,
                tiles: [
                  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                ],
                tileSize: 256,
                attribution:
                  "Esri, Maxar, Earthstar Geographics, and the GIS User Community",
              };

          map.addSource(
            SATELLITE_SOURCE_ID,
            satelliteSource
          );

          const firstDrawableLayer =
            map
              .getStyle()
              .layers?.find(
                (layer) => layer.type !== "background"
              )?.id;

          map.addLayer(
            {
              id: SATELLITE_LAYER_ID,
              type: "raster",
              source: SATELLITE_SOURCE_ID,
              minzoom: 0,
              maxzoom: 22,
              layout: {
                visibility:
                  basemapMode === "satellite"
                    ? "visible"
                    : "none",
              },
              paint: {
                "raster-opacity": 1,
                "raster-fade-duration": 0,
              },
            },
            firstDrawableLayer
          );
        }

        setMapReady(true);

        window.setTimeout(
          () => {
            map.resize();
          },
          200
        );
      }
    );

    return () => {
      markerRefs.current.forEach(
        (marker) =>
          marker.remove()
      );

      markerRefs.current =
        [];

      map.remove();

      mapRef.current =
        null;

      setMapReady(false);
    };
  }, [
    mapBuildings.length,
    mapBuildings[0]?.id,
    mapBuildings[0]
      ?.georeference
      ?.latitude,
    mapBuildings[0]
      ?.georeference
      ?.longitude,
    multiBuildingMode,
  ]);

  /**
   * ----------------------------------------------------------
   * BASEMAP VISIBILITY
   * ----------------------------------------------------------
   */
  useEffect(() => {
    const map = mapRef.current;

    if (
      !map ||
      !mapReady ||
      !map.getLayer(SATELLITE_LAYER_ID)
    ) {
      return;
    }

    map.setLayoutProperty(
      SATELLITE_LAYER_ID,
      "visibility",
      basemapMode === "satellite"
        ? "visible"
        : "none"
    );
  }, [
    basemapMode,
    mapReady,
  ]);

  /**
   * ----------------------------------------------------------
   * SINGLE BUILDING BOUNDS
   * ----------------------------------------------------------
   */
  const getSingleBuildingBounds = (
    target: ParsedBuilding
  ) => {
    if (
      !target.georeference
    ) {
      return null;
    }

    const anchor =
      target.georeference;

    const bounds =
      new LngLatBounds();

    bounds.extend([
      anchor.longitude,
      anchor.latitude,
    ]);

    for (const floor of
      target.floors ??
      []) {
      for (const unit of
        floor.units ??
        []) {
        const polygon =
          Array.isArray(
            unit.polygon
          )
            ? unit.polygon
            : [];

        if (
          polygon.length <
          3
        ) {
          continue;
        }

        const geographic =
          isProbablyGeographic(
            polygon as PointLike[],
            anchor.longitude,
            anchor.latitude
          );

        for (const point of polygon) {
          const [
            x,
            y,
          ] =
            getXY(
              point as PointLike
            );

          const coordinate =
            geographic
              ? [x, y]
              : localToLngLat(
                  x,
                  y,
                  anchor.longitude,
                  anchor.latitude
                );

          bounds.extend(
            coordinate as [
              number,
              number
            ]
          );
        }
      }
    }

    return bounds;
  };

  /**
   * ----------------------------------------------------------
   * ADD BUILDING MARKERS
   * ----------------------------------------------------------
   */
  useEffect(() => {
    const map =
      mapRef.current;

    if (
      !map ||
      !mapReady
    ) {
      return;
    }

    markerRefs.current.forEach(
      (marker) =>
        marker.remove()
    );

    markerRefs.current =
      [];

    for (const currentBuilding of mapBuildings) {
      const anchor =
        currentBuilding.georeference;

      if (!anchor) {
        continue;
      }

      const element =
        document.createElement(
          "button"
        );

      element.type =
        "button";

      element.setAttribute(
        "aria-label",
        `Open ${currentBuilding.name ?? "building"}`
      );

      element.style.width =
        multiBuildingMode
          ? "42px"
          : "34px";

      element.style.height =
        multiBuildingMode
          ? "42px"
          : "34px";

      element.style.padding =
        "0";

      element.style.border =
        "2px solid #ffffff";

      element.style.borderRadius =
        "9px";

      element.style.background =
        "linear-gradient(135deg, #2563eb, #1d4ed8)";

      element.style.boxShadow =
        "0 5px 18px rgba(37,99,235,0.45)";

      element.style.cursor =
        "pointer";

      element.style.display =
        "flex";

      element.style.alignItems =
        "center";

      element.style.justifyContent =
        "center";

      element.style.color =
        "#ffffff";

      element.style.fontSize =
        multiBuildingMode
          ? "19px"
          : "15px";

      element.style.fontWeight =
        "800";

      element.style.lineHeight =
        "1";

      element.innerHTML =
        "▦";

      element.addEventListener(
        "mouseenter",
        () => {
          element.style.transform =
            "scale(1.12)";
        }
      );

      element.addEventListener(
        "mouseleave",
        () => {
          element.style.transform =
            "scale(1)";
        }
      );

      element.addEventListener(
        "click",
        () => {
          if (
            multiBuildingMode
          ) {
            onBuildingSelect?.(
              currentBuilding
            );

            const bounds =
              getSingleBuildingBounds(
                currentBuilding
              );

            if (
              bounds
            ) {
              map.fitBounds(
                bounds,
                {
                  padding: {
                    top: 170,
                    right: 240,
                    bottom: 220,
                    left: 240,
                  },

                  maxZoom:
                    18,

                  pitch:
                    55,

                  duration:
                    800,
                }
              );
            }

            return;
          }
        }
      );

      const marker =
        new Marker({
          element,
          anchor:
            "center",
        })
          .setLngLat([
            anchor.longitude,
            anchor.latitude,
          ])
          .addTo(map);

      const popup =
        new Popup({
          offset: 24,
          closeButton:
            true,
          closeOnClick:
            false,
          maxWidth:
            "300px",
        }).setHTML(
          `
            <div
              style="
                font-family:system-ui,sans-serif;
                color:#0f172a;
                padding:5px;
              "
            >
              <div
                style="
                  font-size:15px;
                  font-weight:800;
                  margin-bottom:6px;
                "
              >
                ${
                  currentBuilding.name ??
                  "Cadastral Building"
                }
              </div>

              <div
                style="
                  font-size:11px;
                  color:#64748b;
                  line-height:1.7;
                "
              >
                <div>
                  📍 ${
                    anchor.latitude.toFixed(
                      6
                    )
                  }, ${
                    anchor.longitude.toFixed(
                      6
                    )
                  }
                </div>

                <div>
                  Floors: ${
                    currentBuilding.floors
                      ?.length ??
                    0
                  }
                </div>
              </div>

              ${
                multiBuildingMode
                  ? `
                    <div
                      style="
                        margin-top:8px;
                        color:#2563eb;
                        font-size:11px;
                        font-weight:800;
                      "
                    >
                      Click structure to explore →
                    </div>
                  `
                  : ""
              }
            </div>
          `
        );

      marker.setPopup(
        popup
      );

      markerRefs.current.push(
        marker
      );
    }
  }, [
    mapReady,
    mapBuildings,
    multiBuildingMode,
    onBuildingSelect,
  ]);

  /**
   * ----------------------------------------------------------
   * CADASTRAL POLYGON LAYERS
   * ----------------------------------------------------------
   */
  useEffect(() => {
    const map =
      mapRef.current;

    if (
      !map ||
      !mapReady
    ) {
      return;
    }

    if (
      map.getLayer(
        OUTLINE_LAYER
      )
    ) {
      map.removeLayer(
        OUTLINE_LAYER
      );
    }

    if (
      map.getLayer(
        EXTRUSION_LAYER
      )
    ) {
      map.removeLayer(
        EXTRUSION_LAYER
      );
    }

    if (
      map.getLayer(
        FOOTPRINT_LAYER
      )
    ) {
      map.removeLayer(
        FOOTPRINT_LAYER
      );
    }

    if (
      map.getSource(
        SOURCE_ID
      )
    ) {
      map.removeSource(
        SOURCE_ID
      );
    }

    const geojson =
      createGeoJSON();

    map.addSource(
      SOURCE_ID,
      {
        type:
          "geojson",

        data:
          geojson,
      }
    );

    map.addLayer({
      id:
        FOOTPRINT_LAYER,

      type:
        "fill",

      source:
        SOURCE_ID,

      layout: {
        visibility: showParcels ? "visible" : "none",
      },

      paint: {
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          "#f59e0b", // Amber highlight for selected unit/parcel
          ["get", "fillColor"],
        ],

        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          0.85,
          multiBuildingMode ? 0.65 : 0.55,
        ],
      },
    });

    map.addLayer({
      id:
        EXTRUSION_LAYER,

      type:
        "fill-extrusion",

      source:
        SOURCE_ID,

      layout: {
        visibility: is3D ? "visible" : "none",
      },

      paint: {
        "fill-extrusion-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          "#f59e0b", // Amber highlight for selected 3D building
          ["get", "fillColor"],
        ],

        "fill-extrusion-base":
          [
            "to-number",
            [
              "get",
              "base",
            ],
            0,
          ],

        "fill-extrusion-height":
          [
            "to-number",
            [
              "get",
              "height",
            ],
            3,
          ],

        "fill-extrusion-opacity":
          multiBuildingMode
            ? 0.85
            : 0.75,

        "fill-extrusion-vertical-gradient":
          true,
      },
    });

    map.addLayer({
      id:
        OUTLINE_LAYER,

      type:
        "line",

      source:
        SOURCE_ID,

      layout: {
        visibility: showParcels ? "visible" : "none",
      },

      paint: {
        "line-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          "#b45309",
          "#1e3a8a",
        ],

        "line-width": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          3.5,
          1.5,
        ],

        "line-opacity":
          0.95,
      },
    });

    let selectedFeatureId: string | number | null = null;

    const clearFeatureSelection = () => {
      if (selectedFeatureId !== null && map.getSource(SOURCE_ID)) {
        map.setFeatureState(
          { source: SOURCE_ID, id: selectedFeatureId },
          { selected: false }
        );
        selectedFeatureId = null;
      }
    };

    const handlePolygonClick =
      (event: any) => {
        const features =
          map.queryRenderedFeatures(
            event.point,
            {
              layers: [
                EXTRUSION_LAYER,
                FOOTPRINT_LAYER,
              ],
            }
          );

        if (
          !features.length
        ) {
          clearFeatureSelection();
          setSelectedUnitDetails(null);
          return;
        }

        const feature = features[0];
        const properties = feature?.properties;

        if (feature.id !== undefined) {
          clearFeatureSelection();
          selectedFeatureId = feature.id;
          map.setFeatureState(
            { source: SOURCE_ID, id: feature.id },
            { selected: true }
          );
        }

        if (
          !properties
        ) {
          return;
        }

        if (
          multiBuildingMode
        ) {
          const selected =
            mapBuildings.find(
              (item) =>
                String(
                  item.id
                ) ===
                String(
                  properties.buildingId
                )
            );

          if (
            selected
          ) {
            onBuildingSelect?.(
              selected
            );
          }

          return;
        }

        const target =
          normalizedBuildings[0];

        if (!target) {
          return;
        }

        const unitId =
          String(
            properties.unitId ??
              ""
          );

        const unit =
          target.floors
            ?.flatMap(
              (floor) =>
                floor.units ??
                []
            )
            .find(
              (item) =>
                String(
                  item.id
                ) ===
                unitId
            );

        if (!unit) {
          return;
        }

        onPropertySelect?.(
          unit
        );

        setSelectedUnitDetails(unit);

        onPropertyNavigate?.(
          unit
        );
      };

    map.on(
      "click",
      EXTRUSION_LAYER,
      handlePolygonClick
    );

    map.on(
      "click",
      FOOTPRINT_LAYER,
      handlePolygonClick
    );

    const handleMapClick = (event: any) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: [EXTRUSION_LAYER, FOOTPRINT_LAYER],
      });
      if (!features.length) {
        clearFeatureSelection();
        setSelectedUnitDetails(null);
      }
    };

    map.on("click", handleMapClick);

    fitAllBuildings();

    return () => {
      map.off(
        "click",
        EXTRUSION_LAYER,
        handlePolygonClick
      );

      map.off(
        "click",
        FOOTPRINT_LAYER,
        handlePolygonClick
      );

      map.off("click", handleMapClick);

      if (
        map.getLayer(
          OUTLINE_LAYER
        )
      ) {
        map.removeLayer(
          OUTLINE_LAYER
        );
      }

      if (
        map.getLayer(
          EXTRUSION_LAYER
        )
      ) {
        map.removeLayer(
          EXTRUSION_LAYER
        );
      }

      if (
        map.getLayer(
          FOOTPRINT_LAYER
        )
      ) {
        map.removeLayer(
          FOOTPRINT_LAYER
        );
      }

      if (
        map.getSource(
          SOURCE_ID
        )
      ) {
        map.removeSource(
          SOURCE_ID
        );
      }
    };
  }, [
    mapReady,
    mapBuildings,
    normalizedBuildings,
    multiBuildingMode,
    is3D,
    showParcels,
    onBuildingSelect,
    onPropertySelect,
    onPropertyNavigate,
  ]);

  /**
   * ----------------------------------------------------------
   * BUTTONS
   * ----------------------------------------------------------
   */

  const zoomIn =
    () => {
      mapRef.current?.zoomIn({
        duration: 300,
      });
    };

  const zoomOut =
    () => {
      mapRef.current?.zoomOut({
        duration: 300,
      });
    };

  const toggle3D =
    () => {
      const map =
        mapRef.current;

      if (!map) {
        return;
      }

      setIs3D(
        (previous) => {
          const next =
            !previous;

          map.easeTo({
            pitch:
              next
                ? multiBuildingMode
                  ? 45
                  : 55
                : 0,

            duration:
              650,
          });

          return next;
        }
      );
    };

  /**
   * ----------------------------------------------------------
   * ROTATION
   * ----------------------------------------------------------
   */
  useEffect(() => {
    const map =
      mapRef.current;

    if (
      !map ||
      !rotating
    ) {
      return;
    }

    let frame =
      0;

    const rotate =
      () => {
        map.setBearing(
          map.getBearing() +
            0.15
        );

        frame =
          requestAnimationFrame(
            rotate
          );
      };

    frame =
      requestAnimationFrame(
        rotate
      );

    return () => {
      cancelAnimationFrame(
        frame
      );
    };
  }, [
    rotating,
  ]);

  /**
   * ----------------------------------------------------------
   * MAP UI
   * ----------------------------------------------------------
   */
  return (
    <div className="relative w-full h-full min-h-[600px] overflow-hidden bg-[#f8fafc]">
      {/* MAP CANVAS */}
      <div ref={containerRef} className="w-full h-full min-h-[600px]" />

      {/* ---------------------------------------------------- */}
      {/* FLOATING SEARCH BAR (TOP-LEFT) */}
      {/* ---------------------------------------------------- */}
      <div className="absolute top-6 left-6 z-40 w-[520px] max-w-[calc(100vw-4rem)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (searchResults.length > 0) {
              handleSelectSearchResult(searchResults[0]);
            }
          }}
          className="flex items-center rounded-full border border-[#cbd5e1] bg-[#ffffff]/95 px-4 py-2 shadow-lg backdrop-blur-md relative"
        >
          <div className="flex h-8 w-8 items-center justify-center text-[#2563eb] shrink-0">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder={t.mapSearchPlaceholder}
            value={searchQuery}
            onFocus={() => setIsSearchDropdownOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchDropdownOpen(true);
            }}
            className="w-full bg-transparent px-3 py-1 text-xs text-[#0f172a] placeholder-[#64748b] outline-none font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setIsSearchDropdownOpen(false);
              }}
              title="Clear search"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition"
            >
              ✕
            </button>
          )}
        </form>

        {/* SEARCH RESULTS DROPDOWN */}
        {isSearchDropdownOpen && searchQuery.trim().length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#ffffff] border border-[#cbd5e1] rounded-2xl shadow-2xl p-2.5 max-h-80 overflow-y-auto backdrop-blur-md">
            {searchResults.length > 0 ? (
              <div className="space-y-1">
                <div className="px-3 py-1.5 text-[11px] font-bold text-[#2563eb] uppercase tracking-wider border-b border-[#cbd5e1]/60 flex items-center justify-between">
                  <span>{t.matchingPublicRecords}</span>
                  <span className="text-[10px] bg-[#2563eb]/10 text-[#2563eb] px-2 py-0.5 rounded-full font-extrabold">
                    {searchResults.length}
                  </span>
                </div>

                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectSearchResult(item)}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-[#f1f5f9] cursor-pointer transition border border-transparent hover:border-[#cbd5e1]"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#2563eb]/10 text-[#2563eb]">
                          {item.type === "PROPERTY" ? "PARCEL" : "BUILDING"}
                        </span>
                        <span className="font-bold text-xs text-[#0f172a] truncate">
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-[#64748b] truncate mt-0.5">
                        {item.subtitle}
                      </span>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      {item.landUse && (
                        <span className="text-[10px] font-semibold text-[#2563eb]">
                          {item.landUse}
                        </span>
                      )}
                      {item.area && (
                        <span className="text-[10px] text-[#64748b] font-medium">
                          {item.area} m²
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-xs font-semibold text-[#64748b] bg-[#f8fafc] rounded-xl border border-[#cbd5e1]">
                {t.noMatchingRecords}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* FLOATING LOCATION CARD (TOP-RIGHT) */}
      {/* ---------------------------------------------------- */}
      <div className="absolute top-6 right-6 z-30 hidden sm:flex items-center gap-3 rounded-2xl border border-[#cbd5e1] bg-[#ffffff]/95 px-4 py-3 text-xs text-[#0f172a] shadow-lg backdrop-blur-md">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f1f5f9] border border-[#cbd5e1] text-[#2563eb] text-base">
          📍
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-[#0f172a] text-xs">
            {building?.name || (multiBuildingMode && mapBuildings.length > 0 ? t.nationalCadastralZone : t.bhuVistaPublicViewer)}
          </span>
          <span className="text-[10px] font-semibold text-[#475569]">
            {building?.georeference
              ? `${building.georeference.latitude.toFixed(4)}° N, ${building.georeference.longitude.toFixed(4)}° E`
              : t.stateLandRegistry}
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* FLOATING PROPERTY DETAILS CARD (LOWER-LEFT) */}
      {/* ---------------------------------------------------- */}
      <div className="absolute bottom-8 left-6 z-30 w-[360px] max-w-[calc(100vw-3rem)] rounded-2xl border border-[#cbd5e1] bg-[#ffffff]/95 p-5 text-[#0f172a] shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-[#cbd5e1] pb-3 mb-3">
          <h4 className="text-sm font-bold text-[#0f172a]">{t.propertyDetails}</h4>
          {(selectedUnitDetails || selectedBuildingDetails) && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-xs font-semibold text-[#2563eb] hover:text-[#1d4ed8] bg-[#2563eb]/10 px-2 py-0.5 rounded-lg transition"
            >
              {t.clearSelection}
            </button>
          )}
        </div>

        <div className="space-y-2.5 text-xs">
          {selectedUnitDetails ? (
            <>
              {selectedUnitDetails.ulpin && (
                <div className="flex justify-between border-b border-[#cbd5e1]/60 pb-1.5">
                  <span className="text-[#64748b] font-medium">ULPIN</span>
                  <span className="font-bold text-[#0f172a]">{selectedUnitDetails.ulpin}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-[#cbd5e1]/60 pb-1.5">
                <span className="text-[#64748b] font-medium">{t.unitNumberLabel}</span>
                <span className="font-bold text-[#0f172a]">{selectedUnitDetails.unitNumber}</span>
              </div>
              <div className="flex justify-between border-b border-[#cbd5e1]/60 pb-1.5">
                <span className="text-[#64748b] font-medium">{t.floorLevelLabel}</span>
                <span className="font-bold text-[#0f172a]">{selectedUnitDetails.floorNumber}</span>
              </div>
              <div className="flex justify-between border-b border-[#cbd5e1]/60 pb-1.5">
                <span className="text-[#64748b] font-medium">{t.landUseLabel}</span>
                <span className="font-bold text-[#2563eb]">{selectedUnitDetails.spaceType || "Residential"}</span>
              </div>
              <div className="flex justify-between border-b border-[#cbd5e1]/60 pb-1.5">
                <span className="text-[#64748b] font-medium">{t.areaLabel}</span>
                <span className="font-bold text-[#0f172a]">{selectedUnitDetails.area ? `${selectedUnitDetails.area} m²` : "N/A"}</span>
              </div>
              <div className="flex justify-between border-b border-[#cbd5e1]/60 pb-1.5">
                <span className="text-[#64748b] font-medium">{t.parentStructureLabel}</span>
                <span className="font-bold text-[#0f172a] truncate max-w-[180px]">
                  {selectedBuildingDetails?.name || building?.name || "Cadastral Structure"}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#cbd5e1]/60 pb-1.5">
                <span className="text-[#64748b] font-medium">{t.verificationLabel}</span>
                <span className="font-bold text-[#2563eb]">{t.approvedCadastre}</span>
              </div>

              <button
                type="button"
                onClick={() => onPropertyNavigate?.(selectedUnitDetails)}
                className="mt-4 w-full rounded-xl bg-[#2563eb] py-2.5 text-center text-xs font-bold text-white hover:bg-[#1d4ed8] transition shadow-md cursor-pointer"
              >
                {t.viewFullDetails}
              </button>
            </>
          ) : selectedBuildingDetails ? (
            <>
              <div className="flex justify-between border-b border-[#cbd5e1]/60 pb-1.5">
                <span className="text-[#64748b] font-medium">{t.parentStructureLabel}</span>
                <span className="font-bold text-[#0f172a] truncate max-w-[180px]">{selectedBuildingDetails.name}</span>
              </div>
              <div className="flex justify-between border-b border-[#cbd5e1]/60 pb-1.5">
                <span className="text-[#64748b] font-medium">{t.floorLevelLabel}</span>
                <span className="font-bold text-[#0f172a]">{selectedBuildingDetails.floors?.length || 0} Levels</span>
              </div>
              <div className="flex justify-between border-b border-[#cbd5e1]/60 pb-1.5">
                <span className="text-[#64748b] font-medium">{t.verificationLabel}</span>
                <span className="font-bold text-[#2563eb]">{t.approvedCadastre}</span>
              </div>

              <button
                type="button"
                onClick={() => onBuildingSelect?.(selectedBuildingDetails)}
                className="mt-4 w-full rounded-xl bg-[#2563eb] py-2.5 text-center text-xs font-bold text-white hover:bg-[#1d4ed8] transition shadow-md cursor-pointer"
              >
                {t.viewFullDetails}
              </button>
            </>
          ) : building ? (
            <>
              <div className="flex justify-between border-b border-[#cbd5e1]/60 pb-1.5">
                <span className="text-[#64748b] font-medium">{t.parentStructureLabel}</span>
                <span className="font-bold text-[#0f172a] truncate max-w-[180px]">{building.name}</span>
              </div>
              <div className="flex justify-between border-b border-[#cbd5e1]/60 pb-1.5">
                <span className="text-[#64748b] font-medium">{t.floorLevelLabel}</span>
                <span className="font-bold text-[#0f172a]">{building.floors?.length || 0} Levels</span>
              </div>
              <div className="flex justify-between border-b border-[#cbd5e1]/60 pb-1.5">
                <span className="text-[#64748b] font-medium">{t.verificationLabel}</span>
                <span className="font-bold text-[#2563eb]">{t.approvedCadastre}</span>
              </div>

              <button
                type="button"
                onClick={() => onBuildingSelect?.(building)}
                className="mt-4 w-full rounded-xl bg-[#2563eb] py-2.5 text-center text-xs font-bold text-white hover:bg-[#1d4ed8] transition shadow-md cursor-pointer"
              >
                {t.viewFullDetails}
              </button>
            </>
          ) : (
            <>
              <div className="flex justify-between border-b border-[#cbd5e1]/60 pb-1.5">
                <span className="text-[#64748b] font-medium">{t.registryZone}</span>
                <span className="font-bold text-[#0f172a]">{t.nationalCadastralZone}</span>
              </div>
              <div className="flex justify-between border-b border-[#cbd5e1]/60 pb-1.5">
                <span className="text-[#64748b] font-medium">{t.activeParcels}</span>
                <span className="font-bold text-[#0f172a]">{mapBuildings.length} Registered</span>
              </div>
              <div className="flex justify-between border-b border-[#cbd5e1]/60 pb-1.5">
                <span className="text-[#64748b] font-medium">{t.gisSystem}</span>
                <span className="font-bold text-[#2563eb]">MapLibre 3D</span>
              </div>

              <button
                type="button"
                className="mt-4 w-full rounded-xl bg-[#2563eb] py-2.5 text-center text-xs font-bold text-white hover:bg-[#1d4ed8] transition shadow-md cursor-pointer"
              >
                {t.viewFullDetails}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* FLOATING MAP CONTROLS & LAYER TOGGLES (RIGHT SIDE) */}
      {/* ---------------------------------------------------- */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() =>
            setBasemapMode((mode) =>
              mode === "satellite"
                ? "street"
                : "satellite"
            )
          }
          title={
            basemapMode === "satellite"
              ? "Switch to Street Map"
              : "Switch to Satellite Imagery"
          }
          className={`flex h-11 w-11 items-center justify-center rounded-full border text-[10px] font-extrabold shadow-md transition cursor-pointer ${
            basemapMode === "satellite"
              ? "border-[#2563eb] bg-[#2563eb] text-white"
              : "border-[#cbd5e1] bg-[#ffffff] text-[#2563eb] hover:bg-[#f1f5f9]"
          }`}
        >
          {basemapMode === "satellite"
            ? "SAT"
            : "MAP"}
        </button>

        <button
          type="button"
          onClick={fitAllBuildings}
          title="Home / Center View"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[#cbd5e1] bg-[#ffffff] text-base font-bold text-[#2563eb] shadow-md hover:bg-[#f1f5f9] transition cursor-pointer"
        >
          ⌂
        </button>

        <button
          type="button"
          onClick={zoomIn}
          title="Zoom In"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[#cbd5e1] bg-[#ffffff] text-xl font-bold text-[#2563eb] shadow-md hover:bg-[#f1f5f9] transition cursor-pointer"
        >
          +
        </button>

        <button
          type="button"
          onClick={zoomOut}
          title="Zoom Out"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[#cbd5e1] bg-[#ffffff] text-xl font-bold text-[#2563eb] shadow-md hover:bg-[#f1f5f9] transition cursor-pointer"
        >
          −
        </button>

        <button
          type="button"
          onClick={() => setShowParcels((prev) => !prev)}
          title="Toggle Parcel Boundaries"
          className={`flex h-11 w-11 items-center justify-center rounded-full border text-[10px] font-extrabold shadow-md transition cursor-pointer ${
            showParcels
              ? "border-[#2563eb] bg-[#2563eb] text-white"
              : "border-[#cbd5e1] bg-[#ffffff] text-[#2563eb] hover:bg-[#f1f5f9]"
          }`}
        >
          PARCEL
        </button>

        <button
          type="button"
          onClick={toggle3D}
          title="Toggle 2D / 3D Mode"
          className={`flex h-11 w-11 items-center justify-center rounded-full border text-xs font-extrabold shadow-md transition cursor-pointer ${
            is3D
              ? "border-[#2563eb] bg-[#2563eb] text-white"
              : "border-[#cbd5e1] bg-[#ffffff] text-[#2563eb] hover:bg-[#f1f5f9]"
          }`}
        >
          3D
        </button>

        <button
          type="button"
          onClick={() => setRotating((value) => !value)}
          title={rotating ? "Stop Rotation" : "Rotate Map"}
          className={`flex h-11 w-11 items-center justify-center rounded-full border text-base font-bold shadow-md transition cursor-pointer ${
            rotating
              ? "border-[#2563eb] bg-[#2563eb] text-white"
              : "border-[#cbd5e1] bg-[#ffffff] text-[#2563eb] hover:bg-[#f1f5f9]"
          }`}
        >
          ↻
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* FLOATING STATIC CITY OVERVIEW MINIMAP (BOTTOM-RIGHT) */}
      {/* ---------------------------------------------------- */}
      <div className="absolute bottom-8 right-6 z-20 hidden md:block pointer-events-none">
        <div className="w-52 h-36 rounded-2xl border-2 border-white bg-[#ffffff] shadow-2xl overflow-hidden relative border-[#cbd5e1] pointer-events-auto">
          {/* REAL MAPLIBRE STATIC MINIMAP CANVAS */}
          <div ref={minimapContainerRef} className="w-full h-full pointer-events-none" />

          {/* CITY OVERVIEW LABEL BADGE */}
          <div className="absolute top-2 left-2 z-10 rounded-md bg-[#ffffff]/90 px-2 py-0.5 text-[9px] font-extrabold text-[#2563eb] shadow-xs border border-[#cbd5e1] pointer-events-none">
            CITY OVERVIEW
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* UNOBTRUSIVE FLOATING NOTIFICATION OVERLAY */}
      {/* ---------------------------------------------------- */}
      {mapBuildings.length === 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 rounded-full border border-[#cbd5e1] bg-[#ffffff]/95 px-5 py-2.5 text-xs font-semibold text-[#0f172a] shadow-lg backdrop-blur-md flex items-center gap-2 text-center">
          <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
          <span>{t.noPublicParcelsNotice}</span>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* LEGEND */}
      {/* ---------------------------------------------------- */}
      <div className="absolute left-6 bottom-36 z-20 flex flex-wrap items-center gap-3 px-3.5 py-2 bg-[#ffffff]/95 rounded-xl border border-[#cbd5e1] shadow-md text-[11px] text-[#0f172a] backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border border-[#2563eb] bg-[#2563eb]/20 inline-block" />
          <span className="font-semibold">Parcel</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-2 border-[#b45309] bg-[#f59e0b] inline-block" />
          <span className="font-semibold">Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <LegendDot color="#2563eb" />
          <span className="font-semibold">3D Building</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   UI HELPERS
   ============================================================ */

function LegendDot({
  color,
}: {
  color: string;
}) {
  return (
    <span
      style={{
        width:
          "12px",

        height:
          "12px",

        borderRadius:
          "3px",

        background:
          color,

        display:
          "inline-block",
      }}
    />
  );
}
