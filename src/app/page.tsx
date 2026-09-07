"use client";

import { useState } from "react";
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

const RealWorldMapViewer = dynamic(
  () => import("@/src/components/RealWorldMapViewer"),
  { ssr: false }
);

type RoleMode = "PUBLIC_VIEWER" | "SURVEYOR" | "UPLOADER";

export default function Dashboard() {
  const router = useRouter();

  const [roleMode, setRoleMode] = useState<RoleMode>("PUBLIC_VIEWER");
  const [showUploader, setShowUploader] = useState(false);
  const [building, setBuilding] = useState<ParsedBuilding | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [verification, setVerification] =
    useState<SurveyorVerificationData | null>(null);

  const handleParsed = (parsedBuilding: ParsedBuilding) => {
    setBuilding(parsedBuilding);
    setSelectedProperty(null);
    setShowUploader(false);
    setVerification(null);
  };

  const handlePropertyNavigate = (property: Property2D | string) => {
    const propId = typeof property === "string" ? property : property.id;
    setSelectedProperty(propId);

    if (building) {
      sessionStorage.setItem("activeBuildingData", JSON.stringify(building));
    }

    if (propId) {
      router.push(`/properties/${propId}`);
    }
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
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* NAVIGATION HEADER */}
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
            <div style={{ fontSize: "17px", fontWeight: 800 }}>
              3D ULPIN Engine
            </div>
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
              background:
                roleMode === "PUBLIC_VIEWER" ? "#2563eb" : "transparent",
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

      {/* MODAL UPLOADER */}
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
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

      {/* DASHBOARD CONTENT CONTAINER */}
      <div
        style={{
          flex: "1 1 auto",
          padding: "28px",
          maxWidth: "1280px",
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
          minWidth: 0,
          minHeight: 0,
        }}
      >
        {!building ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "450px",
              maxHeight: "550px",
              padding: "40px",
              background: "rgba(15, 23, 42, 0.6)",
              border: "2px dashed #1e293b",
              borderRadius: "16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "42px", marginBottom: "14px" }}>🏢</div>
            <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#f8fafc" }}>
              No Cadastral Parcel Loaded
            </h3>
            <p style={{ margin: "8px 0 20px", fontSize: "13px", color: "#94a3b8" }}>
              Upload a floor plan file to parse 3D volumetric parcels.
            </p>
            <button
              type="button"
              onClick={() => setShowUploader(true)}
              style={{
                border: "none",
                borderRadius: "8px",
                padding: "12px 22px",
                background: "#2563eb",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              + Upload Cadastral File
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%", minWidth: 0 }}>
            {/* PUBLIC VIEWER PORTAL */}
            {roleMode === "PUBLIC_VIEWER" && (
              <>
                <ULPINSearch
                  building={building}
                  onSelectProperty={(id) => handlePropertyNavigate(id)}
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "20px",
                    width: "100%",
                    minWidth: 0,
                  }}
                >
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

                {/* REAL-WORLD MAP WRAPPER WITH STRICT BOUNDS */}
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
                    approvalStatus={verification?.status || "APPROVED"}
                    onPropertyNavigate={(property) => handlePropertyNavigate(property)}
                    onPropertySelect={(property) => handlePropertySelect(property)}
                  />
                </div>

                <ExportPanel building={building} />
              </>
            )}

            {/* SURVEYOR PORTAL */}
            {roleMode === "SURVEYOR" && (
              <>
                <TopologyValidator building={building} />
                <SurveyorApprovalPanel
                  building={building}
                  onVerificationComplete={setVerification}
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
            )}

            {/* UPLOADER PORTAL */}
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