"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Html, Environment, ContactShadows } from "@react-three/drei";

import type { ParsedBuilding, Property2D } from "@/src/lib/parser/types";
import { getPolygonCenter } from "@/src/lib/coordinates";

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

export default function PropertyInspectionPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params?.id as string;

  const [building, setBuilding] = useState<ParsedBuilding | null>(null);
  const [property, setProperty] = useState<Property2D | null>(null);

  // Load building context and active property unit
  useEffect(() => {
    const cachedData = sessionStorage.getItem("activeBuildingData");
    if (cachedData) {
      try {
        const parsedBuilding: ParsedBuilding = JSON.parse(cachedData);
        setBuilding(parsedBuilding);

        const match = parsedBuilding.floors
          .flatMap((f) => f.units)
          .find((u) => u.id === propertyId);

        if (match) {
          setProperty(match);
        }
      } catch (e) {
        console.error("Error restoring cached building data:", e);
      }
    }
  }, [propertyId]);

  // Extract all property units across all floor levels for toggling
  const allUnits = useMemo(() => {
    if (!building?.floors) return [];
    return building.floors.flatMap((floor) =>
      floor.units.map((unit) => ({
        ...unit,
        floorNumber: floor.floorNumber,
      }))
    );
  }, [building]);

  // Find index of current property to calculate Next / Previous units
  const currentIndex = useMemo(() => {
    return allUnits.findIndex((u) => u.id === propertyId);
  }, [allUnits, propertyId]);

  const prevUnit = currentIndex > 0 ? allUnits[currentIndex - 1] : null;
  const nextUnit = currentIndex < allUnits.length - 1 ? allUnits[currentIndex + 1] : null;

  const handleUnitToggle = (targetId: string) => {
    router.push(`/properties/${targetId}`);
  };

  if (!property) {
    return (
      <div
        style={{
          minHeight: "100vh",
          maxWidth: "100vw",
          overflowX: "hidden",
          background: "#090d16",
          color: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          fontFamily: "system-ui, sans-serif",
          boxSizing: "border-box",
        }}
      >
        <h2>Loading 3D Cadastral Unit...</h2>
        <Link
          href="/"
          style={{
            marginTop: "12px",
            color: "#3b82f6",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 700,
          }}
        >
          ← Back to Main Dashboard
        </Link>
      </div>
    );
  }

  const elevation = (property.floorNumber - 1) * 3.2;
  const height = 3.2;

  return (
    <main
      style={{
        minHeight: "100vh",
        maxWidth: "100vw",
        overflowX: "hidden",
        background: "#090d16",
        color: "#f8fafc",
        padding: "32px",
        fontFamily: "system-ui, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* TOP NAVIGATION BAR WITH QUICK DROPDOWN TOGGLE */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <Link
          href="/"
          style={{
            color: "#3b82f6",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 700,
          }}
        >
          ← Back to Main Dashboard
        </Link>

        {/* QUICK UNIT SELECTOR DROPDOWN */}
        {allUnits.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 700 }}>
              Select Parcel:
            </label>
            <select
              value={property.id}
              onChange={(e) => handleUnitToggle(e.target.value)}
              style={{
                background: "#0f172a",
                color: "#f8fafc",
                border: "1px solid #334155",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                outline: "none",
              }}
            >
              {allUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  Unit {u.unitNumber} (Floor {u.floorNumber})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* HEADER SECTION WITH PREV / NEXT UNIT BUTTONS */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "28px",
          flexWrap: "wrap",
          gap: "16px",
          background: "rgba(15, 23, 42, 0.6)",
          padding: "20px",
          borderRadius: "14px",
          border: "1px solid #1e293b",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "11px",
              color: "#38bdf8",
              fontWeight: 800,
              letterSpacing: "0.8px",
              marginBottom: "4px",
            }}
          >
            PARCEL {currentIndex + 1} OF {allUnits.length}
          </div>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800 }}>
            Property Unit Inspection: {property.unitNumber}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#94a3b8" }}>
            3D Cadastral Volumetric Rights & Parcel Details
          </p>
        </div>

        {/* TOGGLE BUTTONS */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            disabled={!prevUnit}
            onClick={() => prevUnit && handleUnitToggle(prevUnit.id)}
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid #334155",
              background: prevUnit ? "#1e293b" : "rgba(30, 41, 59, 0.3)",
              color: prevUnit ? "#ffffff" : "#64748b",
              fontWeight: 700,
              fontSize: "12px",
              cursor: prevUnit ? "pointer" : "not-allowed",
              transition: "all 0.15s ease",
            }}
          >
            ← Previous Unit
          </button>

          <button
            type="button"
            disabled={!nextUnit}
            onClick={() => nextUnit && handleUnitToggle(nextUnit.id)}
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              border: "none",
              background: nextUnit ? "#2563eb" : "rgba(37, 99, 235, 0.3)",
              color: nextUnit ? "#ffffff" : "#94a3b8",
              fontWeight: 700,
              fontSize: "12px",
              cursor: nextUnit ? "pointer" : "not-allowed",
              transition: "all 0.15s ease",
            }}
          >
            Next Unit →
          </button>
        </div>
      </div>

      {/* TOP METRIC CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "18px",
          marginBottom: "28px",
        }}
      >
        <MetricCard label="Unit Number" value={property.unitNumber} />
        <MetricCard label="Floor Level" value={`Floor ${property.floorNumber}`} />
        <MetricCard label="Calculated Surface Area" value={`${property.area} m²`} />
        <MetricCard
          label="3D ULPIN ID"
          value={
            property.ulpin ||
            `14-4012-0001-3D-F0${property.floorNumber}-${property.unitNumber}`
          }
        />
      </div>

      {/* MAIN CONTENT GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: "24px",
          width: "100%",
          minWidth: 0,
        }}
      >
        {/* LEFT COLUMN: ISOLATED 3D UNIT MODEL */}
        <section
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid #1e293b",
            borderRadius: "14px",
            padding: "20px",
            backdropFilter: "blur(8px)",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ fontSize: "16px", fontWeight: 800, color: "#f8fafc", marginBottom: "4px" }}>
            3D Volumetric Parcel Model
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "16px" }}>
            Isolated 3D extrusion showing spatial volume and floor elevation.
          </div>

          <div
            style={{
              width: "100%",
              height: "450px",
              maxHeight: "450px",
              position: "relative",
              borderRadius: "10px",
              overflow: "hidden",
              border: "1px solid #334155",
              background: "#020617",
            }}
          >
            <SingleUnit3DViewer
              key={property.id}
              polygon={property.polygon}
              elevation={elevation}
              height={height}
              unitNumber={property.unitNumber}
            />
          </div>
        </section>

        {/* RIGHT COLUMN: SPATIAL GEOMETRY & CLASSIFICATION */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", minWidth: 0 }}>
          <section
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid #1e293b",
              borderRadius: "14px",
              padding: "20px",
              backdropFilter: "blur(8px)",
            }}
          >
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#f8fafc" }}>
              Spatial Geometry Coordinates (WGS84 Projection)
            </div>

            <pre
              style={{
                marginTop: "14px",
                padding: "16px",
                background: "#020617",
                border: "1px solid #1e293b",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#38bdf8",
                maxHeight: "220px",
                overflowY: "auto",
                fontFamily: "monospace",
              }}
            >
              {JSON.stringify(property.polygon, null, 2)}
            </pre>
          </section>

          <section
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid #1e293b",
              borderRadius: "14px",
              padding: "20px",
              backdropFilter: "blur(8px)",
            }}
          >
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#f8fafc", marginBottom: "14px" }}>
              Property Classification
            </div>

            <div style={{ display: "grid", gap: "12px" }}>
              <DetailRow
                label="Parent Structure"
                value={building?.name || "5_Storey_Cadastral_Building"}
              />
              <DetailRow label="Legal Status" value="Verified Cadastral Unit" />
              <DetailRow
                label="Vertical Height Bounds"
                value={`${height.toFixed(2)} Meters`}
              />
              <DetailRow label="3D Rights Type" value="Volumetric Ownership" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function SingleUnit3DViewer({
  polygon,
  elevation,
  height,
  unitNumber,
}: {
  polygon: { x: number; y: number }[];
  elevation: number;
  height: number;
  unitNumber: string;
}) {
  const center = useMemo(() => getPolygonCenter(polygon), [polygon]);

  const geometry = useMemo(() => {
    if (!polygon || polygon.length < 3) return null;

    const shape = new THREE.Shape();
    polygon.forEach((pt, idx) => {
      if (idx === 0) shape.moveTo(pt.x - center.x, pt.y - center.y);
      else shape.lineTo(pt.x - center.x, pt.y - center.y);
    });
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
    });
    geo.center();
    return geo;
  }, [polygon, center, height]);

  if (!geometry) return null;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ position: [15, 12, 18], fov: 40 }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <color attach="background" args={["#020617"]} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[15, 25, 15]} intensity={1.5} castShadow />
        <Environment preset="city" />

        <group position={[0, 0, 0]}>
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <mesh geometry={geometry} castShadow receiveShadow>
              <meshStandardMaterial
                color="#2563eb"
                transparent
                opacity={0.8}
                roughness={0.2}
                metalness={0.1}
              />
            </mesh>

            <lineSegments>
              <edgesGeometry attach="geometry" args={[geometry]} />
              <lineBasicMaterial color="#ffffff" linewidth={2} />
            </lineSegments>
          </group>

          <Html position={[0, height / 2 + 0.8, 0]} center distanceFactor={18}>
            <div
              style={{
                padding: "6px 12px",
                background: "#2563eb",
                border: "1px solid #ffffff",
                borderRadius: "6px",
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: 800,
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                whiteSpace: "nowrap",
              }}
            >
              PARCEL {unitNumber}
            </div>
          </Html>
        </group>

        <ContactShadows position={[0, -height / 2 - 0.05, 0]} opacity={0.5} scale={30} blur={1} />
        <Grid position={[0, -height / 2 - 0.06, 0]} args={[40, 40]} cellColor="#1e293b" sectionColor="#334155" />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      </Canvas>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "rgba(15, 23, 42, 0.6)",
        border: "1px solid #1e293b",
        borderRadius: "12px",
        padding: "18px",
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: "20px", fontWeight: 800, color: "#f8fafc", marginTop: "6px" }}>
        {value}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 16px",
        background: "#020617",
        border: "1px solid #1e293b",
        borderRadius: "8px",
      }}
    >
      <span style={{ fontSize: "12px", color: "#94a3b8" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: 700, color: "#f8fafc" }}>{value}</span>
    </div>
  );
}