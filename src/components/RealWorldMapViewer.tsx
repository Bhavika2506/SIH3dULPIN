"use client";

import React, { useEffect, useRef, useState } from "react";
import type { ParsedBuilding, Property2D } from "@/src/lib/parser/types";

interface RealWorldMapViewerProps {
  building?: ParsedBuilding | null;
  latitude?: number;
  longitude?: number;
  approvalStatus?: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  onPropertySelect?: (property: Property2D) => void;
  onPropertyNavigate?: (property: Property2D) => void;
}

export default function RealWorldMapViewer({
  building = null,
  latitude = 18.5204,
  longitude = 73.8567,
  approvalStatus = "APPROVED",
  onPropertySelect,
  onPropertyNavigate,
}: RealWorldMapViewerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  const activeLat = building?.georeference?.latitude ?? latitude;
  const activeLng = building?.georeference?.longitude ?? longitude;

  // 1. Initialize Map Instance safely and force Leaflet popup visibility styles
  useEffect(() => {
    let isMounted = true;

    async function initLeaflet() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      if (!document.getElementById("leaflet-css-cdn")) {
        const link = document.createElement("link");
        link.id = "leaflet-css-cdn";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (!document.getElementById("leaflet-popup-override-style")) {
        const style = document.createElement("style");
        style.id = "leaflet-popup-override-style";
        style.innerHTML = `
          .leaflet-pane.leaflet-popup-pane {
            z-index: 10000 !important;
          }
          .leaflet-popup-content-wrapper {
            background: #ffffff !important;
            color: #0f172a !important;
            border-radius: 10px !important;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4) !important;
            padding: 2px !important;
          }
          .leaflet-popup-content {
            margin: 8px 10px !important;
            line-height: 1.4 !important;
          }
          .leaflet-popup-tip {
            background: #ffffff !important;
          }
        `;
        document.head.appendChild(style);
      }

      const L = await import("leaflet");

      if (!isMounted || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [activeLat, activeLng],
        zoom: building ? 18 : 15,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;

      mapInstanceRef.current = map;
      setMapReady(true);

      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 200);
    }

    initLeaflet();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.closePopup();
          mapInstanceRef.current.off();
          mapInstanceRef.current.remove();
        } catch (e) {
          // Ignore unmount warnings
        }
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  // 2. Render overlays using direct DOM Nodes for Popups
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !layerGroupRef.current) return;

    async function updateOverlay() {
      const L = await import("leaflet");
      const map = mapInstanceRef.current;
      const layerGroup = layerGroupRef.current;

      if (!map || !layerGroup) return;

      try {
        map.closePopup();
      } catch (e) {
        // Safe catch
      }
      layerGroup.clearLayers();

      // Anchor Marker
      const marker = L.marker([activeLat, activeLng]);
      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; padding: 4px; min-width: 160px; color: #0f172a;">
          <strong style="font-size: 13px;">📍 GNSS CORS Reference Anchor</strong><br/>
          <span style="font-size: 11px; color: #475569;">Lat: ${activeLat.toFixed(4)}° N</span><br/>
          <span style="font-size: 11px; color: #475569;">Lng: ${activeLng.toFixed(4)}° E</span>
        </div>
      `);
      layerGroup.addLayer(marker);

      // Render Floor Units
      if (building?.floors?.length) {
        const bounds: [number, number][] = [];

        building.floors.forEach((floor) => {
          floor.units.forEach((unit) => {
            if (!unit.polygon || unit.polygon.length < 3) return;

            const latLngs: [number, number][] = unit.polygon.map((p) => {
              const latOffset = (p.y / 6378137) * (180 / Math.PI);
              const lngOffset =
                (p.x / (6378137 * Math.cos((Math.PI * activeLat) / 180))) *
                (180 / Math.PI);

              const ptLat = activeLat + latOffset;
              const ptLng = activeLng + lngOffset;
              bounds.push([ptLat, ptLng]);
              return [ptLat, ptLng];
            });

            const spaceType = (unit.spaceType || unit.unitNumber || "").toLowerCase();
            let color = "#3b82f6";
            if (spaceType.includes("stair")) color = "#f97316";
            else if (spaceType.includes("lift") || spaceType.includes("elevator")) color = "#06b6d4";

            const polygonLayer = L.polygon(latLngs, {
              color: color,
              weight: 2,
              fillColor: color,
              fillOpacity: 0.6,
            });

            // Create Popup DOM Container directly
            const popupDiv = document.createElement("div");
            popupDiv.style.cssText = "font-family: system-ui, sans-serif; padding: 8px; color: #0f172a; min-width: 220px;";

            popupDiv.innerHTML = `
              <div style="font-size: 10px; font-weight: 800; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px;">
                3D Cadastral Property
              </div>
              <div style="font-size: 18px; font-weight: 800; margin-top: 4px;">
                Unit ${unit.unitNumber}
              </div>
              <div style="margin-top: 10px; padding: 9px; background: #f8fafc; border-radius: 7px;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 6px;">
                  <span style="color:#64748b;">Floor</span>
                  <strong>${floor.floorNumber}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 6px;">
                  <span style="color:#64748b;">Area</span>
                  <strong>${unit.area ?? "N/A"} m²</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px;">
                  <span style="color:#64748b;">Space Type</span>
                  <strong>${unit.spaceType || "Property"}</strong>
                </div>
              </div>
              <div style="margin-top: 10px; font-size: 10px; color: #475569;">
                3D ULPIN
              </div>
              <div style="margin-top: 2px; padding: 7px; background: #f1f5f9; border-radius: 6px; font-size: 10px; font-family: monospace; word-break: break-all;">
                ${unit.ulpin || "Pending Generation"}
              </div>
            `;

            // Explicitly create button DOM node & bind direct click event
            const button = document.createElement("button");
            button.innerText = "View Property Details →";
            button.style.cssText = `
              margin-top: 12px;
              width: 100%;
              padding: 9px 10px;
              background: #2563eb;
              color: #ffffff;
              border: none;
              border-radius: 7px;
              font-weight: 700;
              font-size: 11px;
              cursor: pointer;
              display: block;
              text-align: center;
            `;

            button.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onPropertyNavigate) {
                onPropertyNavigate(unit);
              }
            };

            popupDiv.appendChild(button);

            polygonLayer.bindPopup(popupDiv, {
              closeButton: true,
              autoPan: true,
              className: "cadastral-map-popup",
            });

            polygonLayer.on("click", () => {
              if (onPropertySelect) {
                onPropertySelect(unit);
              }
            });

            layerGroup.addLayer(polygonLayer);
          });
        });

        if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      } else {
        map.setView([activeLat, activeLng], 15);
      }
    }

    updateOverlay();
  }, [mapReady, building, activeLat, activeLng, onPropertySelect, onPropertyNavigate]);

  return (
    <section
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "100%",
        borderRadius: "14px",
        overflow: "hidden",
        border: "1px solid #1e293b",
        background: "#020617",
      }}
    >
      {/* HEADER OVERLAY */}
      <div
        style={{
          position: "absolute",
          top: "16px",
          left: "16px",
          zIndex: 400,
          background: "rgba(15, 23, 42, 0.9)",
          backdropFilter: "blur(8px)",
          border: "1px solid #334155",
          padding: "12px 18px",
          borderRadius: "10px",
          color: "#ffffff",
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: "14px", fontWeight: 800 }}>
          🌐 Real-World 3D GIS Projection Map
        </div>
        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
          GNSS CORS Reference: {activeLat.toFixed(4)}° N, {activeLng.toFixed(4)}° E
        </div>
      </div>

      {/* STATUS & LEGEND BADGE */}
      <div
        style={{
          position: "absolute",
          bottom: "16px",
          left: "16px",
          zIndex: 400,
          background: "rgba(15, 23, 42, 0.9)",
          backdropFilter: "blur(8px)",
          padding: "10px 14px",
          borderRadius: "10px",
          border: "1px solid #334155",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "11px",
          color: "#ffffff",
          pointerEvents: "none",
        }}
      >
        <span style={{ color: "#94a3b8" }}>Status:</span>
        <span
          style={{
            color: approvalStatus === "APPROVED" ? "#10b981" : "#f59e0b",
            fontWeight: 700,
          }}
        >
          ● {approvalStatus}
        </span>
        <div style={{ height: "12px", width: "1px", background: "#334155" }} />
        <span style={{ color: "#f97316", fontWeight: 600 }}>■ Stairs</span>
        <span style={{ color: "#06b6d4", fontWeight: 600 }}>■ Elevator</span>
        <span style={{ color: "#3b82f6", fontWeight: 600 }}>■ Units</span>
      </div>

      {/* LEAFLET CANVAS CONTAINER */}
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