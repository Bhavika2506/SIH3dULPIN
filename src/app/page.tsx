"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import FileUploader from "@/src/components/FileUploader";
import type { ParsedBuilding, Property2D } from "@/src/lib/parser/types";
import VolumetricViewer from "@/src/components/VolumetricViewer";
import CadastralGraph from "@/src/components/CadastralGraph";
import ULPINSearch from "@/src/components/ULPINSearch";
import ExportPanel from "@/src/components/ExportPanel";
import TopologyValidator from "@/src/components/TopologyValidator";
import SurveyorApprovalPanel, {
  SurveyorVerificationData,
} from "@/src/components/SurveyorApprovalPanel";

// Database Server Actions
import {
  getPublicVerifiedBuildings,
  getAllBuildings,
  approveBuilding,
  savePendingBuilding,
  updateBuildingStatus,
  deleteBuilding,
} from "@/src/app/actions/cadastre";

const RealWorldMapViewer = dynamic(
  () => import("@/src/components/RealWorldMapViewer"),
  { ssr: false }
);

type RoleMode = "PUBLIC_VIEWER" | "SURVEYOR" | "UPLOADER";

export default function Dashboard() {
  const router = useRouter();

  const [roleMode, setRoleMode] = useState<RoleMode>("PUBLIC_VIEWER");
  const [showUploader, setShowUploader] = useState(false);
  const [buildingList, setBuildingList] = useState<any[]>([]);
  const [building, setBuilding] = useState<ParsedBuilding | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [verification, setVerification] =
    useState<SurveyorVerificationData | null>(null);
  const [loadingDb, setLoadingDb] = useState(false);

  // Mapper from DB model to ParsedBuilding shape
  const mapDbToParsedBuilding = (dbBuilding: any): ParsedBuilding => ({
    id: dbBuilding.id,
    name: dbBuilding.name,
    georeference: {
      latitude: dbBuilding.latitude,
      longitude: dbBuilding.longitude,
    },
    floors: (dbBuilding.floors || []).map((f: any) => ({
      floorNumber: f.floorNumber,
      elevation: f.elevation,
      height: f.height,
      units: (f.units || []).map((u: any) => ({
        id: u.id,
        unitNumber: u.unitNumber || u.id,
        area: u.area || 0,
        spaceType: u.spaceType || "RESIDENTIAL",
        polygon: typeof u.polygon === "string" ? JSON.parse(u.polygon) : u.polygon,
        ulpin: u.ulpin || undefined,
      })),
    })),
  });

  // Load records on page mount or role change
  const loadDatabaseRecords = async () => {
    setLoadingDb(true);
    if (roleMode === "PUBLIC_VIEWER") {
      const res = await getPublicVerifiedBuildings();
      if (res.success && res.data && res.data.length > 0) {
        setBuildingList(res.data);
        setBuilding(mapDbToParsedBuilding(res.data[0]));
      } else {
        setBuildingList([]);
        setBuilding(null);
      }
    } else if (roleMode === "SURVEYOR") {
      const res = await getAllBuildings();
      if (res.success && res.data) {
        setBuildingList(res.data);
        if (res.data.length > 0 && !building) {
          setBuilding(mapDbToParsedBuilding(res.data[0]));
        }
      }
    }
    setLoadingDb(false);
  };

  useEffect(() => {
    loadDatabaseRecords();
  }, [roleMode]);

  const handleParsed = async (parsedBuilding: ParsedBuilding) => {
    setShowUploader(false);
    const res = await savePendingBuilding(parsedBuilding);
    if (res.success) {
      alert("Plan saved to database queue as PENDING_REVIEW!");
      await loadDatabaseRecords();
    } else {
      alert("Upload failed.");
    }
  };

  const handleStatusChange = async (
    buildingId: string,
    newStatus: "PENDING_REVIEW" | "REJECTED"
  ) => {
    const res = await updateBuildingStatus(buildingId, newStatus);
    if (res.success) {
      await loadDatabaseRecords();
    } else {
      alert("Failed to update building status.");
    }
  };

  const handleDelete = async (buildingId: string) => {
    if (!confirm("Are you sure you want to permanently delete this cadastral submission?")) return;
    const res = await deleteBuilding(buildingId);
    if (res.success) {
      if (building?.id === buildingId) setBuilding(null);
      await loadDatabaseRecords();
    } else {
      alert("Deletion failed.");
    }
  };

  const handleVerificationComplete = async (
    data: SurveyorVerificationData
  ) => {
    setVerification(data);
    if (building?.id && data.status === "APPROVED") {
      const res = await approveBuilding(building.id, "SURVEYOR-OFFICER-01");
      if (res.success) {
        alert("Building approved & assigned official ULPINs in PostgreSQL!");
        await loadDatabaseRecords();
      } else {
        alert("Database approval failed.");
      }
    }
  };

  const handlePropertyNavigate = (property: Property2D | string) => {
    const propId = typeof property === "string" ? property : property.id;
    setSelectedProperty(propId);
    if (building) {
      sessionStorage.setItem("activeBuildingData", JSON.stringify(building));
    }
    if (propId) router.push(`/properties/${propId}`);
  };

  const handlePropertySelect = (property: Property2D | string) => {
    const propId = typeof property === "string" ? property : property.id;
    setSelectedProperty(propId);
    if (building) {
      sessionStorage.setItem("activeBuildingData", JSON.stringify(building));
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        maxHeight: "100vh",
        maxWidth: "100vw",
        overflowX: "hidden",
        overflowY: "auto",
        background: "#090d16",
        color: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* HEADER */}
      <header
        style={{
          height: "70px",
          minHeight: "70px",
          padding: "0 28px",
          background: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
          maxWidth: "100vw",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "9px",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
            }}
          >
            3D
          </div>
          <div>
            <div style={{ fontSize: "17px", fontWeight: 800 }}>3D ULPIN Engine</div>
            <div style={{ fontSize: "10px", color: "#94a3b8" }}>
              Volumetric Cadastre & Vertical Land Governance
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            background: "#0f172a",
            padding: "4px",
            borderRadius: "10px",
            border: "1px solid #1e293b",
          }}
        >
          <button
            type="button"
            onClick={() => setRoleMode("PUBLIC_VIEWER")}
            style={{
              padding: "7px 14px",
              borderRadius: "7px",
              border: "none",
              background: roleMode === "PUBLIC_VIEWER" ? "#2563eb" : "transparent",
              color: roleMode === "PUBLIC_VIEWER" ? "#ffffff" : "#94a3b8",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            👁 Public Viewer
          </button>

          <button
            type="button"
            onClick={() => setRoleMode("SURVEYOR")}
            style={{
              padding: "7px 14px",
              borderRadius: "7px",
              border: "none",
              background: roleMode === "SURVEYOR" ? "#059669" : "transparent",
              color: roleMode === "SURVEYOR" ? "#ffffff" : "#94a3b8",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🛡 Surveyor Portal
          </button>

          <button
            type="button"
            onClick={() => setRoleMode("UPLOADER")}
            style={{
              padding: "7px 14px",
              borderRadius: "7px",
              border: "none",
              background: roleMode === "UPLOADER" ? "#d97706" : "transparent",
              color: roleMode === "UPLOADER" ? "#ffffff" : "#94a3b8",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            📤 Uploader Portal
          </button>
        </div>
      </header>

      {/* UPLOADER MODAL */}
      {showUploader && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(2, 6, 23, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: "16px",
              padding: "28px",
              width: "100%",
              maxWidth: "550px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#f8fafc" }}>
                Upload Field Plan
              </h2>
              <button
                type="button"
                onClick={() => setShowUploader(false)}
                style={{
                  border: "none",
                  background: "#1e293b",
                  color: "#94a3b8",
                  borderRadius: "6px",
                  padding: "6px 10px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
            <FileUploader onParsed={handleParsed} />
          </div>
        </div>
      )}

      {/* LAYOUT CONTAINER */}
      <div
        style={{
          flex: "1 1 auto",
          padding: "28px",
          maxWidth: "1400px",
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
          minWidth: 0,
        }}
      >
        {roleMode === "SURVEYOR" ? (
          /* SURVEYOR MANAGEMENT HUB */
          <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "24px", minWidth: 0 }}>
            {/* MANAGED SUBMISSIONS LIST */}
            <aside
              style={{
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid #1e293b",
                borderRadius: "12px",
                padding: "18px",
                maxHeight: "calc(100vh - 140px)",
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#38bdf8" }}>
                  📋 Managed Records ({buildingList.length})
                </h3>
                <button
                  onClick={() => setShowUploader(true)}
                  style={{
                    background: "#2563eb",
                    border: "none",
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "6px 10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  + Add Plan
                </button>
              </div>

              {loadingDb ? (
                <p style={{ fontSize: "12px", color: "#94a3b8" }}>Querying database...</p>
              ) : buildingList.length === 0 ? (
                <p style={{ fontSize: "12px", color: "#94a3b8" }}>No cadastral submissions found.</p>
              ) : (
                buildingList.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setBuilding(mapDbToParsedBuilding(item))}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      marginBottom: "12px",
                      background: building?.id === item.id ? "#1e293b" : "#0f172a",
                      border: building?.id === item.id ? "1px solid #3b82f6" : "1px solid #1e293b",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700 }}>{item.name}</span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background:
                            item.approvalStatus === "APPROVED"
                              ? "#065f46"
                              : item.approvalStatus === "REJECTED"
                              ? "#881337"
                              : "#854d0e",
                          color: "#ffffff",
                        }}
                      >
                        {item.approvalStatus}
                      </span>
                    </div>

                    <div style={{ marginTop: "10px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(item.id, "PENDING_REVIEW");
                        }}
                        style={{
                          background: "#334155",
                          border: "none",
                          color: "#cbd5e1",
                          fontSize: "10px",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Reset Pending
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(item.id, "REJECTED");
                        }}
                        style={{
                          background: "#991b1b",
                          border: "none",
                          color: "#ffffff",
                          fontSize: "10px",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Reject
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                        style={{
                          background: "#450a0a",
                          border: "none",
                          color: "#f87171",
                          fontSize: "10px",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </aside>

            {/* SURVEYOR INSPECTION & MAP */}
            <section style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: 0 }}>
              {building ? (
                <>
                  <TopologyValidator building={building} />
                  <SurveyorApprovalPanel
                    building={building}
                    onVerificationComplete={handleVerificationComplete}
                  />
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      height: "550px",
                      maxHeight: "550px",
                      borderRadius: "14px",
                      overflow: "hidden",
                      border: "1px solid #1e293b",
                      boxSizing: "border-box",
                      minWidth: 0,
                    }}
                  >
                    <RealWorldMapViewer
                      key={building.id || `map-${Date.now()}`}
                      building={building}
                      approvalStatus={verification?.status || "PENDING_REVIEW"}
                      onPropertyNavigate={(property) => handlePropertyNavigate(property)}
                      onPropertySelect={(property) => handlePropertySelect(property)}
                    />
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "80px", color: "#94a3b8" }}>
                  Select an upload from the left panel to inspect and manage.
                </div>
              )}
            </section>
          </div>
        ) : (
          /* PUBLIC VIEWER & UPLOADER VIEWS */
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%", minWidth: 0 }}>
            {roleMode === "PUBLIC_VIEWER" && (
              <>
                {building ? (
                  <>
                    <ULPINSearch
                      building={building}
                      onSelectProperty={(id) => handlePropertyNavigate(id)}
                    />

                    {/* STRICT DUAL COLUMN GRID FOR 3D MODEL AND GRAPH */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "20px",
                        width: "100%",
                        minWidth: 0,
                        overflow: "hidden",
                      }}
                    >
                      {/* FIXED-HEIGHT 3D MODEL SECTION */}
                      <section
                        style={{
                          background: "rgba(15, 23, 42, 0.6)",
                          border: "1px solid #1e293b",
                          borderRadius: "12px",
                          padding: "20px",
                          minWidth: 0,
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ fontSize: "16px", fontWeight: 800 }}>3D Building Model</div>
                        <div
                          style={{
                            marginTop: "16px",
                            height: "420px",
                            maxHeight: "420px",
                            borderRadius: "10px",
                            overflow: "hidden",
                            background: "#020617",
                            border: "1px solid #1e293b",
                            position: "relative",
                          }}
                        >
                          <VolumetricViewer
                            building={building}
                            selectedPropertyId={selectedProperty}
                            onPropertySelect={(p) => handlePropertySelect(p.id)}
                          />
                        </div>
                      </section>

                      {/* FIXED-HEIGHT CADASTRAL GRAPH SECTION */}
                      <section
                        style={{
                          background: "rgba(15, 23, 42, 0.6)",
                          border: "1px solid #1e293b",
                          borderRadius: "12px",
                          padding: "20px",
                          minWidth: 0,
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ fontSize: "16px", fontWeight: 800 }}>Cadastral Graph</div>
                        <div
                          style={{
                            marginTop: "16px",
                            height: "420px",
                            maxHeight: "420px",
                            borderRadius: "10px",
                            overflow: "auto",
                            background: "#020617",
                            border: "1px solid #1e293b",
                            position: "relative",
                          }}
                        >
                          <CadastralGraph
                            building={building}
                            selectedNodeId={selectedProperty}
                            onNodeSelect={(nodeId) => handlePropertySelect(nodeId)}
                          />
                        </div>
                      </section>
                    </div>

                    {/* REAL WORLD MAP CONTAINER WITH BOUNDED HEIGHT */}
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: "550px",
                        maxHeight: "550px",
                        borderRadius: "14px",
                        overflow: "hidden",
                        border: "1px solid #1e293b",
                        boxSizing: "border-box",
                        minWidth: 0,
                      }}
                    >
                      <RealWorldMapViewer
                        key={building.id || `map-${Date.now()}`}
                        building={building}
                        approvalStatus="APPROVED"
                        onPropertyNavigate={(property) => handlePropertyNavigate(property)}
                        onPropertySelect={(property) => handlePropertySelect(property)}
                      />
                    </div>

                    <ExportPanel building={building} />
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "80px", color: "#94a3b8" }}>
                    No verified public buildings found.
                  </div>
                )}
              </>
            )}

            {roleMode === "UPLOADER" && (
              <section
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  padding: "24px",
                  borderRadius: "12px",
                  border: "1px solid #1e293b",
                }}
              >
                <h3 style={{ margin: "0 0 12px", fontSize: "18px", color: "#f8fafc" }}>
                  Upload Revisions & Field Drawings
                </h3>
                <FileUploader onParsed={handleParsed} />
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}