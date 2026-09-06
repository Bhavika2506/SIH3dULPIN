"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ParsedBuilding,
  Property2D,
} from "@/src/lib/parser/types";

type Property = Property2D & {
  ulpin: string;
};

function getProperties(building?: ParsedBuilding | null): Property[] {
  if (!building?.floors) return [];

  return building.floors.flatMap((floor) =>
    floor.units.map((unit, index) => ({
      ...unit,
      ulpin: `3D-${building.id}-${floor.floorNumber}-${index + 1}`,
    }))
  );
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
  const properties = useMemo(
    () => getProperties(building),
    [building]
  );

  const [selected, setSelected] = useState<Property | null>(null);

  const floors = useMemo(
    () =>
      building?.floors
        ? [...building.floors].sort((a, b) => b.floorNumber - a.floorNumber)
        : [],
    [building]
  );

  useEffect(() => {
    if (!selectedNodeId) {
      setSelected(null);
      return;
    }

    const property = properties.find(
      (item) => item.id === selectedNodeId
    );

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
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
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
        minWidth: "max-content",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
      }}
    >
      {/* HEADER WITH STICKY POSITIONING FOR SCROLLING */}
      <div
        style={{
          padding: "18px 22px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
          position: "sticky",
          top: 0,
          zIndex: 10,
          borderRadius: "14px 14px 0 0",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            3D Cadastral Property Graph
          </h2>

          <p
            style={{
              margin: "5px 0 0",
              fontSize: "13px",
              color: "#64748b",
            }}
          >
            Building → Floor → Volumetric Property
          </p>
        </div>

        <button
          type="button"
          onClick={resetSelection}
          style={{
            padding: "8px 14px",
            borderRadius: "7px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            cursor: "pointer",
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          Reset
        </button>
      </div>

      {/* SCROLLABLE GRAPH CONTAINER */}
      <div
        style={{
          padding: "30px",
          overflow: "auto",
        }}
      >
        {/* BUILDING NODE */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "35px",
          }}
        >
          <div
            style={{
              width: "230px",
              padding: "18px",
              borderRadius: "12px",
              background: "#111827",
              color: "#ffffff",
              textAlign: "center",
              boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                opacity: 0.7,
                letterSpacing: "1px",
              }}
            >
              BUILDING
            </div>

            <div
              style={{
                fontSize: "19px",
                fontWeight: 700,
                marginTop: "5px",
              }}
            >
              {building.name}
            </div>

            <div
              style={{
                fontSize: "11px",
                marginTop: "5px",
                opacity: 0.75,
              }}
            >
              {building.id}
            </div>
          </div>
        </div>

        {/* MAIN VERTICAL CONNECTION */}
        <div
          style={{
            width: "2px",
            height: "25px",
            background: "#94a3b8",
            margin: "-35px auto 15px",
          }}
        />

        {/* FLOORS */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "22px",
          }}
        >
          {floors.map((floor, floorIndex) => {
            const floorProperties = properties.filter(
              (property) => property.floorNumber === floor.floorNumber
            );

            return (
              <div key={floor.floorNumber}>
                {/* FLOOR CARD */}
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "12px",
                    overflow: "hidden",
                    boxShadow: "0 3px 10px rgba(15,23,42,0.05)",
                  }}
                >
                  {/* FLOOR HEADER */}
                  <div
                    style={{
                      padding: "12px 18px",
                      background: "#eff6ff",
                      borderBottom: "1px solid #dbeafe",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "15px",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#2563eb",
                          fontWeight: 700,
                        }}
                      >
                        FLOOR
                      </span>

                      <span
                        style={{
                          marginLeft: "8px",
                          fontSize: "18px",
                          fontWeight: 700,
                          color: "#0f172a",
                        }}
                      >
                        {floor.floorNumber}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                      }}
                    >
                      {floorProperties.length} properties
                    </div>
                  </div>

                  {/* PROPERTY NODES */}
                  <div
                    style={{
                      padding: "20px",
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(210px, 1fr))",
                      gap: "16px",
                    }}
                  >
                    {floorProperties.length === 0 && (
                      <div
                        style={{
                          padding: "18px",
                          borderRadius: "10px",
                          border: "1px dashed #cbd5e1",
                          color: "#64748b",
                          fontSize: "12px",
                          background: "#f8fafc",
                        }}
                      >
                        No properties detected on this floor.
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
                            padding: "16px",
                            borderRadius: "10px",
                            border: isSelected
                              ? "2px solid #f59e0b"
                              : "1px solid #d1fae5",
                            background: isSelected ? "#fffbeb" : "#f0fdf4",
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
                              gap: "10px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "17px",
                                fontWeight: 700,
                                color: "#065f46",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {property.unitNumber}
                            </span>

                            <span
                              style={{
                                fontSize: "10px",
                                padding: "4px 7px",
                                borderRadius: "5px",
                                background: "#059669",
                                color: "#ffffff",
                                flexShrink: 0,
                              }}
                            >
                              PROPERTY
                            </span>
                          </div>

                          <div
                            style={{
                              marginTop: "12px",
                              fontSize: "13px",
                              color: "#475569",
                            }}
                          >
                            Area: <strong>{property.area} m²</strong>
                          </div>

                          <div
                            style={{
                              marginTop: "7px",
                              fontSize: "11px",
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

                          <div
                            style={{
                              marginTop: "8px",
                              fontSize: "10px",
                              color: isSelected ? "#b45309" : "#64748b",
                              fontWeight: 600,
                            }}
                          >
                            {isSelected ? "Selected" : "Click to inspect"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* VERTICAL RELATIONSHIP */}
                {floorIndex < floors.length - 1 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      margin: "4px 0",
                    }}
                  >
                    <div
                      style={{
                        width: "2px",
                        height: "14px",
                        background: "#7c3aed",
                      }}
                    />

                    <div
                      style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        color: "#7c3aed",
                        padding: "3px 8px",
                        borderRadius: "5px",
                        background: "#f5f3ff",
                        border: "1px solid #ddd6fe",
                        whiteSpace: "nowrap",
                      }}
                    >
                      VERTICAL RELATION
                    </div>

                    <div
                      style={{
                        width: "2px",
                        height: "14px",
                        background: "#7c3aed",
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* PROPERTY DETAIL PANEL */}
      {selected && (
        <div
          style={{
            borderTop: "1px solid #e2e8f0",
            background: "#ffffff",
            padding: "22px",
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
                  fontSize: "11px",
                  color: "#64748b",
                  fontWeight: 700,
                  letterSpacing: "0.8px",
                }}
              >
                SELECTED 3D PROPERTY
              </div>

              <h3
                style={{
                  margin: "5px 0 0",
                  fontSize: "22px",
                  fontWeight: 700,
                }}
              >
                Apartment {selected.unitNumber}
              </h3>
            </div>

            <button
              type="button"
              onClick={resetSelection}
              style={{
                border: "none",
                background: "#f1f5f9",
                borderRadius: "6px",
                padding: "6px 10px",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>

          {/* DETAILS */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              marginTop: "18px",
            }}
          >
            <Detail label="Property ID" value={selected.id} />
            <Detail label="Unit Number" value={selected.unitNumber} />
            <Detail label="Floor" value={String(selected.floorNumber)} />
            <Detail label="Area" value={`${selected.area} m²`} />
            <Detail label="3D ULPIN" value={selected.ulpin} />
          </div>
        </div>
      )}

      {/* LEGEND */}
      <div
        style={{
          padding: "14px 22px",
          borderTop: "1px solid #e2e8f0",
          background: "#f8fafc",
          display: "flex",
          flexWrap: "wrap",
          gap: "25px",
          fontSize: "12px",
          color: "#475569",
          borderRadius: "0 0 14px 14px",
        }}
      >
        <span>● Building</span>
        <span>● Floor</span>
        <span>● Property</span>
        <span>┃ Vertical relationship</span>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "12px",
        background: "#f8fafc",
        borderRadius: "8px",
        border: "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          color: "#64748b",
          fontWeight: 700,
          marginBottom: "5px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "#0f172a",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}