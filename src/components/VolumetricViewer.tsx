"use client";

import React, { useMemo, useState, useEffect, Suspense } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Html, Environment, ContactShadows } from "@react-three/drei";
import type { ParsedBuilding, Property2D } from "@/src/lib/parser/types";
import {
  getBuildingOrigin,
  normalizePolygon,
  getPolygonCenter,
} from "@/src/lib/coordinates";

// Global suppression for THREE.Clock & THREE.PCFSoftShadowMap deprecation warnings
if (typeof window !== "undefined") {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("THREE.Clock: This module has been deprecated") ||
        args[0].includes("THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated"))
    ) {
      return;
    }
    originalWarn(...args);
  };
}

// ==========================================
// ARCHITECTURAL MATERIAL & STYLE RESOLVER
// ==========================================

function getSpaceStyle(property: Property2D & { spaceType?: string }) {
  const name = (property.unitNumber || "").toLowerCase();
  const type = (property.spaceType || "").toLowerCase();

  if (name.includes("stair") || type.includes("stairs")) {
    return {
      fillColor: "#f97316", // Warm Architectural Amber
      wireColor: "#c2410c",
      label: "STAIRWELL 🪵",
      type: "stairs",
      opacity: 0.85,
    };
  }
  if (name.includes("lift") || name.includes("elevator") || type.includes("lift")) {
    return {
      fillColor: "#0284c7", // Bright Elevator Cyan
      wireColor: "#0369a1",
      label: "ELEVATOR CORE 🛗",
      type: "lift",
      opacity: 0.9,
    };
  }
  if (name.includes("passage") || name.includes("corridor") || type.includes("passage")) {
    return {
      fillColor: "#a855f7", // Corridor Purple
      wireColor: "#7e22ce",
      label: "CORRIDOR 🚶",
      type: "passage",
      opacity: 0.4,
    };
  }
  if (name.includes("w/c") || name.includes("toilet") || name.includes("ladies") || name.includes("gents")) {
    return {
      fillColor: "#ec4899", // Restroom Pink
      wireColor: "#be185d",
      label: "RESTROOM 🚻",
      type: "restroom",
      opacity: 0.7,
    };
  }
  return {
    fillColor: "#3b82f6", // Structural Architectural Blue
    wireColor: "#1e293b",
    label: property.unitNumber,
    type: "room",
    opacity: 0.35,
  };
}

// ==========================================
// MAIN 3D VOLUMETRIC VIEWER
// ==========================================

export default function VolumetricViewer({
  building,
  selectedPropertyId,
  onPropertySelect,
}: {
  building: ParsedBuilding;
  selectedPropertyId?: string | null;
  onPropertySelect?: (property: Property2D) => void;
}) {
  const [selected, setSelected] = useState<Property2D | null>(null);

  // Synchronize internal selection state
  useEffect(() => {
    if (!selectedPropertyId) {
      setSelected(null);
      return;
    }
    const match = building.floors
      .flatMap((f) => f.units)
      .find((u) => u.id === selectedPropertyId);
    setSelected(match || null);
  }, [selectedPropertyId, building]);

  const origin = useMemo(() => {
    const polygons = building.floors.flatMap((floor) =>
      floor.units.map((unit) => unit.polygon)
    );
    return getBuildingOrigin(polygons);
  }, [building]);

  const buildingSize = useMemo(() => {
    const polygons = building.floors.flatMap((floor) =>
      floor.units.map((unit) => unit.polygon)
    );
    const points = polygons.flat();
    if (!points.length) return 20;

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...ys) - Math.min(...ys);

    return Math.max(width, depth, 20);
  }, [building]);

  return (
    <div
      style={{
        width: "100%",
        height: "650px",
        position: "relative",
        background: "#f8fafc",
        borderRadius: "14px",
        overflow: "hidden",
        border: "1px solid #cbd5e1",
      }}
    >
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{
          position: [
            buildingSize * 1.5,
            buildingSize * 1.3,
            buildingSize * 1.6,
          ],
          fov: 42,
        }}
      >
        <color attach="background" args={["#f8fafc"]} />

        <ambientLight intensity={0.8} />
        <hemisphereLight
          args={["#ffffff", "#cbd5e1", 0.6]}
          position={[0, 50, 0]}
        />
        <directionalLight
          position={[30, 50, 25]}
          intensity={1.6}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-20, 20, -20]} intensity={0.5} />

        {/* Wrapped in Suspense to prevent canvas crashes on HDR texture download failures */}
        <Suspense fallback={null}>
          <Environment preset="city" />
        </Suspense>

        <group>
          {building.floors.map((floor) => (
            <group key={`floor-group-${floor.floorNumber}`}>
              <FloorSlab
                units={floor.units}
                elevation={floor.elevation}
                origin={origin}
              />

              {floor.units.map((unit) => (
                <PropertyVolume
                  key={unit.id}
                  property={unit}
                  elevation={floor.elevation}
                  height={floor.height}
                  origin={origin}
                  selected={selected?.id === unit.id}
                  onSelect={() => {
                    setSelected(unit);
                    onPropertySelect?.(unit);
                  }}
                />
              ))}
            </group>
          ))}
        </group>

        <ContactShadows
          position={[0, -0.06, 0]}
          opacity={0.4}
          scale={80}
          blur={1.5}
          far={10}
        />

        <Grid
          position={[0, -0.05, 0]}
          args={[
            Math.max(buildingSize * 2.5, 50),
            Math.max(buildingSize * 2.5, 50),
          ]}
          cellSize={1}
          cellThickness={0.6}
          cellColor="#cbd5e1"
          sectionSize={5}
          sectionThickness={1.2}
          sectionColor="#94a3b8"
          fadeDistance={90}
          fadeStrength={1}
          infiniteGrid
        />

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={Math.max(buildingSize * 0.4, 6)}
          maxDistance={Math.max(buildingSize * 8, 70)}
        />
      </Canvas>

      {/* HEADER OVERLAY */}
      <div
        style={{
          position: "absolute",
          top: "18px",
          left: "18px",
          padding: "12px 16px",
          borderRadius: "9px",
          background: "rgba(255, 255, 255, 0.95)",
          border: "1px solid #cbd5e1",
          boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
          backdropFilter: "blur(6px)",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            color: "#2563eb",
            fontWeight: 800,
            letterSpacing: "0.8px",
          }}
        >
          3D CADASTRAL MODEL
        </div>
        <div
          style={{
            marginTop: "3px",
            fontSize: "17px",
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          {building.name}
        </div>
      </div>

      {/* SELECTED PROPERTY PANEL */}
      {selected && (
        <div
          style={{
            position: "absolute",
            right: "18px",
            top: "18px",
            width: "260px",
            padding: "18px",
            borderRadius: "11px",
            background: "rgba(255, 255, 255, 0.98)",
            border: "1.5px solid #2563eb",
            boxShadow: "0 8px 25px rgba(0,0,0,0.12)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              fontWeight: 800,
              color: "#2563eb",
              letterSpacing: "0.7px",
            }}
          >
            SELECTED PROPERTY
          </div>

          <div
            style={{
              marginTop: "5px",
              fontSize: "20px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            {selected.unitNumber}
          </div>

          <div
            style={{
              marginTop: "16px",
              display: "grid",
              gap: "10px",
            }}
          >
            <PropertyInfo label="Property ID" value={selected.id} />
            <PropertyInfo label="Floor Level" value={`Floor ${selected.floorNumber}`} />
            <PropertyInfo label="Usable Area" value={`${selected.area} m²`} />
            <PropertyInfo label="Clear Height" value="3.2 m" />
            <PropertyInfo
              label="3D ULPIN Identifier"
              value={
                selected.ulpin ||
                `3D-${building.id}-F${String(selected.floorNumber).padStart(2, "0")}-${selected.unitNumber}`
              }
            />
          </div>

          <button
            onClick={() => setSelected(null)}
            style={{
              width: "100%",
              marginTop: "16px",
              padding: "8px",
              borderRadius: "7px",
              border: "1px solid #cbd5e1",
              background: "#f1f5f9",
              color: "#0f172a",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Close Inspector
          </button>
        </div>
      )}

      {!selected && (
        <div
          style={{
            position: "absolute",
            bottom: "18px",
            left: "18px",
            padding: "8px 12px",
            borderRadius: "7px",
            background: "rgba(255, 255, 255, 0.92)",
            border: "1px solid #cbd5e1",
            fontSize: "11px",
            color: "#475569",
          }}
        >
          Click any 3D parcel volume or stairwell to inspect its vertical 3D ULPIN data.
        </div>
      )}
    </div>
  );
}

function FloorSlab({
  units,
  elevation,
  origin,
}: {
  units: Property2D[];
  elevation: number;
  origin: { x: number; y: number };
}) {
  const slabShape = useMemo(() => {
    const allPoints = units.flatMap((u) => normalizePolygon(u.polygon, origin));
    if (!allPoints.length) return null;

    const xs = allPoints.map((p) => p.x);
    const ys = allPoints.map((p) => p.y);

    const minX = Math.min(...xs) - 0.2;
    const maxX = Math.max(...xs) + 0.2;
    const minY = Math.min(...ys) - 0.2;
    const maxY = Math.max(...ys) + 0.2;

    const shape = new THREE.Shape();
    shape.moveTo(minX, minY);
    shape.lineTo(maxX, minY);
    shape.lineTo(maxX, maxY);
    shape.lineTo(minX, maxY);
    shape.closePath();

    return { shape, minX, maxX, minY, maxY };
  }, [units, origin]);

  if (!slabShape) return null;

  return (
    <group position={[0, elevation, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh receiveShadow>
        <extrudeGeometry args={[slabShape.shape, { depth: 0.15, bevelEnabled: false }]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
      </mesh>
    </group>
  );
}

function PropertyVolume({
  property,
  elevation,
  height,
  origin,
  selected,
  onSelect,
}: {
  property: Property2D & { spaceType?: string };
  elevation: number;
  height: number;
  origin: { x: number; y: number };
  selected: boolean;
  onSelect: () => void;
}) {
  const polygon = useMemo(() => {
    return normalizePolygon(property.polygon, origin);
  }, [property.polygon, origin]);

  const center = useMemo(() => {
    return getPolygonCenter(polygon);
  }, [polygon]);

  const style = useMemo(() => getSpaceStyle(property), [property]);

  const { widthX, depthY } = useMemo(() => {
    const xs = polygon.map((p) => p.x);
    const ys = polygon.map((p) => p.y);
    return {
      widthX: Math.max(...xs) - Math.min(...xs),
      depthY: Math.max(...ys) - Math.min(...ys),
    };
  }, [polygon]);

  const geometry = useMemo(() => {
    if (polygon.length < 3) return null;

    const shape = new THREE.Shape();
    polygon.forEach((point, index) => {
      if (index === 0) {
        shape.moveTo(point.x - center.x, point.y - center.y);
      } else {
        shape.lineTo(point.x - center.x, point.y - center.y);
      }
    });
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
      steps: 1,
    });

    geo.center();
    return geo;
  }, [polygon, center, height]);

  if (!geometry) return null;

  return (
    <group position={[center.x, elevation + height / 2, center.y]}>
      {style.type === "stairs" && (
        <StairStepsMesh
          width={widthX}
          depth={depthY}
          height={height}
          color={style.fillColor}
        />
      )}

      {style.type === "lift" && (
        <ElevatorShaftMesh
          width={widthX}
          depth={depthY}
          height={height}
          color={style.fillColor}
        />
      )}

      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh
          geometry={geometry}
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={selected ? "#f59e0b" : style.fillColor}
            transparent
            opacity={selected ? 0.85 : style.opacity}
            roughness={0.2}
            metalness={0.1}
          />
        </mesh>

        <lineSegments
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
        >
          <edgesGeometry attach="geometry" args={[geometry]} />
          <lineBasicMaterial
            color={selected ? "#d97706" : style.wireColor}
            linewidth={selected ? 2.5 : 1.2}
          />
        </lineSegments>
      </group>

      {(selected || style.type === "stairs" || style.type === "lift") && (
        <Html position={[0, height / 2 + 0.6, 0]} center distanceFactor={22}>
          <div
            style={{
              padding: "4px 8px",
              background: "#ffffff",
              border: `1.5px solid ${selected ? "#d97706" : style.fillColor}`,
              borderRadius: "5px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              whiteSpace: "nowrap",
              fontSize: "10px",
              fontWeight: 800,
              color: "#0f172a",
              pointerEvents: "none",
            }}
          >
            {style.label}
          </div>
        </Html>
      )}
    </group>
  );
}

function StairStepsMesh({
  width,
  depth,
  height,
  color,
}: {
  width: number;
  depth: number;
  height: number;
  color: string;
}) {
  const stepCount = 8;
  const stepHeight = height / stepCount;
  const stepDepth = depth / stepCount;

  return (
    <group position={[0, -height / 2, 0]}>
      {Array.from({ length: stepCount }).map((_, i) => (
        <mesh
          key={`stair-step-${i}`}
          position={[
            0,
            i * stepHeight + stepHeight / 2,
            -depth / 2 + i * stepDepth + stepDepth / 2,
          ]}
        >
          <boxGeometry args={[width * 0.9, stepHeight, stepDepth]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function ElevatorShaftMesh({
  width,
  depth,
  height,
  color,
}: {
  width: number;
  depth: number;
  height: number;
  color: string;
}) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[width * 0.7, height * 0.8, depth * 0.7]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

function PropertyInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: "9px",
          color: "#64748b",
          fontWeight: 700,
          letterSpacing: "0.3px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: "2px",
          fontSize: "12px",
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