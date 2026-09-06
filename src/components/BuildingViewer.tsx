"use client";

import * as THREE from "three";
import { useState } from "react";

import { Canvas } from "@react-three/fiber";

import {
  OrbitControls,
  Grid,
  Text,
} from "@react-three/drei";

import {
  building,
  PropertyUnit,
} from "@/src/lib/building";

import CadastralGraph from "@/src/components/CadastralGraph";
import TopologyValidator from "@/src/components/TopologyValidator";


// ==========================================
// PROPERTY VOLUME
// ==========================================

function PropertyVolume({
  unit,
  selected,
  onSelect,
}: {
  unit: PropertyUnit;
  selected: boolean;
  onSelect: (unit: PropertyUnit) => void;
}) {

  const centerX =
    unit.x + unit.width / 2;

  const centerY =
    unit.y + unit.depth / 2;

  const centerZ =
    (unit.zMin + unit.zMax) / 2;

  const height =
    unit.zMax - unit.zMin;


  return (

    <group
      position={[
        centerX,
        centerZ,
        centerY,
      ]}
    >

      {/* ==================================
          PROPERTY VOLUME
          ================================== */}

      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect(unit);
        }}
      >

        <boxGeometry
          args={[
            unit.width,
            height,
            unit.depth,
          ]}
        />

        <meshStandardMaterial
          transparent
          opacity={
            selected
              ? 0.95
              : 0.65
          }
          emissive={
            selected
              ? new THREE.Color(
                  0x2563eb
                )
              : new THREE.Color(
                  0x000000
                )
          }
          emissiveIntensity={
            selected
              ? 0.35
              : 0
          }
        />

      </mesh>


      {/* ==================================
          PROPERTY BOUNDARY
          ================================== */}

      <lineSegments>

        <edgesGeometry
          attach="geometry"
          args={[
            new THREE.BoxGeometry(
              unit.width,
              height,
              unit.depth
            ),
          ]}
        />

        <lineBasicMaterial />

      </lineSegments>


      {/* ==================================
          PROPERTY LABEL
          ================================== */}

      <Text
        position={[
          0,
          height / 2 + 0.25,
          0,
        ]}
        fontSize={0.35}
        color="black"
        anchorX="center"
        anchorY="middle"
      >

        {unit.unitNumber}

      </Text>

    </group>
  );
}


// ==========================================
// BUILDING
// ==========================================

function Building({
  selectedUnit,
  onSelect,
}: {
  selectedUnit: PropertyUnit | null;
  onSelect: (unit: PropertyUnit) => void;
}) {

  return (

    <group>

      {building.floorsData.map(
        (floor) =>

          floor.units.map(
            (unit) => (

              <PropertyVolume
                key={unit.id}
                unit={unit}
                selected={
                  selectedUnit?.id ===
                  unit.id
                }
                onSelect={onSelect}
              />

            )
          )
      )}

    </group>
  );
}


// ==========================================
// PROPERTY INFORMATION PANEL
// ==========================================

function PropertyPanel({
  unit,
  onClose,
}: {
  unit: PropertyUnit | null;
  onClose: () => void;
}) {

  if (!unit) {

    return (

      <div
        style={{
          width: "320px",
          padding: "24px",
          borderLeft:
            "1px solid #ddd",
          background: "#ffffff",
        }}
      >

        <h2
          style={{
            fontSize: "20px",
            fontWeight: "700",
            marginBottom: "12px",
          }}
        >
          Property Information
        </h2>

        <p
          style={{
            color: "#666",
            lineHeight: "1.5",
          }}
        >
          Select an apartment in the
          3D building to view its
          cadastral information.
        </p>

      </div>
    );
  }


  return (

    <div
      style={{
        width: "320px",
        padding: "24px",
        borderLeft:
          "1px solid #ddd",
        background: "#ffffff",
        overflowY: "auto",
      }}
    >

      {/* HEADER */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >

        <h2
          style={{
            fontSize: "20px",
            fontWeight: "700",
            margin: 0,
          }}
        >
          Property Details
        </h2>

        <button
          onClick={onClose}
          style={{
            border: "none",
            background: "#f1f1f1",
            borderRadius: "6px",
            padding: "6px 10px",
            cursor: "pointer",
          }}
        >
          ✕
        </button>

      </div>


      {/* PROPERTY */}

      <div
        style={{
          marginBottom: "20px",
        }}
      >

        <div
          style={{
            fontSize: "13px",
            color: "#777",
            marginBottom: "4px",
          }}
        >
          PROPERTY UNIT
        </div>

        <div
          style={{
            fontSize: "24px",
            fontWeight: "700",
          }}
        >
          Apartment {unit.unitNumber}
        </div>

      </div>


      {/* ULPIN */}

      <div
        style={{
          padding: "14px",
          background: "#f5f7fa",
          borderRadius: "8px",
          marginBottom: "20px",
        }}
      >

        <div
          style={{
            fontSize: "12px",
            color: "#777",
            marginBottom: "6px",
          }}
        >
          3D ULPIN
        </div>

        <div
          style={{
            fontSize: "13px",
            fontFamily: "monospace",
            fontWeight: "600",
            wordBreak: "break-all",
          }}
        >
          {unit.ulpin}
        </div>

      </div>


      {/* DETAILS */}

      <div>

        <InfoRow
          label="Property ID"
          value={unit.id}
        />

        <InfoRow
          label="Floor"
          value={unit.floorNumber.toString()}
        />

        <InfoRow
          label="Area"
          value={`${unit.area} m²`}
        />

        <InfoRow
          label="Width"
          value={`${unit.width} m`}
        />

        <InfoRow
          label="Depth"
          value={`${unit.depth} m`}
        />

        <InfoRow
          label="Z Minimum"
          value={`${unit.zMin} m`}
        />

        <InfoRow
          label="Z Maximum"
          value={`${unit.zMax} m`}
        />

      </div>


      {/* STATUS */}

      <div
        style={{
          marginTop: "20px",
          padding: "12px",
          background: "#ecfdf5",
          borderRadius: "8px",
          color: "#047857",
          fontWeight: "600",
        }}
      >
        ✓ Spatial Geometry Valid
      </div>

    </div>
  );
}


// ==========================================
// INFORMATION ROW
// ==========================================

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {

  return (

    <div
      style={{
        display: "flex",
        justifyContent:
          "space-between",
        gap: "20px",
        padding: "10px 0",
        borderBottom:
          "1px solid #eee",
      }}
    >

      <span
        style={{
          color: "#666",
          fontSize: "14px",
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontWeight: "600",
          fontSize: "14px",
          textAlign: "right",
        }}
      >
        {value}
      </span>

    </div>
  );
}


// ==========================================
// MAIN BUILDING VIEWER
// ==========================================

export default function BuildingViewer() {

  const [
    selectedUnit,
    setSelectedUnit,
  ] =
    useState<PropertyUnit | null>(
      null
    );


  const [
    view,
    setView,
  ] =
    useState<
      "3D" |
      "GRAPH" |
      "VALIDATION"
    >("3D");


  return (

    <div
      style={{
        width: "100%",
        background:
          "#f8fafc",
      }}
    >

      {/* ==================================
          VIEW NAVIGATION
          ================================== */}

      <div
        style={{
          display: "flex",
          gap: "8px",
          padding: "12px",
          borderBottom:
            "1px solid #e2e8f0",
          background: "#ffffff",
        }}
      >

        {/* 3D */}

        <button
          onClick={() =>
            setView("3D")
          }
          style={{
            padding:
              "9px 18px",
            borderRadius:
              "7px",
            border:
              "1px solid #d1d5db",
            background:
              view === "3D"
                ? "#111827"
                : "#ffffff",
            color:
              view === "3D"
                ? "#ffffff"
                : "#111827",
            cursor:
              "pointer",
            fontWeight:
              "600",
          }}
        >
          3D MODEL
        </button>


        {/* GRAPH */}

        <button
          onClick={() =>
            setView("GRAPH")
          }
          style={{
            padding:
              "9px 18px",
            borderRadius:
              "7px",
            border:
              "1px solid #d1d5db",
            background:
              view === "GRAPH"
                ? "#111827"
                : "#ffffff",
            color:
              view === "GRAPH"
                ? "#ffffff"
                : "#111827",
            cursor:
              "pointer",
            fontWeight:
              "600",
          }}
        >
          GRAPH
        </button>


        {/* VALIDATION */}

        <button
          onClick={() =>
            setView(
              "VALIDATION"
            )
          }
          style={{
            padding:
              "9px 18px",
            borderRadius:
              "7px",
            border:
              "1px solid #d1d5db",
            background:
              view ===
              "VALIDATION"
                ? "#111827"
                : "#ffffff",
            color:
              view ===
              "VALIDATION"
                ? "#ffffff"
                : "#111827",
            cursor:
              "pointer",
            fontWeight:
              "600",
          }}
        >
          VALIDATION
        </button>

      </div>


      {/* ==================================
          3D VIEW
          ================================== */}

      {view === "3D" && (

        <div
          style={{
            display: "flex",
            width: "100%",
            height: "700px",
          }}
        >

          <div
            style={{
              flex: 1,
              minWidth: 0,
            }}
          >

            <Canvas
              camera={{
                position: [
                  18,
                  15,
                  22,
                ],
                fov: 45,
              }}
            >

              <ambientLight
                intensity={0.6}
              />

              <directionalLight
                position={[
                  10,
                  20,
                  10,
                ]}
                intensity={1}
              />


              <Grid
                args={[
                  30,
                  30,
                ]}
                cellSize={1}
                cellThickness={
                  0.5
                }
                sectionSize={5}
                sectionThickness={
                  1
                }
                fadeDistance={
                  40
                }
                infiniteGrid
              />


              <Building
                selectedUnit={
                  selectedUnit
                }
                onSelect={
                  setSelectedUnit
                }
              />


              <axesHelper
                args={[10]}
              />


              <OrbitControls />

            </Canvas>

          </div>


          <PropertyPanel
            unit={
              selectedUnit
            }
            onClose={() =>
              setSelectedUnit(
                null
              )
            }
          />

        </div>
      )}


      {/* ==================================
          GRAPH VIEW
          ================================== */}

      {view === "GRAPH" && (

        <div
          style={{
            padding: "24px",
            background:
              "#f8fafc",
          }}
        >

          <div
            style={{
              marginBottom:
                "20px",
            }}
          >

            <h2
              style={{
                fontSize:
                  "22px",
                fontWeight:
                  "700",
                margin:
                  "0 0 6px",
              }}
            >
              3D Cadastral Property Graph
            </h2>

            <p
              style={{
                color:
                  "#64748b",
                fontSize:
                  "14px",
                margin: 0,
              }}
            >
              Buildings, floors and
              property units are represented
              as nodes. Spatial and vertical
              relationships are represented
              as edges.
            </p>

          </div>


          <CadastralGraph />

        </div>
      )}


      {/* ==================================
          VALIDATION VIEW
          ================================== */}

      {view === "VALIDATION" && (

        <div
          style={{
            padding: "24px",
            background:
              "#f8fafc",
            minHeight:
              "700px",
          }}
        >

          <TopologyValidator />

        </div>
      )}

    </div>
  );
}