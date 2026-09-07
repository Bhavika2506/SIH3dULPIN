"use client";

import { useMemo, useState, useEffect } from "react";
import DeckGL from "@deck.gl/react";
import { PolygonLayer } from "@deck.gl/layers";
import Map from "react-map-gl/maplibre";
import type { ParsedBuilding } from "@/src/lib/parser/types";

// Accurate meters-to-degrees converter relative to GNSS anchor
function localMetersToLatLng(
  xMeters: number,
  yMeters: number,
  anchorLat: number,
  anchorLng: number
): [number, number] {
  const EARTH_RADIUS = 6378137; // in meters
  const dLat = yMeters / EARTH_RADIUS;
  const dLng = xMeters / (EARTH_RADIUS * Math.cos((Math.PI * anchorLat) / 180));

  const newLat = anchorLat + (dLat * 180) / Math.PI;
  const newLng = anchorLng + (dLng * 180) / Math.PI;

  return [newLng, newLat];
}

interface MapViewerProps {
  building?: ParsedBuilding | null;
  selectedPropertyId?: string | null;
  onPropertySelect?: (id: string) => void;
}

export default function MapViewer({
  building,
  selectedPropertyId,
  onPropertySelect,
}: MapViewerProps) {
  // Read georeference anchor from GeoJSON or default to target GNSS CORS site
  const anchorLat = (building as any)?.georeference?.latitude ?? 18.5204;
  const anchorLng = (building as any)?.georeference?.longitude ?? 73.8567;

  const [viewState, setViewState] = useState({
    longitude: anchorLng,
    latitude: anchorLat,
    zoom: 19,
    pitch: 60,
    bearing: -20,
  });

  // Re-center camera whenever building dataset or georeference changes
  useEffect(() => {
    setViewState((prev) => ({
      ...prev,
      longitude: anchorLng,
      latitude: anchorLat,
      zoom: 19,
    }));
  }, [anchorLat, anchorLng, building]);

  // Extract units from building data across all floors
  const features = useMemo(() => {
    if (!building?.floors) return [];
    return building.floors.flatMap((floor) =>
      floor.units.map((unit) => ({
        id: unit.id,
        unitNumber: unit.unitNumber,
        floorNumber: floor.floorNumber,
        spaceType: (unit as any).spaceType || "Parcel",
        elevationMeters: floor.elevation || 0,
        heightMeters: floor.height || 3.2,
        polygon: unit.polygon,
      }))
    );
  }, [building]);

  // Construct Extruded 3D Deck.gl Polygon Layer
  const layers = useMemo(() => {
    if (!features.length) return [];

    return [
      new PolygonLayer({
        id: "3d-cadastral-satellite-layer",
        data: features,
        extruded: true,
        wireframe: true,
        getPolygon: (f: any) =>
          f.polygon.map((p: any) =>
            localMetersToLatLng(p.x, p.y, anchorLat, anchorLng)
          ),
        getElevation: (f: any) => f.heightMeters,
        getElevationOffset: (f: any) => f.elevationMeters,
        getFillColor: (f: any) => {
          if (f.id === selectedPropertyId) return [245, 158, 11, 230]; // Selected Amber

          const type = (f.spaceType || "").toLowerCase();
          const name = (f.unitNumber || "").toLowerCase();

          if (name.includes("stair") || type.includes("stair"))
            return [249, 115, 22, 210]; // Orange Stairs
          if (name.includes("lift") || type.includes("lift"))
            return [6, 182, 212, 220]; // Cyan Lift
          if (name.includes("passage") || type.includes("passage"))
            return [168, 85, 247, 170]; // Purple Corridor
          return [59, 130, 246, 190]; // Royal Blue Parcel
        },
        getLineColor: [255, 255, 255, 255],
        lineWidthMinPixels: 1.5,
        pickable: true,
        onClick: (info: any) => {
          if (info.object?.id) {
            onPropertySelect?.(info.object.id);
          }
        },
      }),
    ];
  }, [features, anchorLat, anchorLng, selectedPropertyId, onPropertySelect]);

  return (
    <div
      style={{
        width: "100%",
        height: "calc(100vh - 120px)",
        position: "relative",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid #cbd5e1",
      }}
    >
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState }: any) => setViewState(viewState)}
        controller={true}
        layers={layers}
      >
        <Map
          mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
          reuseMaps
        />
      </DeckGL>

      {/* Satellite Registration Badge */}
      <div
        style={{
          position: "absolute",
          top: "16px",
          left: "16px",
          background: "rgba(15, 23, 42, 0.88)",
          color: "#ffffff",
          padding: "8px 14px",
          borderRadius: "8px",
          fontSize: "12px",
          fontWeight: 700,
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          zIndex: 10,
        }}
      >
        <span style={{ color: "#10b981", fontSize: "14px" }}>✓</span>
        REGISTERED ON BASEMAP ({anchorLat.toFixed(4)}° N, {anchorLng.toFixed(4)}° E)
      </div>
    </div>
  );
}