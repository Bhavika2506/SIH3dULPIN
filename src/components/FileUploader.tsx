"use client";

import { useState } from "react";

import { parseGeoJSON } from "@/src/lib/parser/geojsonParser";

import { ParsedBuilding } from "@/src/lib/parser/types";

import CadastralGraph from "./CadastralGraph";

import VolumetricViewer from "./VolumetricViewer";

import {
  parseUploadedFile,
  detectFileFormat,
} from "@/src/lib/parser/fileParser";


export default function FileUploader({
  onParsed,
}: {
  onParsed?: (building: ParsedBuilding) => void;
}) {
  const [building, setBuilding] =
    useState<ParsedBuilding | null>(null);

    const [selectedProperty, setSelectedProperty] =
  useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(false);


  // ==========================================
  // FILE HANDLER
  // ==========================================

  async function handleFile(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError(null);
    setBuilding(null);
    setLoading(true);

    
      const format =
  detectFileFormat(
    file.name
  );

console.log(
  "Detected format:",
  format
);

const parsed =
  await parseUploadedFile(
    file
  );

setBuilding(parsed);

onParsed?.(parsed);}
  // ==========================================
  // RESET
  // ==========================================

  function resetUpload() {
    setBuilding(null);
    setError(null);
    setLoading(false);

    const input =
      document.getElementById(
        "floor-plan"
      ) as HTMLInputElement | null;

    if (input) {
      input.value = "";
    }
  }


  // ==========================================
  // PROPERTY COUNT
  // ==========================================

  const propertyCount =
    building?.floors.reduce(
      (total, floor) =>
        total + floor.units.length,
      0
    ) ?? 0;


  // ==========================================
  // UI
  // ==========================================

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >

      {/* =====================================
          UPLOAD BOX
      ====================================== */}

      <label
        htmlFor="floor-plan"
        style={{
          display: "block",
          padding: "55px 30px",
          border: "2px dashed #cbd5e1",
          borderRadius: "16px",
          background: "#ffffff",
          textAlign: "center",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >

        {/* Upload icon */}

        <div
          style={{
            fontSize: "42px",
            marginBottom: "12px",
            color: "#2563eb",
          }}
        >
          ↑
        </div>


        {/* Heading */}

        <div
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          Upload 2D Floor Plan
        </div>


        {/* Description */}

        <div
          style={{
            marginTop: "8px",
            fontSize: "13px",
            color: "#64748b",
          }}
        >
          Upload a 2D cadastral floor plan
          <div
  style={{
    marginTop: "8px",
    fontSize: "12px",
    color: "#64748b",
  }}
>
  Supported: GeoJSON, JSON, DXF, SVG, PDF and SHP
</div>
        </div>


        {/* Button */}

        <div
          style={{
            marginTop: "15px",
            display: "inline-block",
            padding: "9px 18px",
            borderRadius: "7px",
            background: "#2563eb",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: "13px",
          }}
        >
          Browse File
        </div>


        {/* Hidden input */}

        <input
          id="floor-plan"
          type="file"
          accept=".geojson,.json,.dxf,.svg,.pdf,.shp"
          onChange={handleFile}
          style={{
            display: "none",
          }}
        />

      </label>


      {/* =====================================
          SUPPORTED FORMAT
      ====================================== */}

      <div
        style={{
          marginTop: "10px",
          textAlign: "center",
          fontSize: "11px",
          color: "#94a3b8",
        }}
      >
        Supported format: GeoJSON / JSON
      </div>


      {/* =====================================
          LOADING
      ====================================== */}

      {loading && (
        <div
          style={{
            marginTop: "20px",
            padding: "16px",
            borderRadius: "8px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1d4ed8",
            textAlign: "center",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Parsing 2D floor plan...
        </div>
      )}


      {/* =====================================
          ERROR
      ====================================== */}

      {error && (
        <div
          style={{
            marginTop: "20px",
            padding: "16px",
            borderRadius: "8px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
          }}
        >

          <div
            style={{
              fontWeight: 700,
              fontSize: "14px",
            }}
          >
            Parsing Error
          </div>

          <div
            style={{
              marginTop: "5px",
              fontSize: "13px",
            }}
          >
            {error}
          </div>

        </div>
      )}


      {/* =====================================
          PARSED RESULT
      ====================================== */}

      {building && (
        <div
          style={{
            marginTop: "25px",
          }}
        >

          {/* =================================
              SUCCESS HEADER
          ================================= */}

          <div
            style={{
              padding: "22px",
              borderRadius: "12px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
            }}
          >

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "15px",
              }}
            >

              <div>

                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#047857",
                  }}
                >
                  ✓ 2D File Parsed Successfully
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "12px",
                    color: "#64748b",
                  }}
                >
                  Property geometry extracted from
                  uploaded cadastral data.
                </div>

              </div>


              <button
                onClick={resetUpload}
                style={{
                  padding: "8px 14px",
                  borderRadius: "7px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "12px",
                }}
              >
                Upload Another
              </button>

            </div>


            {/* =================================
                SUMMARY CARDS
            ================================= */}

            <div
              style={{
                marginTop: "20px",
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",
                gap: "12px",
              }}
            >

              <Info
                label="Building"
                value={building.name}
              />

              <Info
                label="Floors Detected"
                value={String(
                  building.floors.length
                )}
              />

              <Info
                label="Properties Detected"
                value={String(
                  propertyCount
                )}
              />

            </div>


            {/* =================================
                FLOOR LIST
            ================================= */}

            <div
              style={{
                marginTop: "22px",
              }}
            >

              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#0f172a",
                  marginBottom: "10px",
                }}
              >
                Detected Floors
              </div>


              {building.floors.map(
                (floor) => (
                  <div
                    key={floor.floorNumber}
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      padding: "11px 14px",
                      marginBottom: "7px",
                      borderRadius: "7px",
                      background: "#f8fafc",
                      border:
                        "1px solid #e2e8f0",
                    }}
                  >

                    <div>

                      <span
                        style={{
                          fontWeight: 700,
                          color: "#0f172a",
                        }}
                      >
                        Floor{" "}
                        {floor.floorNumber}
                      </span>

                      <span
                        style={{
                          marginLeft: "10px",
                          fontSize: "11px",
                          color: "#64748b",
                        }}
                      >
                        Elevation:{" "}
                        {floor.elevation} m
                      </span>

                    </div>


                    <span
                      style={{
                        padding:
                          "4px 8px",
                        borderRadius: "5px",
                        background: "#ecfdf5",
                        color: "#047857",
                        fontSize: "11px",
                        fontWeight: 600,
                      }}
                    >
                      {
                        floor.units.length
                      }{" "}
                      properties
                    </span>

                  </div>
                )
              )}

            </div>

          </div>


          {/* =================================
              3D MODEL
          ================================= */}

          <div
            style={{
              marginTop: "25px",
            }}
          >
            
            <VolumetricViewer
  building={building}
  onPropertySelect={(property) => {
    setSelectedProperty(property.id);
  }}

  {...selectedProperty && (
  <div
    style={{
      marginTop: "15px",
      padding: "14px 16px",
      borderRadius: "9px",
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "15px",
    }}
  >
    <div>
      <div
        style={{
          fontSize: "10px",
          fontWeight: 700,
          color: "#64748b",
          letterSpacing: "0.5px",
        }}
      >
        ACTIVE CADASTRAL PROPERTY
      </div>

      <div
        style={{
          marginTop: "3px",
          fontSize: "15px",
          fontWeight: 700,
          color: "#1e3a8a",
        }}
      >
        {selectedProperty}
      </div>
    </div>

    <div
      style={{
        fontSize: "11px",
        color: "#475569",
        textAlign: "right",
      }}
    >
      3D Volume ↔ Cadastral Node
    </div>
  </div>
)}

/>
            

          </div>

        </div>
      )}

    </div>
  );
}


// ==========================================
// INFO CARD
// ==========================================

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "15px",
        borderRadius: "8px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
      }}
    >

      <div
        style={{
          fontSize: "10px",
          color: "#64748b",
          fontWeight: 700,
          marginBottom: "6px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </div>


      <div
        style={{
          fontSize: "15px",
          fontWeight: 700,
          color: "#0f172a",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>

    </div>
  );
}