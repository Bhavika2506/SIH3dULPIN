"use client";

import React, {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Grid,
  Html,
  OrbitControls,
} from "@react-three/drei";

import type {
  ParsedBuilding,
  Property2D,
} from "@/src/lib/parser/types";

import {
  getBuildingOrigin,
  getPolygonCenter,
  normalizePolygon,
} from "@/src/lib/coordinates";

// ============================================================
// TYPES
// ============================================================

type Point2DLike = {
  x: number;
  y: number;
};

type StyledProperty = Property2D & {
  spaceType?: string;
  heightMeters?: number;
  elevationMeters?: number;
};

type SceneTransform = {
  geographic: boolean;
  originX: number;
  originY: number;
  cos: number;
  sin: number;
  unitLabel: string;
};

const EARTH_RADIUS = 6378137;
const DEFAULT_FLOOR_HEIGHT = 3.2;

// ============================================================
// GEOGRAPHIC DETECTION & RIGID TRANSFORM
// ============================================================

function isWgs84Point(point: Point2DLike): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return false;
  }
  return Math.abs(point.x) <= 180 && Math.abs(point.y) <= 90;
}

function isPassageProperty(property: StyledProperty): boolean {
  const name = String(property.unitNumber || "").toLowerCase();
  const type = String(property.spaceType || "").toLowerCase();

  return (
    name.includes("passage") ||
    name.includes("corridor") ||
    type.includes("passage") ||
    type.includes("corridor")
  );
}

function getAllBuildingPoints(building: ParsedBuilding): Point2DLike[] {
  return building.floors.flatMap((floor) =>
    floor.units.flatMap((unit) => unit.polygon)
  );
}

function isGeographicModel(points: Point2DLike[]): boolean {
  if (!points.length) return false;
  const geographicCount = points.filter(isWgs84Point).length;
  return geographicCount / points.length >= 0.8;
}

function geographicToMeters(
  lng: number,
  lat: number,
  originLng: number,
  originLat: number
): Point2DLike {
  const latRadians = (originLat * Math.PI) / 180;
  const metersPerDegreeLat = (Math.PI * EARTH_RADIUS) / 180;
  const metersPerDegreeLng =
    metersPerDegreeLat * Math.cos(latRadians);

  return {
    x: (lng - originLng) * metersPerDegreeLng,
    y: (lat - originLat) * metersPerDegreeLat,
  };
}

function getDominantEdgeAngle(points: Point2DLike[]): number {
  if (points.length < 2) return 0;

  let sinSum = 0;
  let cosSum = 0;

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);

    if (len > 0.5) {
      let angle = Math.atan2(dy, dx);
      sinSum += Math.sin(2 * angle) * len;
      cosSum += Math.cos(2 * angle) * len;
    }
  }

  if (Math.hypot(sinSum, cosSum) < 1e-6) return 0;

  let angle = 0.5 * Math.atan2(sinSum, cosSum);
  while (angle > Math.PI / 4) angle -= Math.PI / 2;
  while (angle < -Math.PI / 4) angle += Math.PI / 2;

  return angle;
}

function buildSceneTransform(building: ParsedBuilding): SceneTransform {
  const sourcePoints = getAllBuildingPoints(building);

  if (!sourcePoints.length) {
    return {
      geographic: false,
      originX: 0,
      originY: 0,
      cos: 1,
      sin: 0,
      unitLabel: "scene units",
    };
  }

  const passageUnits = building.floors.flatMap((f) =>
    f.units.filter((u) => isPassageProperty(u as StyledProperty))
  );
  const passagePoints = passageUnits.flatMap((u) => u.polygon);
  const referencePoints =
    passagePoints.length > 0 ? passagePoints : sourcePoints;

  const geographic = isGeographicModel(sourcePoints);

  if (geographic) {
    const originX =
      sourcePoints.reduce((sum, point) => sum + point.x, 0) /
      sourcePoints.length;
    const originY =
      sourcePoints.reduce((sum, point) => sum + point.y, 0) /
      sourcePoints.length;

    const localRefPoints = referencePoints.map((point) =>
      geographicToMeters(point.x, point.y, originX, originY)
    );

    const angle = getDominantEdgeAngle(localRefPoints);

    return {
      geographic: true,
      originX,
      originY,
      cos: Math.cos(angle),
      sin: Math.sin(angle),
      unitLabel: "m",
    };
  }

  const originX =
    sourcePoints.reduce((sum, point) => sum + point.x, 0) /
    sourcePoints.length;
  const originY =
    sourcePoints.reduce((sum, point) => sum + point.y, 0) /
    sourcePoints.length;

  const localRefPoints = referencePoints.map((point) => ({
    x: point.x - originX,
    y: point.y - originY,
  }));

  const angle = getDominantEdgeAngle(localRefPoints);

  return {
    geographic: false,
    originX,
    originY,
    cos: Math.cos(angle),
    sin: Math.sin(angle),
    unitLabel: "scene units",
  };
}

function transformPointToScene(
  point: Point2DLike,
  transform: SceneTransform
): Point2DLike {
  let local: Point2DLike;

  if (transform.geographic) {
    local = geographicToMeters(
      point.x,
      point.y,
      transform.originX,
      transform.originY
    );
  } else {
    local = {
      x: point.x - transform.originX,
      y: point.y - transform.originY,
    };
  }

  return {
    x: local.x * transform.cos + local.y * transform.sin,
    y: -local.x * transform.sin + local.y * transform.cos,
  };
}

function convertPolygonToScene(
  polygon: Point2DLike[],
  transform: SceneTransform
): Point2DLike[] {
  if (!polygon || polygon.length < 3) return [];

  return polygon.map((point) =>
    transformPointToScene(point, transform)
  );
}

// ============================================================
// SPACE STYLE
// ============================================================

function getSpaceStyle(property: StyledProperty) {
  const name = (property.unitNumber || "").toLowerCase();
  const type = (property.spaceType || "").toLowerCase();

  if (name.includes("stair") || type.includes("stair")) {
    return {
      fillColor: "#f97316",
      wireColor: "#c2410c",
      label: property.unitNumber || "STAIRWELL",
      type: "stairs",
      opacity: 0.85,
    };
  }

  if (
    name.includes("lift") ||
    name.includes("elevator") ||
    type.includes("lift") ||
    type.includes("elevator")
  ) {
    return {
      fillColor: "#06b6d4",
      wireColor: "#0e7490",
      label: property.unitNumber || "ELEVATOR",
      type: "lift",
      opacity: 0.85,
    };
  }

  if (
    name.includes("passage") ||
    name.includes("corridor") ||
    type.includes("passage") ||
    type.includes("corridor")
  ) {
    return {
      fillColor: "#ffffff",
      wireColor: "#94a3b8",
      label: property.unitNumber || "CORRIDOR",
      type: "passage",
      opacity: 0.35,
    };
  }

  if (
    name.includes("w/c") ||
    name.includes("toilet") ||
    name.includes("ladies") ||
    name.includes("gents") ||
    type.includes("restroom") ||
    type.includes("toilet")
  ) {
    return {
      fillColor: "#ec4899",
      wireColor: "#be185d",
      label: property.unitNumber || "RESTROOM",
      type: "restroom",
      opacity: 0.7,
    };
  }

  if (
    type.includes("hall") ||
    name.includes("hall") ||
    name.includes("canteen") ||
    type.includes("entrance")
  ) {
    return {
      fillColor: "#eab308",
      wireColor: "#ca8a04",
      label: property.unitNumber || "HALL",
      type: "hall",
      opacity: 0.55,
    };
  }

  if (type.includes("lab") || name.includes("lab")) {
    return {
      fillColor: "#3b82f6",
      wireColor: "#1d4ed8",
      label: property.unitNumber || "LAB",
      type: "lab",
      opacity: 0.5,
    };
  }

  if (
    type.includes("office") ||
    name.includes("office") ||
    name.includes("cell")
  ) {
    return {
      fillColor: "#10b981",
      wireColor: "#047857",
      label: property.unitNumber || "OFFICE",
      type: "office",
      opacity: 0.5,
    };
  }

  return {
    fillColor: "#3b82f6",
    wireColor: "#1e3a8a",
    label: property.unitNumber || "UNIT",
    type: "room",
    opacity: 0.48,
  };
}

// ============================================================
// MAIN VIEWER
// ============================================================

export default function VolumetricViewer({
  building,
  selectedPropertyId,
  onPropertySelect,
  isInspectorClosed: propIsInspectorClosed,
  onInspectorCloseChange,
}: {
  building: ParsedBuilding;
  selectedPropertyId?: string | null;
  onPropertySelect?: (property: Property2D) => void;
  isInspectorClosed?: boolean;
  onInspectorCloseChange?: (closed: boolean) => void;
}) {
  const [selected, setSelected] = useState<Property2D | null>(null);
  const [internalIsInspectorClosed, setInternalIsInspectorClosed] =
    useState<boolean>(false);

  const isInspectorClosed = propIsInspectorClosed ?? internalIsInspectorClosed;

  const setIsInspectorClosed = (closed: boolean) => {
    setInternalIsInspectorClosed(closed);
    onInspectorCloseChange?.(closed);
  };

  const isIsolated = Boolean(selected);

  // ----------------------------------------------------------
  // Build ONE transform for the COMPLETE source model.
  // ----------------------------------------------------------

  const sceneTransform = useMemo(
    () => buildSceneTransform(building),
    [building]
  );

  const sceneBuilding = useMemo(() => {
    return building.floors.map((floor) => ({
      ...floor,
      units: floor.units.map((unit) => ({
        ...unit,
        polygon: convertPolygonToScene(unit.polygon, sceneTransform),
      })),
    }));
  }, [building, sceneTransform]);

  // ----------------------------------------------------------
  // All scene polygons & centering
  // ----------------------------------------------------------

  const polygons = useMemo(() => {
    return sceneBuilding.flatMap((floor) =>
      floor.units
        .map((unit) => unit.polygon)
        .filter((polygon) => polygon.length >= 3)
    );
  }, [sceneBuilding]);

  const origin = useMemo(
    () => getBuildingOrigin(polygons),
    [polygons]
  );

  const centeredBuilding = useMemo(() => {
    return sceneBuilding.map((floor) => ({
      ...floor,
      units: floor.units.map((unit) => ({
        ...unit,
        polygon: normalizePolygon(unit.polygon, origin),
      })),
    }));
  }, [sceneBuilding, origin]);

  // ----------------------------------------------------------
  // Dimensions
  // ----------------------------------------------------------

  const dimensions = useMemo(() => {
    const points = centeredBuilding.flatMap((floor) =>
      floor.units.flatMap((unit) => unit.polygon)
    );

    if (!points.length) {
      return {
        width: 10,
        depth: 10,
        diagonal: Math.sqrt(200),
      };
    }

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...ys) - Math.min(...ys);

    const safeWidth = Math.max(width, 1);
    const safeDepth = Math.max(depth, 1);

    return {
      width: safeWidth,
      depth: safeDepth,
      diagonal: Math.sqrt(safeWidth * safeWidth + safeDepth * safeDepth),
    };
  }, [centeredBuilding]);

  // ----------------------------------------------------------
  // Selected Property 3D Position & Size
  // ----------------------------------------------------------

  const controlsRef = React.useRef<any>(null);

  const selectedUnitDetails = useMemo(() => {
    if (!selected) return null;
    for (const floor of centeredBuilding) {
      const match = floor.units.find((u) => u.id === selected.id);
      if (match) {
        const elevation = Number(floor.elevation) || 0;
        const center = getPolygonCenter(match.polygon);
        const height =
          Number((match as StyledProperty).heightMeters) ||
          Number(floor.height) ||
          DEFAULT_FLOOR_HEIGHT;

        const xs = match.polygon.map((p) => p.x);
        const ys = match.polygon.map((p) => p.y);
        const w = xs.length ? Math.max(...xs) - Math.min(...xs) : 1;
        const d = ys.length ? Math.max(...ys) - Math.min(...ys) : 1;
        const diag = Math.sqrt(w * w + d * d);

        return {
          position: [center.x, elevation + height / 2, center.y] as [
            number,
            number,
            number,
          ],
          size: Math.max(diag, height, 5),
        };
      }
    }
    return null;
  }, [selected, centeredBuilding]);

  const selectedUnitPosition = selectedUnitDetails?.position || null;
  const selectedUnitSize = selectedUnitDetails?.size || 10;

  // ----------------------------------------------------------
  // Total vertical height
  // ----------------------------------------------------------

  const totalHeight = useMemo(() => {
    if (!centeredBuilding.length) {
      return 16;
    }

    return Math.max(
      ...centeredBuilding.map(
        (floor) =>
          Number(floor.elevation ?? 0) +
          Number(floor.height || DEFAULT_FLOOR_HEIGHT)
      ),
      16
    );
  }, [centeredBuilding]);

  const controlsTarget = useMemo(() => {
    if (isIsolated && selectedUnitPosition) {
      return selectedUnitPosition;
    }
    return [0, totalHeight / 2, 0] as [number, number, number];
  }, [isIsolated, selectedUnitPosition, totalHeight]);

  // ----------------------------------------------------------
  // Selection
  // ----------------------------------------------------------

  useEffect(() => {
    if (!selectedPropertyId) {
      setSelected((prev) => (prev === null ? prev : null));
      return;
    }

    const match = building.floors
      .flatMap((floor) => floor.units)
      .find((unit) => String(unit.id) === String(selectedPropertyId));

    setSelected((prev) => {
      if (prev?.id !== match?.id && match) {
        setIsInspectorClosed(false);
      }
      return match || null;
    });
  }, [selectedPropertyId, building]);

  // ----------------------------------------------------------
  // Camera
  // ----------------------------------------------------------

  const cameraPosition = useMemo(() => {
    const horizontal = Math.max(dimensions.diagonal * 1.3, 45);

    return [
      horizontal,
      Math.max(totalHeight * 1.15, dimensions.depth, 24),
      horizontal,
    ] as [number, number, number];
  }, [dimensions, totalHeight]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(
        controlsTarget[0],
        controlsTarget[1],
        controlsTarget[2]
      );

      if (isIsolated && selectedUnitPosition) {
        const offset = Math.max(selectedUnitSize * 1.8, 12);
        const objectRef = controlsRef.current.object;
        if (objectRef) {
          objectRef.position.set(
            selectedUnitPosition[0] + offset,
            selectedUnitPosition[1] + offset * 0.7,
            selectedUnitPosition[2] + offset
          );
        }
      } else if (!isIsolated) {
        const objectRef = controlsRef.current.object;
        if (objectRef) {
          objectRef.position.set(
            cameraPosition[0],
            cameraPosition[1],
            cameraPosition[2]
          );
        }
      }

      controlsRef.current.update();
    }
  }, [
    controlsTarget,
    isIsolated,
    selectedUnitPosition,
    selectedUnitSize,
    cameraPosition,
  ]);

  const hasGeometry = centeredBuilding.some((floor) =>
    floor.units.some((unit) => unit.polygon.length >= 3)
  );

  return (
    <div
      style={{
        width: "100%",
        height: "650px",
        position: "relative",
        overflow: "hidden",
        borderRadius: "14px",
        border: "1px solid #cbd5e1",
        background: "#ffffff",
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          position: cameraPosition,
          fov: 42,
          near: 0.1,
          far: 5000,
        }}
      >
        {/* =================================================
            BACKGROUND
        ================================================= */}

        <color attach="background" args={["#ffffff"]} />

        {/* =================================================
            LIGHTING
        ================================================= */}

        <ambientLight intensity={0.86} />

        <hemisphereLight
          args={["#ffffff", "#cbd5e1", 0.62]}
          position={[0, 80, 0]}
        />

        <directionalLight
          position={[dimensions.width, totalHeight * 2, dimensions.depth]}
          intensity={1.65}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />

        <pointLight
          position={[-dimensions.width, totalHeight, -dimensions.depth]}
          intensity={0.42}
        />

        <Suspense fallback={null}>
          <Environment preset="city" />
        </Suspense>

        {/* =================================================
            BUILDING
        ================================================= */}

        {hasGeometry && (
          <group>
            {centeredBuilding.map((floor) => {
              const elevation = Number(floor.elevation) || 0;
              const floorHeight =
                Number(floor.height) || DEFAULT_FLOOR_HEIGHT;

              const visibleUnits = isIsolated
                ? floor.units.filter((unit) => unit.id === selected?.id)
                : floor.units;

              if (visibleUnits.length === 0) return null;

              return (
                <group key={`floor-${floor.floorNumber}`}>
                  {visibleUnits.map((unit) => (
                    <PropertyVolume
                      key={unit.id}
                      property={unit as StyledProperty}
                      elevation={elevation}
                      height={
                        Number(
                          (unit as StyledProperty).heightMeters
                        ) || floorHeight
                      }
                      selected={selected?.id === unit.id}
                      onSelect={() => {
                        setSelected(unit);
                        onPropertySelect?.(unit);
                      }}
                    />
                  ))}
                </group>
              );
            })}
          </group>
        )}

        {/* =================================================
            GROUND
        ================================================= */}

        <ContactShadows
          position={[0, -0.08, 0]}
          opacity={0.34}
          scale={Math.max(dimensions.diagonal * 2.4, 90)}
          blur={1.6}
          far={Math.max(totalHeight * 2, 35)}
        />

        <Grid
          position={[0, -0.1, 0]}
          args={[
            Math.max(dimensions.width * 2.8, 70),
            Math.max(dimensions.depth * 3.8, 70),
          ]}
          cellSize={1}
          cellThickness={0.55}
          cellColor="#cbd5e1"
          sectionSize={5}
          sectionThickness={1.1}
          sectionColor="#94a3b8"
          fadeDistance={120}
          fadeStrength={1}
          infiniteGrid
        />

        {/* =================================================
            CONTROLS
        ================================================= */}

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.7}
          zoomSpeed={0.85}
          panSpeed={0.7}
          minDistance={Math.max(dimensions.diagonal * 0.24, 7)}
          maxDistance={Math.max(dimensions.diagonal * 7, 140)}
          minPolarAngle={0.12}
          maxPolarAngle={Math.PI / 2 - 0.03}
          target={controlsTarget}
        />
      </Canvas>

      {/* ======================================================
          HEADER & ISOLATION BANNER
      ====================================================== */}

      <div
        style={{
          position: "absolute",
          top: "18px",
          left: "18px",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "9px",
            background: "rgba(255, 255, 255, 0.96)",
            border: "1px solid #cbd5e1",
            boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
            backdropFilter: "blur(6px)",
            color: "#0f172a",
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

          <div
            style={{
              marginTop: "4px",
              fontSize: "10px",
              color: "#64748b",
            }}
          >
            {dimensions.width.toFixed(1)}
            {sceneTransform.unitLabel} × {dimensions.depth.toFixed(1)}
            {sceneTransform.unitLabel} × {totalHeight.toFixed(1)}
            {sceneTransform.unitLabel}
          </div>
        </div>

        {isIsolated && selected && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "9px",
              background: "rgba(255, 255, 255, 0.96)",
              border: "1.5px solid #2d6a4f",
              boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: "#0f172a",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "#2d6a4f",
                }}
              >
                ISOLATED 3D UNIT VIEW
              </div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                Unit {selected.unitNumber}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsInspectorClosed(true);
              }}
              style={{
                padding: "5px 10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "#f1f5f9",
                color: "#0f172a",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              Hide Inspector
            </button>
          </div>
        )}
      </div>

      {/* ======================================================
          EMPTY STATE
      ====================================================== */}

      {!hasGeometry && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.96)",
              border: "1px solid #f59e0b",
              color: "#92400e",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            No valid cadastral polygon geometry was received.
          </div>
        </div>
      )}

      {/* ======================================================
          SELECTED PROPERTY
      ====================================================== */}

      {selected && !isInspectorClosed && (
        <div
          style={{
            position: "absolute",
            top: "18px",
            right: "18px",
            zIndex: 20,
            width: "280px",
            padding: "18px",
            borderRadius: "11px",
            background: "rgba(255, 255, 255, 0.98)",
            border: "1.5px solid #2563eb",
            boxShadow: "0 8px 25px rgba(0,0,0,0.12)",
            backdropFilter: "blur(8px)",
            color: "#0f172a",
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
            <PropertyInfo
              label="Floor Level"
              value={`Floor ${selected.floorNumber}`}
            />
            <PropertyInfo
              label="Usable Area"
              value={`${selected.area} m²`}
            />
            <PropertyInfo
              label="Clear Height"
              value={`${
                Number((selected as StyledProperty).heightMeters) ||
                DEFAULT_FLOOR_HEIGHT
              } m`}
            />
            <PropertyInfo
              label="3D ULPIN Identifier"
              value={
                selected.ulpin ||
                `3D-${building.id}-F${String(
                  selected.floorNumber
                ).padStart(2, "0")}-${selected.unitNumber}`
              }
            />
          </div>

          <button
            type="button"
            onClick={() => setIsInspectorClosed(true)}
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

      {/* ======================================================
          INSTRUCTION
      ====================================================== */}

      {!selected && (
        <div
          style={{
            position: "absolute",
            bottom: "18px",
            left: "18px",
            zIndex: 10,
            padding: "8px 12px",
            borderRadius: "7px",
            background: "rgba(255, 255, 255, 0.93)",
            border: "1px solid #cbd5e1",
            fontSize: "11px",
            color: "#475569",
          }}
        >
          Click a room, laboratory, stairwell or lift to inspect its 3D ULPIN.
        </div>
      )}

      {/* ======================================================
          STATS
      ====================================================== */}

      <div
        style={{
          position: "absolute",
          bottom: "18px",
          right: "18px",
          zIndex: 10,
          padding: "8px 12px",
          borderRadius: "7px",
          background: "rgba(255, 255, 255, 0.93)",
          border: "1px solid #cbd5e1",
          fontSize: "10px",
          color: "#475569",
        }}
      >
        {building.floors.length} floors ·{" "}
        {building.floors.reduce(
          (total, floor) => total + floor.units.length,
          0
        )}{" "}
        spaces
      </div>
    </div>
  );
}

// ============================================================
// PROPERTY VOLUME
// ============================================================

function PropertyVolume({
  property,
  elevation,
  height,
  selected,
  onSelect,
}: {
  property: StyledProperty;
  elevation: number;
  height: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const polygon = property.polygon;

  const center = useMemo(
    () => getPolygonCenter(polygon),
    [polygon]
  );

  const style = useMemo(
    () => getSpaceStyle(property),
    [property]
  );

  const geometry = useMemo(() => {
    if (polygon.length < 3) {
      return null;
    }

    const shape = new THREE.Shape();

    polygon.forEach((point, index) => {
      const x = point.x - center.x;
      const y = -(point.y - center.y);

      if (index === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    });

    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(height, 0.5),
      bevelEnabled: false,
      steps: 1,
      curveSegments: 1,
    });

    geo.computeVertexNormals();

    return geo;
  }, [polygon, center, height]);

  if (!geometry) {
    return null;
  }

  return (
    <group position={[center.x, elevation, center.y]}>
      {/* ================================================
          PROPERTY VOLUME
      ================================================= */}

      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh
          geometry={geometry}
          castShadow
          receiveShadow
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
        >
          <meshStandardMaterial
            color={selected ? "#f59e0b" : style.fillColor}
            transparent
            opacity={selected ? 0.92 : style.opacity}
            roughness={0.3}
            metalness={0.03}
            side={THREE.DoubleSide}
          />
        </mesh>

        <lineSegments
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
        >
          <edgesGeometry args={[geometry]} />

          <lineBasicMaterial
            color={selected ? "#b45309" : style.wireColor}
            linewidth={selected ? 2.5 : 1.15}
          />
        </lineSegments>
      </group>

      {/* ================================================
          LABEL
      ================================================= */}

      {(selected || style.type === "stairs" || style.type === "lift") && (
        <Html
          position={[0, height / 2 + 0.6, 0]}
          center
          distanceFactor={24}
        >
          <div
            style={{
              padding: "4px 8px",
              background: "#ffffff",
              border: `1.5px solid ${
                selected ? "#d97706" : style.fillColor
              }`,
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

// ============================================================
// PROPERTY INFO
// ============================================================

function PropertyInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
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
