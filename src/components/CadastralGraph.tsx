"use client";

import { useEffect, useMemo, useState } from "react";
import type { ParsedBuilding, Property2D, Floor2D } from "@/src/lib/parser/types";

type Property = Property2D & {
  ulpin: string;
  floorNumber: number;
};

/**
 * Robustly retrieves and normalizes properties from either pre-grouped building floors 
 * or a flat list of features/units.
 */
function getProperties(building?: ParsedBuilding | null): Property[] {
  if (!building) return [];

  // Case 1: Standard hierarchical floors structure
  if (building.floors && building.floors.length > 0) {
    return building.floors.flatMap((floor) =>
      (floor.units || []).map((unit, index) => ({
        ...unit,
        floorNumber: floor.floorNumber,
        ulpin: unit.ulpin || `3D-${building.id}-F${floor.floorNumber}-${index + 1}`,
      }))
    );
  }

  return [];
}

export default function CadastralGraph({
  building,
  selectedNodeId,
  onNodeSelect,
}: {
  building?: ParsedBuilding | null;
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string) => void;
}) {
  const properties = useMemo(() => getProperties(building), [building]);
  const [selected, setSelected] = useState<Property | null>(null);

  const floors = useMemo(() => {
    if (!building?.floors || building.floors.length === 0) {
      // Fallback: derive floors dynamically from properties if building.floors is empty
      const floorMap = new Map<number, Property[]>();
      properties.forEach((p) => {
        const list = floorMap.get(p.floorNumber) || [];
        list.push(p);
        floorMap.set(p.floorNumber, list);
      });

      return Array.from(floorMap.entries())
        .sort(([a], [b]) => b - a)
        .map(([floorNum, units]) => ({
          floorNumber: floorNum,
          elevation: (floorNum - 1) * 3.2,
          height: 3.2,
          units,
        }));
    }

    return [...building.floors].sort((a, b) => b.floorNumber - a.floorNumber);
  }, [building, properties]);

  useEffect(() => {
    if (!selectedNodeId) {
      setSelected(null);
      return;
    }

    const property = properties.find((item) => item.id === selectedNodeId);
    setSelected(property ?? null);
  }, [selectedNodeId, properties]);

  const selectProperty = (property: Property) => {
    setSelected(property);
    onNodeSelect?.(property.id);
  };

  const resetSelection = () => {
    setSelected(null);
    onNodeSelect?.("");
  };

  if (!building) {
    return (
      <div
        style={{
          width: "100%",
          padding: "30px",
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: "14px",
          textAlign: "center",
          color: "#64748b",
          fontSize: "14px",
        }}
      >
        No cadastral building data loaded.
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: "14px",
        overflow: "hidden",
        color: "#f8fafc",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          padding: "18px 22px",
          background: "rgba(15, 23, 42, 0.95)",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#f8fafc" }}>
            3D Cadastral Property Graph
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#94a3b8" }}>
            Building → Floor Level → Volumetric Property
          </p>
        </div>

        <button
          type="button"
          onClick={resetSelection}
          style={{
            padding: "8px 14px",
            borderRadius: "7px",
            border: "1px solid #334155",
            background: "#1e293b",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "12px",
            color: "#f8fafc",
            flexShrink: 0,
          }}
        >
          Reset Selection
        </button>
      </div>

      {/* BODY CONTAINER */}
      <div
        style={{
          padding: "24px",
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: "550px",
        }}
      >
        <div style={{ minWidth: "max-content", paddingBottom: "10px" }}>
          {/* BUILDING NODE */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "35px" }}>
            <div
              style={{
                width: "260px",
                padding: "16px",
                borderRadius: "12px",
                background: "#1e293b",
                color: "#ffffff",
                textAlign: "center",
                border: "1px solid #334155",
                boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  color: "#38bdf8",
                  letterSpacing: "1px",
                  fontWeight: 800,
                }}
              >
                BUILDING PARCEL
              </div>
              <div style={{ fontSize: "17px", fontWeight: 800, marginTop: "4px" }}>
                {building.name}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  marginTop: "4px",
                  color: "#94a3b8",
                  fontFamily: "monospace",
                }}
              >
                {building.id}
              </div>
            </div>
          </div>

          <div
            style={{
              width: "2px",
              height: "25px",
              background: "#334155",
              margin: "-35px auto 15px",
            }}
          />

          {/* FLOORS LIST */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {floors.map((floor) => {
              const floorProperties = properties.filter(
                (property) => property.floorNumber === floor.floorNumber
              );

              return (
                <div key={floor.floorNumber}>
                  <div
                    style={{
                      background: "rgba(30, 41, 59, 0.4)",
                      border: "1px solid #334155",
                      borderRadius: "12px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 16px",
                        background: "rgba(15, 23, 42, 0.6)",
                        borderBottom: "1px solid #334155",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "15px",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 800 }}>
                          FLOOR LEVEL
                        </span>
                        <span
                          style={{
                            marginLeft: "8px",
                            fontSize: "16px",
                            fontWeight: 800,
                            color: "#f8fafc",
                          }}
                        >
                          {floor.floorNumber}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>
                        {floorProperties.length} property units
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "16px",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: "14px",
                      }}
                    >
                      {floorProperties.length === 0 && (
                        <div
                          style={{
                            padding: "16px",
                            borderRadius: "8px",
                            border: "1px dashed #334155",
                            color: "#64748b",
                            fontSize: "12px",
                          }}
                        >
                          No units detected on this level.
                        </div>
                      )}

                      {floorProperties.map((property) => {
                        const isSelected = selected?.id === property.id;

                        return (
                          <button
                            key={property.id}
                            type="button"
                            onClick={() => selectProperty(property)}
                            style={{
                              textAlign: "left",
                              padding: "14px",
                              borderRadius: "9px",
                              border: isSelected ? "2px solid #f59e0b" : "1px solid #334155",
                              background: isSelected ? "rgba(245, 158, 11, 0.15)" : "#0f172a",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "15px",
                                  fontWeight: 800,
                                  color: "#f8fafc",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {property.unitNumber}
                              </span>
                              <span
                                style={{
                                  fontSize: "9px",
                                  padding: "3px 6px",
                                  borderRadius: "4px",
                                  background: "#2563eb",
                                  color: "#ffffff",
                                  fontWeight: 800,
                                  flexShrink: 0,
                                }}
                              >
                                {property.spaceType || "PARCEL"}
                              </span>
                            </div>

                            <div style={{ marginTop: "10px", fontSize: "12px", color: "#94a3b8" }}>
                              Area: <strong>{property.area} m²</strong>
                            </div>

                            <div
                              style={{
                                marginTop: "6px",
                                fontSize: "10px",
                                color: "#64748b",
                                fontFamily: "monospace",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={property.ulpin}
                            >
                              {property.ulpin}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* INSPECTOR PANEL */}
      {selected && (
        <div
          style={{
            borderTop: "1px solid #1e293b",
            background: "#0f172a",
            padding: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "20px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "10px",
                  color: "#38bdf8",
                  fontWeight: 800,
                  letterSpacing: "0.8px",
                }}
              >
                SELECTED VOLUMETRIC PARCEL
              </div>
              <h3 style={{ margin: "4px 0 0", fontSize: "18px", fontWeight: 800, color: "#f8fafc" }}>
                Unit {selected.unitNumber}
              </h3>
            </div>

            <button
              type="button"
              onClick={resetSelection}
              style={{
                border: "none",
                background: "#1e293b",
                color: "#94a3b8",
                borderRadius: "6px",
                padding: "6px 10px",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "10px",
              marginTop: "14px",
            }}
          >
            <Detail label="Property ID" value={selected.id} />
            <Detail label="Unit Code" value={selected.unitNumber} />
            <Detail label="Floor Number" value={String(selected.floorNumber)} />
            <Detail label="Surface Area" value={`${selected.area} m²`} />
            <Detail label="Assigned 3D ULPIN" value={selected.ulpin} />
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "rgba(30, 41, 59, 0.5)",
        borderRadius: "8px",
        border: "1px solid #334155",
      }}
    >
      <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 700, marginBottom: "3px" }}>
        {label}
      </div>
      <div style={{ fontSize: "12px", fontWeight: 700, color: "#f8fafc", wordBreak: "break-word" }}>
        {value}
      </div>
    </div>
  );
}