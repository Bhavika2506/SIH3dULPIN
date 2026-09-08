
"use client";

import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  ParsedBuilding,
  Property2D,
} from "@/src/lib/parser/types";

/* ============================================================
   PROPS
   ============================================================ */

interface RealWorldMapViewerProps {
  /**
   * Parsed building produced from the uploaded
   * cadastral / GeoJSON file.
   *
   * The real-world map location MUST come from:
   *
   * building.georeference.latitude
   * building.georeference.longitude
   */
  building?: ParsedBuilding | null;

  approvalStatus?:
    | "PENDING_REVIEW"
    | "APPROVED"
    | "REJECTED";

  onPropertySelect?: (
    property: Property2D
  ) => void;

  onPropertyNavigate?: (
    property: Property2D
  ) => void;
}

/* ============================================================
   GEOREFERENCE TYPE
   ============================================================ */

interface BuildingGeoreference {
  latitude: number;
  longitude: number;
}

/* ============================================================
   LOCAL METRES → WGS84
   ============================================================ */

/**
 * Converts local building coordinates into WGS84
 * latitude / longitude.
 *
 * Uploaded GeoJSON coordinates are assumed to be:
 *
 *      x = metres east / west
 *      y = metres north / south
 *
 * relative to the uploaded building georeference.
 *
 * Example:
 *
 *      GeoJSON:
 *
 *      [0, 0]
 *
 *      becomes:
 *
 *      building latitude / longitude
 *
 *      [10, 20]
 *
 *      means:
 *
 *      10 metres east
 *      20 metres north
 *
 * from the building anchor.
 */
function localMetersToLatLng(
  x: number,
  y: number,
  anchorLat: number,
  anchorLng: number
): [number, number] {
  const METERS_PER_DEGREE_LAT =
    111_320;

  const latOffset =
    y / METERS_PER_DEGREE_LAT;

  const latitudeRadians =
    (anchorLat * Math.PI) / 180;

  const metersPerDegreeLng =
    METERS_PER_DEGREE_LAT *
    Math.cos(latitudeRadians);

  const lngOffset =
    Math.abs(metersPerDegreeLng) >
    0.000001
      ? x / metersPerDegreeLng
      : 0;

  return [
    anchorLat + latOffset,
    anchorLng + lngOffset,
  ];
}

/* ============================================================
   GEOREFERENCE VALIDATION
   ============================================================ */

/**
 * Extracts valid coordinates from the uploaded
 * ParsedBuilding.
 *
 * IMPORTANT:
 *
 * There are NO fallback coordinates.
 *
 * If the uploaded file does not have valid
 * latitude/longitude, null is returned.
 */
function getBuildingGeoreference(
  building?: ParsedBuilding | null
): BuildingGeoreference | null {
  const latitude = Number(
    building?.georeference?.latitude
  );

  const longitude = Number(
    building?.georeference?.longitude
  );

  const validLatitude =
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90;

  const validLongitude =
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180;

  if (
    !validLatitude ||
    !validLongitude
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

/* ============================================================
   MISSING GEOREFERENCE VIEW
   ============================================================ */

function MissingGeoreferenceView() {
  return (
    <section
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "500px",

        borderRadius: "14px",
        overflow: "hidden",

        border:
          "1px solid #1e293b",

        background:
          "#020617",

        display: "flex",
        alignItems: "center",
        justifyContent: "center",

        color: "#ffffff",

        padding: "30px",

        textAlign: "center",
      }}
    >
      <div
        style={{
          maxWidth: "520px",
        }}
      >
        <div
          style={{
            fontSize: "42px",
            marginBottom: "14px",
          }}
        >
          📍
        </div>

        <div
          style={{
            fontSize: "19px",
            fontWeight: 800,
            marginBottom: "10px",
          }}
        >
          Building Georeference Required
        </div>

        <div
          style={{
            fontSize: "13px",
            lineHeight: 1.7,
            color: "#94a3b8",
          }}
        >
          The uploaded cadastral file does not
          contain valid latitude and longitude
          coordinates.
          <br />
          <br />
          The GIS map will not use artificial
          fallback coordinates.
          <br />
          <br />
          Add a valid{" "}
          <strong
            style={{
              color: "#ffffff",
            }}
          >
            georeference.latitude
          </strong>{" "}
          and{" "}
          <strong
            style={{
              color: "#ffffff",
            }}
          >
            georeference.longitude
          </strong>{" "}
          to the uploaded GeoJSON.
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   INNER LEAFLET COMPONENT
   ============================================================ */

/**
 * This component receives latitude/longitude as REQUIRED
 * numbers.
 *
 * That means TypeScript will NEVER see:
 *
 *      number | undefined
 *
 * inside the Leaflet code.
 */
function RealWorldMapWithCoordinates({
  building,
  latitude,
  longitude,
  approvalStatus = "APPROVED",
  onPropertySelect,
  onPropertyNavigate,
}: {
  building?: ParsedBuilding | null;

  latitude: number;

  longitude: number;

  approvalStatus?:
    | "PENDING_REVIEW"
    | "APPROVED"
    | "REJECTED";

  onPropertySelect?: (
    property: Property2D
  ) => void;

  onPropertyNavigate?: (
    property: Property2D
  ) => void;
}) {
  /* ==========================================================
     REFS
     ========================================================== */

  const mapContainerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const mapInstanceRef =
    useRef<any>(null);

  const layerGroupRef =
    useRef<any>(null);

  /* ==========================================================
     STATE
     ========================================================== */

  const [mapReady, setMapReady] =
    useState(false);

  /* ==========================================================
     INITIALIZE LEAFLET
     ========================================================== */

  useEffect(() => {
    let isMounted = true;

    async function initLeaflet() {
      if (
        !mapContainerRef.current ||
        mapInstanceRef.current
      ) {
        return;
      }

      /* ------------------------------------------------------
         LOAD LEAFLET CSS
         ------------------------------------------------------ */

      if (
        !document.getElementById(
          "leaflet-css-cdn"
        )
      ) {
        const link =
          document.createElement(
            "link"
          );

        link.id =
          "leaflet-css-cdn";

        link.rel =
          "stylesheet";

        link.href =
          "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

        document.head.appendChild(
          link
        );
      }

      /* ------------------------------------------------------
         POPUP STYLING
         ------------------------------------------------------ */

      if (
        !document.getElementById(
          "leaflet-popup-override-style"
        )
      ) {
        const style =
          document.createElement(
            "style"
          );

        style.id =
          "leaflet-popup-override-style";

        style.innerHTML = `
          .leaflet-pane.leaflet-popup-pane {
            z-index: 10000 !important;
          }

          .leaflet-popup-content-wrapper {
            background: #ffffff !important;
            color: #0f172a !important;
            border-radius: 10px !important;
            box-shadow:
              0 10px 25px rgba(0, 0, 0, 0.4) !important;
            padding: 2px !important;
          }

          .leaflet-popup-content {
            margin: 12px 14px !important;
            line-height: 1.4 !important;
          }

          .leaflet-popup-tip {
            background: #ffffff !important;
          }
        `;

        document.head.appendChild(
          style
        );
      }

      /* ------------------------------------------------------
         IMPORT LEAFLET
         ------------------------------------------------------ */

      const L =
        await import("leaflet");

      if (
        !isMounted ||
        !mapContainerRef.current
      ) {
        return;
      }

      /* ------------------------------------------------------
         CREATE MAP
         ------------------------------------------------------ */

      const map = L.map(
        mapContainerRef.current,
        {
          center: [
            latitude,
            longitude,
          ],

          zoom: building ? 19 : 15,

          zoomControl: true,
        }
      );

      /* ------------------------------------------------------
         OPEN STREET MAP
         ------------------------------------------------------ */

      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 20,

          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }
      ).addTo(map);

      /* ------------------------------------------------------
         BUILDING LAYER GROUP
         ------------------------------------------------------ */

      const layerGroup =
        L.layerGroup().addTo(map);

      layerGroupRef.current =
        layerGroup;

      mapInstanceRef.current =
        map;

      setMapReady(true);

      /* ------------------------------------------------------
         FIX INITIAL SIZE
         ------------------------------------------------------ */

      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 200);
    }

    initLeaflet();

    /* ========================================================
       CLEANUP
       ======================================================== */

    return () => {
      isMounted = false;

      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.closePopup();

          mapInstanceRef.current.off();

          mapInstanceRef.current.remove();
        } catch {
          // Safe cleanup.
        }

        mapInstanceRef.current =
          null;

        layerGroupRef.current =
          null;
      }

      setMapReady(false);
    };
  }, []);

  /* ==========================================================
     UPDATE MAP CENTER
     ========================================================== */

  useEffect(() => {
    if (
      !mapInstanceRef.current ||
      !mapReady
    ) {
      return;
    }

    mapInstanceRef.current.setView(
      [
        latitude,
        longitude,
      ],
      building ? 19 : 15
    );

    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 100);
  }, [
    latitude,
    longitude,
    building,
    mapReady,
  ]);

  /* ==========================================================
     RENDER BUILDING GEOMETRY
     ========================================================== */

  useEffect(() => {
    if (
      !mapReady ||
      !mapInstanceRef.current ||
      !layerGroupRef.current
    ) {
      return;
    }

    let cancelled = false;

    async function updateOverlay() {
      const L =
        await import("leaflet");

      if (cancelled) {
        return;
      }

      const map =
        mapInstanceRef.current;

      const layerGroup =
        layerGroupRef.current;

      if (
        !map ||
        !layerGroup
      ) {
        return;
      }

      /* ------------------------------------------------------
         REMOVE OLD GEOMETRY
         ------------------------------------------------------ */

      try {
        map.closePopup();
      } catch {
        // Safe.
      }

      layerGroup.clearLayers();

      /* ------------------------------------------------------
         GNSS / CORS ANCHOR MARKER
         ------------------------------------------------------ */

      const markerEl =
        L.divIcon({
          className:
            "custom-cors-marker",

          html: `
            <div
              style="
                width:24px;
                height:24px;
                border-radius:50%;
                background:#2563eb;
                border:3px solid #ffffff;
                box-shadow:
                  0 0 15px rgba(37,99,235,0.8);
              "
            ></div>
          `,

          iconSize: [
            24,
            24,
          ],

          iconAnchor: [
            12,
            12,
          ],
        });

      const anchorMarker =
        L.marker(
          [
            latitude,
            longitude,
          ],
          {
            icon: markerEl,
          }
        ).bindPopup(`
          <div
            style="
              font-family:system-ui,sans-serif;
              padding:4px;
            "
          >
            <strong
              style="
                font-size:13px;
                color:#0f172a;
              "
            >
              📍 Building Georeference
            </strong>

            <br/>

            <span
              style="
                font-size:11px;
                color:#475569;
              "
            >
              Latitude:
              ${latitude.toFixed(6)}°

              <br/>

              Longitude:
              ${longitude.toFixed(6)}°
            </span>

            <br/>

            <span
              style="
                font-size:10px;
                color:#10b981;
              "
            >
              Source:
              Uploaded GeoJSON
            </span>
          </div>
        `);

      layerGroup.addLayer(
        anchorMarker
      );

      /* ------------------------------------------------------
         NO BUILDING
         ------------------------------------------------------ */

      if (
        !building ||
        !building.floors ||
        building.floors.length === 0
      ) {
        return;
      }

      /* ------------------------------------------------------
         BUILDING BOUNDS
         ------------------------------------------------------ */

      const bounds =
        L.latLngBounds([
          [
            latitude,
            longitude,
          ],
        ]);

      /* ------------------------------------------------------
         LOOP THROUGH FLOORS
         ------------------------------------------------------ */

      building.floors.forEach(
        (floor) => {
          /* --------------------------------------------------
             LOOP THROUGH UNITS
             -------------------------------------------------- */

          (floor.units || []).forEach(
            (unit) => {
              /* ------------------------------------------------
                 VALID POLYGON
                 ------------------------------------------------ */

              if (
                !unit.polygon ||
                unit.polygon.length < 3
              ) {
                return;
              }

              /* ------------------------------------------------
                 LOCAL METRES → WGS84
                 ------------------------------------------------
                 
                 IMPORTANT:
                 
                 We deliberately do NOT use:
                 
                   abs(x) <= 180
                 
                 or:
                 
                   abs(y) <= 90
                 
                 to detect geographic coordinates.
                 
                 That approach can incorrectly interpret
                 local building coordinates as longitude/latitude.
                 ------------------------------------------------ */

              const latLngs =
                unit.polygon.map(
                  (point) => {
                    const x =
                      Number(
                        point?.x
                      );

                    const y =
                      Number(
                        point?.y
                      );

                    /* ------------------------------------------
                       INVALID POINT
                       ------------------------------------------ */

                    if (
                      !Number.isFinite(
                        x
                      ) ||
                      !Number.isFinite(
                        y
                      )
                    ) {
                      return [
                        latitude,
                        longitude,
                      ] as [
                        number,
                        number
                      ];
                    }

                    /* ------------------------------------------
                       CONVERT LOCAL METRES
                       ------------------------------------------ */

                    return localMetersToLatLng(
                      x,
                      y,
                      latitude,
                      longitude
                    );
                  }
                );

              /* ------------------------------------------------
                 EXTEND BUILDING BOUNDS
                 ------------------------------------------------ */

              latLngs.forEach(
                (coordinate) => {
                  bounds.extend(
                    coordinate
                  );
                }
              );

              /* ------------------------------------------------
                 SPACE TYPE
                 ------------------------------------------------ */

              const spaceType =
                (
                  unit.spaceType ||
                  ""
                ).toLowerCase();

              let fillColor =
                "#3b82f6";

              if (
                spaceType.includes(
                  "stair"
                )
              ) {
                fillColor =
                  "#f97316";
              } else if (
                spaceType.includes(
                  "lift"
                ) ||
                spaceType.includes(
                  "elevator"
                )
              ) {
                fillColor =
                  "#06b6d4";
              } else if (
                spaceType.includes(
                  "corridor"
                ) ||
                spaceType.includes(
                  "passage"
                )
              ) {
                fillColor =
                  "#a855f7";
              }

              /* ------------------------------------------------
                 DRAW POLYGON
                 ------------------------------------------------ */

              const polygon =
                L.polygon(
                  latLngs,
                  {
                    color:
                      "#0f172a",

                    weight: 2,

                    fillColor,

                    fillOpacity: 0.75,
                  }
                );

              /* ------------------------------------------------
                 POPUP
                 ------------------------------------------------ */

              const popupContainer =
                document.createElement(
                  "div"
                );

              popupContainer.style.fontFamily =
                "system-ui, sans-serif";

              popupContainer.style.minWidth =
                "180px";

              popupContainer.innerHTML = `
                <div
                  style="
                    font-size:14px;
                    font-weight:800;
                    color:#0f172a;
                    margin-bottom:4px;
                  "
                >
                  Unit
                  ${
                    unit.unitNumber ||
                    unit.id
                  }
                </div>

                <div
                  style="
                    font-size:12px;
                    color:#475569;
                    margin-bottom:2px;
                  "
                >
                  Floor:
                  ${floor.floorNumber}
                </div>

                <div
                  style="
                    font-size:12px;
                    color:#475569;
                    margin-bottom:8px;
                  "
                >
                  Area:
                  ${unit.area || 0} m²
                </div>

                <button
                  id="inspect-btn-${unit.id}"
                  style="
                    width:100%;
                    padding:6px 10px;
                    background:#2563eb;
                    color:#ffffff;
                    border:none;
                    border-radius:6px;
                    font-weight:700;
                    font-size:11px;
                    cursor:pointer;
                  "
                >
                  Inspect 3D Volume →
                </button>
              `;

              /* ------------------------------------------------
                 INSPECT BUTTON
                 ------------------------------------------------ */

              const inspectButton =
                popupContainer.querySelector(
                  `#inspect-btn-${unit.id}`
                );

              inspectButton?.addEventListener(
                "click",
                () => {
                  onPropertySelect?.(
                    unit
                  );

                  onPropertyNavigate?.(
                    unit
                  );
                }
              );

              /* ------------------------------------------------
                 POPUP
                 ------------------------------------------------ */

              polygon.bindPopup(
                popupContainer
              );

              /* ------------------------------------------------
                 SELECT PROPERTY
                 ------------------------------------------------ */

              polygon.on(
                "click",
                () => {
                  onPropertySelect?.(
                    unit
                  );
                }
              );

              /* ------------------------------------------------
                 ADD TO MAP
                 ------------------------------------------------ */

              layerGroup.addLayer(
                polygon
              );
            }
          );
        }
      );

      /* ------------------------------------------------------
         FIT BUILDING
         ------------------------------------------------------ */

      if (bounds.isValid()) {
        map.fitBounds(
          bounds,
          {
            padding: [
              50,
              50,
            ],

            maxZoom: 19,
          }
        );
      }
    }

    updateOverlay();

    return () => {
      cancelled = true;
    };
  }, [
    mapReady,
    building,
    latitude,
    longitude,
    onPropertySelect,
    onPropertyNavigate,
  ]);

  /* ==========================================================
     UI
     ========================================================== */

  return (
    <section
      style={{
        position: "relative",

        width: "100%",

        height: "100%",

        minHeight: "500px",

        borderRadius: "14px",

        overflow: "hidden",

        border:
          "1px solid #1e293b",

        background:
          "#020617",
      }}
    >
      {/* ======================================================
          HEADER
          ====================================================== */}

      <div
        style={{
          position: "absolute",

          top: "16px",

          left: "16px",

          zIndex: 400,

          background:
            "rgba(15, 23, 42, 0.9)",

          backdropFilter:
            "blur(8px)",

          border:
            "1px solid #334155",

          padding:
            "12px 18px",

          borderRadius: "10px",

          color: "#ffffff",

          pointerEvents:
            "none",
        }}
      >
        {/* TITLE */}

        <div
          style={{
            fontSize: "14px",

            fontWeight: 800,
          }}
        >
          🌐 Real-World 3D GIS
          Projection Map
        </div>

        {/* BUILDING */}

        <div
          style={{
            fontSize: "11px",

            color: "#94a3b8",

            marginTop: "3px",
          }}
        >
          {building?.name ||
            "Uploaded Building"}
        </div>

        {/* GNSS */}

        <div
          style={{
            fontSize: "11px",

            color: "#94a3b8",

            marginTop: "3px",
          }}
        >
          GNSS Reference:{" "}
          {latitude.toFixed(6)}
          ° N,{" "}
          {longitude.toFixed(6)}
          ° E
        </div>

        {/* SOURCE */}

        <div
          style={{
            fontSize: "10px",

            color: "#10b981",

            marginTop: "4px",
          }}
        >
          ● Uploaded GeoJSON
          coordinates
        </div>
      </div>

      {/* ======================================================
          STATUS + LEGEND
          ====================================================== */}

      <div
        style={{
          position: "absolute",

          bottom: "16px",

          left: "16px",

          zIndex: 400,

          background:
            "rgba(15, 23, 42, 0.9)",

          backdropFilter:
            "blur(8px)",

          padding:
            "10px 14px",

          borderRadius: "10px",

          border:
            "1px solid #334155",

          display: "flex",

          alignItems: "center",

          gap: "12px",

          fontSize: "11px",

          color: "#ffffff",

          pointerEvents:
            "none",

          flexWrap: "wrap",
        }}
      >
        {/* STATUS LABEL */}

        <span
          style={{
            color: "#94a3b8",
          }}
        >
          Status:
        </span>

        {/* STATUS */}

        <span
          style={{
            color:
              approvalStatus ===
              "APPROVED"
                ? "#10b981"
                : approvalStatus ===
                    "REJECTED"
                  ? "#ef4444"
                  : "#f59e0b",

            fontWeight: 700,
          }}
        >
          ● {approvalStatus}
        </span>

        {/* DIVIDER */}

        <div
          style={{
            height: "12px",

            width: "1px",

            background:
              "#334155",
          }}
        />

        {/* STAIRS */}

        <span
          style={{
            color: "#f97316",

            fontWeight: 600,
          }}
        >
          ■ Stairs
        </span>

        {/* ELEVATOR */}

        <span
          style={{
            color: "#06b6d4",

            fontWeight: 600,
          }}
        >
          ■ Elevator
        </span>

        {/* PASSAGE */}

        <span
          style={{
            color: "#a855f7",

            fontWeight: 600,
          }}
        >
          ■ Passage
        </span>

        {/* UNITS */}

        <span
          style={{
            color: "#3b82f6",

            fontWeight: 600,
          }}
        >
          ■ Units
        </span>
      </div>

      {/* ======================================================
          LEAFLET MAP
          ====================================================== */}

      <div
        ref={mapContainerRef}
        style={{
          position: "absolute",

          inset: 0,

          width: "100%",

          height: "100%",

          zIndex: 1,
        }}
      />
    </section>
  );
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function RealWorldMapViewer({
  building = null,
  approvalStatus = "APPROVED",
  onPropertySelect,
  onPropertyNavigate,
}: RealWorldMapViewerProps) {
  /**
   * ----------------------------------------------------------
   * GET GEOREFERENCE
   * ----------------------------------------------------------
   */

  const georeference =
    getBuildingGeoreference(
      building
    );

  /**
   * ----------------------------------------------------------
   * NO VALID GEOREFERENCE
   * ----------------------------------------------------------
   *
   * This is intentionally rendered before the inner Leaflet
   * component.
   *
   * This allows the Leaflet component to receive guaranteed
   * numbers and completely eliminates:
   *
   *   number | undefined
   *
   * TypeScript errors.
   * ----------------------------------------------------------
   */

  if (!georeference) {
    return (
      <MissingGeoreferenceView />
    );
  }

  /**
   * ----------------------------------------------------------
   * GUARANTEED NUMBERS
   * ----------------------------------------------------------
   */

  const latitude: number =
    georeference.latitude;

  const longitude: number =
    georeference.longitude;

  /**
   * ----------------------------------------------------------
   * LEAFLET MAP
   * ----------------------------------------------------------
   */

  return (
    <RealWorldMapWithCoordinates
      building={building}
      latitude={latitude}
      longitude={longitude}
      approvalStatus={
        approvalStatus
      }
      onPropertySelect={
        onPropertySelect
      }
      onPropertyNavigate={
        onPropertyNavigate
      }
    />
  );
}
