"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { PageShell } from "@/src/components/PageShell";
import { getPublicPropertyDetails } from "@/src/app/actions/getPublicBuildings";
import { useLanguage } from "@/src/context/LanguageContext";
import type { ParsedBuilding, Property2D } from "@/src/lib/parser/types";

const RealWorldMapViewer = dynamic(
  () => import("@/src/components/RealWorldMapViewer"),
  { ssr: false }
);

const VolumetricViewer = dynamic(
  () => import("@/src/components/VolumetricViewer"),
  { ssr: false }
);

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

// Helper function to safely parse a raw unit object into Property2D
function parseUnitPolygon(unit: Record<string, unknown>): Property2D {
  let polygon = unit?.polygon;
  if (typeof polygon === "string") {
    try {
      polygon = JSON.parse(polygon);
    } catch {
      polygon = [];
    }
  }
  return {
    id: String(unit.id || ""),
    unitNumber: String(unit.unitNumber || "UNIT"),
    floorNumber: Number(unit.floorNumber) || 0,
    area: Number(unit.area) || 0,
    polygon: Array.isArray(polygon) ? polygon : [],
    ulpin: unit.ulpin ? String(unit.ulpin) : undefined,
    spaceType: unit.spaceType ? String(unit.spaceType) : "RESIDENTIAL",
  };
}

// Helper function to map server building object to ParsedBuilding
function mapServerToParsedBuilding(dbBuilding: Record<string, unknown>): ParsedBuilding {
  const latitude = Number(dbBuilding?.latitude);
  const longitude = Number(dbBuilding?.longitude);
  const hasValidGeoreference =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  const floors = Array.isArray(dbBuilding?.floors) ? dbBuilding.floors : [];

  return {
    id: String(dbBuilding.id || ""),
    name: String(dbBuilding.name || "Cadastral Structure"),
    ...(hasValidGeoreference ? { georeference: { latitude, longitude } } : {}),
    floors: floors.map((f: Record<string, unknown>) => ({
      floorNumber: Number(f.floorNumber) || 0,
      elevation: Number(f.elevation) || 0,
      height: Number(f.height) || 3.2,
      units: Array.isArray(f.units)
        ? f.units.map((u: Record<string, unknown>) => {
            let polygon = u.polygon;
            if (typeof polygon === "string") {
              try {
                polygon = JSON.parse(polygon);
              } catch {
                polygon = [];
              }
            }
            return {
              id: String(u.id || ""),
              unitNumber: String(u.unitNumber || "UNIT"),
              floorNumber: Number(f.floorNumber) || 0,
              area: Number(u.area) || 0,
              polygon: Array.isArray(polygon) ? polygon : [],
              ulpin: u.ulpin ? String(u.ulpin) : undefined,
              spaceType: u.spaceType ? String(u.spaceType) : "RESIDENTIAL",
            };
          })
        : [],
    })),
  };
}

export default function PropertyInspectionPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const propertyId = params?.id as string;

  const [building, setBuilding] = useState<ParsedBuilding | null>(null);
  const [property, setProperty] = useState<Property2D | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load building and property details from public server action or sessionStorage fallback
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        if (propertyId) {
          const res = await getPublicPropertyDetails(propertyId);
          if (isMounted && res.success && res.building) {
            const parsed = mapServerToParsedBuilding(res.building);
            setBuilding(parsed);

            // Find matching unit in parsed building or parse res.unit polygon
            const matchedUnit =
              parsed.floors
                .flatMap((f) => f.units)
                .find((u) => u.id === propertyId || u.ulpin === propertyId) ||
              (res.unit ? parseUnitPolygon(res.unit) : null) ||
              (parsed.floors[0]?.units[0] ?? null);

            setProperty(matchedUnit);
            setLoading(false);
            return;
          }
        }

        // Fallback to sessionStorage if public server action didn't find direct match
        const cachedData = sessionStorage.getItem("activeBuildingData");
        if (cachedData) {
          const parsedBuilding: ParsedBuilding = JSON.parse(cachedData);
          const match = parsedBuilding.floors
            .flatMap((f) => f.units)
            .find((u) => u.id === propertyId || u.ulpin === propertyId);

          if (match && isMounted) {
            setBuilding(parsedBuilding);
            setProperty(match);
            setLoading(false);
            return;
          }
        }

        if (isMounted) {
          setError("Property details are not available for public viewing.");
          setLoading(false);
        }
      } catch (err) {
        console.error("Error loading public property details:", err);
        if (isMounted) {
          setError("Unable to load property information.");
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [propertyId]);

  // Extract all units in the building for navigation dropdown & prev/next buttons
  const allUnits = useMemo(() => {
    if (!building?.floors) return [];
    return building.floors.flatMap((floor) =>
      floor.units.map((unit) => ({
        ...unit,
        floorNumber: floor.floorNumber,
      }))
    );
  }, [building]);

  const currentIndex = useMemo(() => {
    if (!property) return -1;
    return allUnits.findIndex((u) => u.id === property.id || u.ulpin === property.ulpin);
  }, [allUnits, property]);

  const prevUnit = currentIndex > 0 ? allUnits[currentIndex - 1] : null;
  const nextUnit = currentIndex >= 0 && currentIndex < allUnits.length - 1 ? allUnits[currentIndex + 1] : null;

  const handleUnitToggle = (targetId: string) => {
    router.push(`/properties/${targetId}`);
  };


  // Check if geometry is valid (needs at least 3 points in at least one unit)
  const hasValid3DGeometry = useMemo(() => {
    if (!building?.floors) return false;
    return building.floors.some((f) =>
      f.units.some((u) => Array.isArray(u.polygon) && u.polygon.length >= 3)
    );
  }, [building]);

  return (
    <PageShell roleMode="PUBLIC_VIEWER" userRole={null} onRoleModeChange={() => {}}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans text-[#162a21]">
        {/* TOP BAR / BACK NAVIGATION */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-[#e2dad0] px-4 py-2 text-xs font-bold text-[#2d6a4f] hover:bg-[#f3efe6] transition shadow-sm"
          >
            {t.backToCadastralMap}
          </Link>

          {allUnits.length > 0 && property && (
            <div className="flex items-center gap-3 bg-white border border-[#e2dad0] px-3 py-1.5 rounded-xl shadow-sm">
              <label className="text-xs font-bold text-[#6b887a]">Select Parcel:</label>
              <select
                value={property.id}
                onChange={(e) => handleUnitToggle(e.target.value)}
                className="bg-[#f8f5ee] text-[#162a21] border border-[#e2dad0] rounded-lg px-2.5 py-1 text-xs font-bold outline-none cursor-pointer"
              >
                {allUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    Unit {u.unitNumber} (Floor {u.floorNumber}){u.ulpin ? ` • ${u.ulpin}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="rounded-2xl border border-[#e2dad0] bg-[#fdfbf7] p-12 text-center shadow-sm">
            <div className="inline-flex items-center gap-3 rounded-full bg-[#2d6a4f]/10 px-5 py-2 text-xs font-bold text-[#2d6a4f]">
              <span className="h-2 w-2 rounded-full bg-[#2d6a4f] animate-pulse" />
              Retrieving official land records from BhuVista registry...
            </div>
          </div>
        )}

        {/* ERROR / UNAVAILABLE STATE */}
        {!loading && (error || !property) && (
          <div className="rounded-2xl border border-[#e2dad0] bg-[#fdfbf7] p-12 text-center shadow-sm space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xl font-bold">
              🔒
            </div>
            <h2 className="text-xl font-extrabold text-[#162a21]">
              Property Information Unavailable
            </h2>
            <p className="text-xs text-[#6b887a] max-w-md mx-auto">
              {error || "Property details are not available for public viewing or the specified identifier is invalid."}
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center rounded-xl bg-[#2d6a4f] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#1b4332] transition shadow-md"
              >
                ← Return to Public Map
              </Link>
            </div>
          </div>
        )}

        {/* MAIN PROPERTY DETAILS CONTENT */}
        {!loading && property && building && (
          <>
            {/* HEADER BANNER */}
            <div className="rounded-2xl border border-[#e2dad0] bg-[#fdfbf7] p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded bg-[#2d6a4f]/10 px-2 py-0.5 text-[10px] font-extrabold text-[#2d6a4f] uppercase tracking-wider">
                    {currentIndex >= 0 ? `PARCEL ${currentIndex + 1} OF ${allUnits.length}` : "VERIFIED PARCEL"}
                  </span>
                  <span className="rounded bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">
                    {t.approvedCadastre}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-[#162a21] tracking-tight">
                  Unit {property.unitNumber}
                </h1>
                <p className="text-xs font-medium text-[#6b887a] mt-1">
                  National Cadastral Land Record • {building.name}
                </p>
              </div>

              {/* PREV / NEXT UNIT BUTTONS */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={!prevUnit}
                  onClick={() => prevUnit && handleUnitToggle(prevUnit.id)}
                  className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                    prevUnit
                      ? "border-[#e2dad0] bg-white text-[#162a21] hover:bg-[#f3efe6]"
                      : "border-[#e2dad0]/50 bg-[#f8f5ee] text-[#6b887a]/50 cursor-not-allowed"
                  }`}
                >
                  ← Previous Unit
                </button>

                <button
                  type="button"
                  disabled={!nextUnit}
                  onClick={() => nextUnit && handleUnitToggle(nextUnit.id)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                    nextUnit
                      ? "bg-[#2d6a4f] text-white hover:bg-[#1b4332] shadow-sm"
                      : "bg-[#2d6a4f]/40 text-white/60 cursor-not-allowed"
                  }`}
                >
                  Next Unit →
                </button>
              </div>
            </div>

            {/* PROPERTY OVERVIEW METRIC CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <OverviewCard
                label="ULPIN"
                value={property.ulpin || t.pendingAssignment}
                highlight={!!property.ulpin}
              />
              <OverviewCard
                label={t.unitNumberLabel}
                value={`Unit ${property.unitNumber}`}
              />
              <OverviewCard
                label={t.landUseLabel}
                value={property.spaceType || "Residential"}
              />
              <OverviewCard
                label={t.areaLabel}
                value={property.area ? `${property.area} m²` : "Not available"}
              />
            </div>

            {/* MAIN 2-COLUMN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* LEFT COLUMN: 3D VOLUMETRIC PREVIEW */}
              <div className="lg:col-span-7 space-y-6">
                <div className="rounded-2xl border border-[#e2dad0] bg-[#fdfbf7] p-6 shadow-sm flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4 border-b border-[#e2dad0] pb-3">
                    <div>
                      <h3 className="text-base font-extrabold text-[#162a21]">
                        3D Property Volume
                      </h3>
                      <p className="text-xs text-[#6b887a]">
                        Interactive 3D volumetric extrusion of floor boundary
                      </p>
                    </div>
                    <span className="rounded-full bg-[#2d6a4f]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#2d6a4f]">
                      Floor {property.floorNumber}
                    </span>
                  </div>

                  <div className="w-full h-[420px] rounded-xl overflow-hidden border border-[#e2dad0] bg-[#f8f5ee] relative flex-1">
                    {hasValid3DGeometry && building ? (
                      <VolumetricViewer
                        key={property.id}
                        building={building}
                        selectedPropertyId={property.id}
                        onPropertySelect={(p) => handleUnitToggle(p.id)}
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#f8f5ee]">
                        <span className="text-2xl mb-2">📐</span>
                        <p className="text-xs font-bold text-[#162a21]">
                          3D visualization is not available for this property.
                        </p>
                        <p className="text-[11px] text-[#6b887a] mt-1 max-w-xs">
                          Floorplan polygon geometry is not defined in the public record.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: LOCATION & STRUCTURE DETAILS */}
              <div className="lg:col-span-5 space-y-6">
                {/* LOCATION CARD WITH MAP PREVIEW */}
                <div className="rounded-2xl border border-[#e2dad0] bg-[#fdfbf7] p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-3 border-b border-[#e2dad0] pb-3">
                    <h3 className="text-base font-extrabold text-[#162a21]">
                      Location & Map Coordinates
                    </h3>
                    <span className="text-xs font-bold text-[#2d6a4f]">
                      WGS84 GIS
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs mb-4">
                    <div className="flex justify-between border-b border-[#e2dad0]/60 pb-1.5">
                      <span className="text-[#6b887a] font-medium">Latitude</span>
                      <span className="font-bold text-[#162a21]">
                        {building.georeference
                          ? `${building.georeference.latitude.toFixed(6)}° N`
                          : "Not available"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-[#e2dad0]/60 pb-1.5">
                      <span className="text-[#6b887a] font-medium">Longitude</span>
                      <span className="font-bold text-[#162a21]">
                        {building.georeference
                          ? `${building.georeference.longitude.toFixed(6)}° E`
                          : "Not available"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-[#e2dad0]/60 pb-1.5">
                      <span className="text-[#6b887a] font-medium">Parent Structure</span>
                      <span className="font-bold text-[#162a21] truncate max-w-[200px]">
                        {building.name}
                      </span>
                    </div>
                  </div>

                  {building.georeference && (
                    <div className="w-full h-48 rounded-xl overflow-hidden border border-[#e2dad0] relative">
                      <RealWorldMapViewer building={building} />
                    </div>
                  )}
                </div>

                {/* BUILDING & FLOOR INFORMATION */}
                <div className="rounded-2xl border border-[#e2dad0] bg-[#fdfbf7] p-6 shadow-sm">
                  <h3 className="text-base font-extrabold text-[#162a21] mb-3 border-b border-[#e2dad0] pb-3">
                    Building & Floor Specification
                  </h3>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between border-b border-[#e2dad0]/60 pb-1.5">
                      <span className="text-[#6b887a] font-medium">Structure Identifier</span>
                      <span className="font-bold text-[#162a21] truncate max-w-[180px]">
                        {building.id}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-[#e2dad0]/60 pb-1.5">
                      <span className="text-[#6b887a] font-medium">Total Floor Levels</span>
                      <span className="font-bold text-[#162a21]">
                        {building.floors.length} Floors
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-[#e2dad0]/60 pb-1.5">
                      <span className="text-[#6b887a] font-medium">Floor Level</span>
                      <span className="font-bold text-[#2d6a4f]">
                        Floor {property.floorNumber}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-[#e2dad0]/60 pb-1.5">
                      <span className="text-[#6b887a] font-medium">Verification Status</span>
                      <span className="font-bold text-[#2d6a4f]">APPROVED CADASTRE</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

function OverviewCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#e2dad0] bg-[#fdfbf7] p-5 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[#6b887a]">
        {label}
      </div>
      <div
        className={`text-lg sm:text-xl font-extrabold mt-1 truncate ${
          highlight ? "text-[#2d6a4f]" : "text-[#162a21]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

