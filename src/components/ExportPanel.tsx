"use client";

import type { ParsedBuilding } from "@/src/lib/parser/types";
import { exportToCityGML } from "@/src/exporters/citygmlExporter";
import { exportToLandXML } from "@/src/exporters/landxmlExporter";

export default function ExportPanel({ building }: { building: ParsedBuilding }) {
  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleGeoJSONExport = () => {
    const features = building.floors.flatMap((floor) =>
      floor.units.map((unit) => ({
        type: "Feature",
        properties: {
          id: unit.id,
          unitNumber: unit.unitNumber,
          floorNumber: unit.floorNumber,
          areaSqMeters: unit.area,
          elevationMeters: floor.elevation,
          heightMeters: floor.height,
          ulpin: unit.ulpin,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              ...unit.polygon.map((p) => [p.x, p.y]),
              [unit.polygon[0].x, unit.polygon[0].y],
            ],
          ],
        },
      }))
    );

    const geojson = {
      type: "FeatureCollection",
      buildingName: building.name,
      buildingId: building.id,
      features,
    };

    downloadFile(
      JSON.stringify(geojson, null, 2),
      `${building.name.toLowerCase()}_3d_cadastre.geojson`,
      "application/json"
    );
  };

  return (
    <div
      style={{
        marginTop: "22px",
        padding: "20px",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
      }}
    >
      <div>
        <div style={{ fontSize: "15px", fontWeight: 800 }}>Export 3D Cadastral Models</div>
        <div style={{ marginTop: "4px", fontSize: "12px", color: "#64748b" }}>
          Export volumetric parcel models into industry-standard GIS, survey, and BIM formats.
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          type="button"
          onClick={handleGeoJSONExport}
          style={{
            border: "none",
            borderRadius: "8px",
            padding: "10px 14px",
            background: "#059669",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          ↓ 3D GeoJSON
        </button>
        <button
          type="button"
          onClick={() =>
            downloadFile(
              exportToCityGML(building),
              `${building.name.toLowerCase()}_citygml3.gml`,
              "application/xml"
            )
          }
          style={{
            border: "none",
            borderRadius: "8px",
            padding: "10px 14px",
            background: "#2563eb",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          ↓ CityGML 3.0
        </button>
        <button
          type="button"
          onClick={() =>
            downloadFile(
              exportToLandXML(building),
              `${building.name.toLowerCase()}_landxml.xml`,
              "application/xml"
            )
          }
          style={{
            border: "none",
            borderRadius: "8px",
            padding: "10px 14px",
            background: "#4f46e5",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          ↓ LandXML
        </button>
      </div>
    </div>
  );
}