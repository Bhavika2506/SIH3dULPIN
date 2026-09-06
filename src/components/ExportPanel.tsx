"use client";

import type { ParsedBuilding } from "@/src/lib/parser/types";

export default function ExportPanel({ building }: { building: ParsedBuilding }) {
  const handleExport = () => {
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
          ulpin: unit.ulpin || `3D-${building.id}-F${unit.floorNumber}-${unit.unitNumber}`,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              ...unit.polygon.map((p) => [p.x, p.y]),
              [unit.polygon[0].x, unit.polygon[0].y], // Close polygon ring
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

    const blob = new Blob([JSON.stringify(geojson, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${building.name.toLowerCase()}_3d_cadastre.geojson`;
    link.click();
    URL.revokeObjectURL(url);
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
        <div style={{ fontSize: "15px", fontWeight: 800 }}>Export 3D Cadastral Parcel</div>
        <div style={{ marginTop: "4px", fontSize: "12px", color: "#64748b" }}>
          Download volumetric parcel geometries and registered 3D ULPIN metadata in standard 3D GeoJSON format.
        </div>
      </div>

      <button
        type="button"
        onClick={handleExport}
        style={{
          border: "none",
          borderRadius: "8px",
          padding: "10px 18px",
          background: "#059669",
          color: "#ffffff",
          fontWeight: 700,
          fontSize: "13px",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        ↓ Export 3D GeoJSON
      </button>
    </div>
  );
}