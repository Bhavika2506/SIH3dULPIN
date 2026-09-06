"use client";

import { useState } from "react";
import FileUploader from "@/src/components/FileUploader";
import type { ParsedBuilding } from "@/src/lib/parser/types";
import VolumetricViewer from "@/src/components/VolumetricViewer";
import CadastralGraph from "@/src/components/CadastralGraph";
import ULPINSearch from "@/src/components/ULPINSearch";
import ExportPanel from "@/src/components/ExportPanel";

type ActiveTab = "overview" | "view3d" | "graph" | "validation";

export default function Dashboard() {
  const [showUploader, setShowUploader] = useState(false);
  const [building, setBuilding] = useState<ParsedBuilding | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");

  const handleParsed = (parsedBuilding: ParsedBuilding) => {
    setBuilding(parsedBuilding);
    setSelectedProperty(null);
    setShowUploader(false);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#090d16",
        color: "#f8fafc",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* APP HEADER */}
      <header
        style={{
          height: "70px",
          padding: "0 32px",
          background: "rgba(15, 23, 42, 0.8)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
            }}
          >
            3D
          </div>

          <div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 800,
                letterSpacing: "-0.3px",
              }}
            >
              3D ULPIN
            </div>
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
              Vertical Property Mapping & Cadastre Registry
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {building && <ExportPanel building={building} />}
          <button
            type="button"
            onClick={() => setShowUploader(true)}
            style={{
              border: "1px solid rgba(59, 130, 246, 0.5)",
              borderRadius: "8px",
              padding: "11px 20px",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
              transition: "all 0.2s ease",
            }}
          >
            + Upload 2D File
          </button>
        </div>
      </header>

      {/* DASHBOARD BODY */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 70px)" }}>
        {/* WORKSPACE SIDEBAR */}
        <aside
          style={{
            width: "230px",
            flexShrink: 0,
            background: "#0f172a",
            borderRight: "1px solid #1e293b",
            padding: "25px 14px",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              color: "#64748b",
              fontWeight: 800,
              padding: "0 12px",
              marginBottom: "14px",
              letterSpacing: "0.8px",
            }}
          >
            WORKSPACE
          </div>

          <NavItem
            label="Overview"
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
          />
          <NavItem
            label="3D Model View"
            active={activeTab === "view3d"}
            onClick={() => setActiveTab("view3d")}
          />
          <NavItem
            label="Cadastral Graph"
            active={activeTab === "graph"}
            onClick={() => setActiveTab("graph")}
          />
          <NavItem
            label="Topology Validation"
            active={activeTab === "validation"}
            onClick={() => setActiveTab("validation")}
          />
        </aside>

        {/* CONTENT AREA */}
        <section style={{ flex: 1, padding: "32px", minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "28px",
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "28px",
                  fontWeight: 800,
                  color: "#f8fafc",
                }}
              >
                {activeTab === "overview" && "Property Dashboard"}
                {activeTab === "view3d" && "3D Model Viewport"}
                {activeTab === "graph" && "Cadastral Graph Explorer"}
                {activeTab === "validation" && "Topology Validation Reports"}
              </h1>
              <p
                style={{
                  marginTop: "7px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Convert 2D cadastral data into 3D vertical property structures.
              </p>
            </div>
          </div>

          {showUploader ? (
            <div>
              <button
                type="button"
                onClick={() => setShowUploader(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#60a5fa",
                  fontWeight: 600,
                  cursor: "pointer",
                  marginBottom: "18px",
                  padding: 0,
                  fontSize: "14px",
                }}
              >
                ← Back to Dashboard
              </button>

              <FileUploader onParsed={handleParsed} />
            </div>
          ) : building ? (
            <PropertyResults
              building={building}
              selectedProperty={selectedProperty}
              onPropertySelect={setSelectedProperty}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          ) : (
            <EmptyDashboard onUpload={() => setShowUploader(true)} />
          )}
        </section>
      </div>
    </main>
  );
}

function EmptyDashboard({ onUpload }: { onUpload: () => void }) {
  return (
    <>
      <div
        style={{
          padding: "50px",
          background: "rgba(15, 23, 42, 0.6)",
          border: "1px solid #1e293b",
          borderRadius: "16px",
          textAlign: "center",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ fontSize: "44px", marginBottom: "14px" }}>↑</div>

        <h2
          style={{
            margin: 0,
            fontSize: "22px",
            fontWeight: 800,
            color: "#f8fafc",
          }}
        >
          Start a New Property Model
        </h2>

        <p
          style={{
            margin: "10px auto 24px",
            maxWidth: "520px",
            fontSize: "13px",
            color: "#94a3b8",
            lineHeight: 1.6,
          }}
        >
          Upload your 2D cadastral or architectural data. The system will parse
          the geometry and generate the 3D building structure and cadastral
          graph.
        </p>

        <button
          type="button"
          onClick={onUpload}
          style={{
            border: "none",
            borderRadius: "8px",
            padding: "13px 24px",
            background: "#2563eb",
            color: "#ffffff",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: "13px",
            boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
          }}
        >
          Upload 2D Property File
        </button>

        <div
          style={{
            marginTop: "20px",
            fontSize: "11px",
            color: "#64748b",
            letterSpacing: "0.5px",
          }}
        >
          GeoJSON • JSON • DXF • PDF • SVG • SHP
        </div>
      </div>

      <div
        style={{
          marginTop: "24px",
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "16px",
        }}
      >
        <Stat title="Buildings" value="0" />
        <Stat title="Floors" value="0" />
        <Stat title="Properties" value="0" />
        <Stat title="3D ULPINs" value="0" />
      </div>

      <div
        style={{
          marginTop: "24px",
          padding: "24px",
          background: "rgba(15, 23, 42, 0.6)",
          border: "1px solid #1e293b",
          borderRadius: "14px",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: "15px", color: "#f8fafc" }}>
          Vertical Cadastre Pipeline
        </div>

        <div
          style={{
            marginTop: "20px",
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: "12px",
          }}
        >
          <Pipeline number="01" title="Upload" />
          <Pipeline number="02" title="Parse" />
          <Pipeline number="03" title="3D Model" />
          <Pipeline number="04" title="Graph" />
          <Pipeline number="05" title="3D ULPIN" />
        </div>
      </div>
    </>
  );
}

function PropertyResults({
  building,
  selectedProperty,
  onPropertySelect,
  activeTab,
  setActiveTab,
}: {
  building: ParsedBuilding;
  selectedProperty: string | null;
  onPropertySelect: (id: string) => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}) {
  const totalProperties = building.floors.reduce(
    (total, floor) => total + floor.units.length,
    0
  );

  const selectedUnitDetails = selectedProperty
    ? building.floors
        .flatMap((f) => f.units)
        .find((u) => u.id === selectedProperty)
    : null;

  return (
    <div>
      {/* BUILDING OVERVIEW HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "22px",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#f8fafc" }}>
            {building.name}
          </div>
          <div
            style={{
              marginTop: "5px",
              fontSize: "12px",
              color: "#94a3b8",
            }}
          >
            Parsed 2D cadastral data → 3D vertical property model
          </div>
        </div>

        <div
          style={{
            padding: "8px 14px",
            borderRadius: "20px",
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            color: "#10b981",
            fontSize: "11px",
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          ✓ PARSED
        </div>
      </div>

      {/* STATS OVERVIEW */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <Stat title="Buildings" value="1" />
        <Stat title="Floors" value={String(building.floors.length)} />
        <Stat title="Properties" value={String(totalProperties)} />
        <Stat title="3D ULPINs" value={String(totalProperties)} />
      </div>

      {/* VIEW TOGGLE NAVIGATION BAR */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
          background: "#0f172a",
          padding: "6px",
          borderRadius: "10px",
          border: "1px solid #1e293b",
          width: "fit-content",
        }}
      >
        <TabButton
          label="All Views (Overview)"
          active={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
        />
        <TabButton
          label="3D Model View"
          active={activeTab === "view3d"}
          onClick={() => setActiveTab("view3d")}
        />
        <TabButton
          label="Cadastral Graph"
          active={activeTab === "graph"}
          onClick={() => setActiveTab("graph")}
        />
        <TabButton
          label="Validation Report"
          active={activeTab === "validation"}
          onClick={() => setActiveTab("validation")}
        />
      </div>

      {/* ULPIN SEARCH */}
      <div style={{ marginBottom: "24px" }}>
        <ULPINSearch
          building={building}
          onSelectProperty={onPropertySelect}
        />
      </div>

      {/* OVERVIEW MODE (ALL VIEWS TOGETHER) */}
      {activeTab === "overview" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
              gap: "20px",
              marginBottom: "24px",
            }}
          >
            {/* 3D VIEWPORT */}
            <section
              style={{
                gridColumn: "span 7 / span 7",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid #1e293b",
                borderRadius: "14px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                backdropFilter: "blur(8px)",
              }}
            >
              <SectionTitle
                title="3D Building Model"
                description="Volumetric representation generated from the uploaded 2D geometry."
              />

              <div
                style={{
                  marginTop: "18px",
                  height: "520px",
                  borderRadius: "10px",
                  overflow: "hidden",
                  background: "#020617",
                  border: "1px solid #1e293b",
                }}
              >
                <VolumetricViewer
                  building={building}
                  onPropertySelect={(property) => onPropertySelect(property.id)}
                />
              </div>
            </section>

            {/* CADASTRAL GRAPH */}
            <section
              style={{
                gridColumn: "span 5 / span 5",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid #1e293b",
                borderRadius: "14px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                backdropFilter: "blur(8px)",
              }}
            >
              <SectionTitle
                title="Cadastral Graph"
                description="Nodes represent properties and edges represent spatial relationships."
              />

              <div
                style={{
                  marginTop: "18px",
                  height: "520px",
                  borderRadius: "10px",
                  background: "#020617",
                  border: "1px solid #1e293b",
                  overflow: "auto",
                }}
              >
                <CadastralGraph
                  building={building}
                  selectedNodeId={selectedProperty}
                  onNodeSelect={onPropertySelect}
                />
              </div>
            </section>
          </div>

          <TopologyValidationSection />
        </>
      )}

      {/* FULL-PAGE 3D VIEWPORT TAB */}
      {activeTab === "view3d" && (
        <section
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid #1e293b",
            borderRadius: "14px",
            padding: "20px",
            marginBottom: "24px",
            backdropFilter: "blur(8px)",
          }}
        >
          <SectionTitle
            title="3D Building Model Viewport"
            description="Expanded 3D volumetric space view for inspecting multi-storey unit bounding boundaries."
          />

          <div
            style={{
              marginTop: "18px",
              height: "720px",
              borderRadius: "10px",
              overflow: "hidden",
              background: "#020617",
              border: "1px solid #1e293b",
            }}
          >
            <VolumetricViewer
              building={building}
              onPropertySelect={(property) => onPropertySelect(property.id)}
            />
          </div>
        </section>
      )}

      {/* FULL-PAGE CADASTRAL GRAPH TAB */}
      {activeTab === "graph" && (
        <section
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid #1e293b",
            borderRadius: "14px",
            padding: "20px",
            marginBottom: "24px",
            backdropFilter: "blur(8px)",
          }}
        >
          <SectionTitle
            title="Cadastral Graph Hierarchy"
            description="Full interactive view of vertical and horizontal property connections."
          />

          <div
            style={{
              marginTop: "18px",
              minHeight: "650px",
              maxHeight: "800px",
              borderRadius: "10px",
              background: "#020617",
              border: "1px solid #1e293b",
              overflow: "auto",
            }}
          >
            <CadastralGraph
              building={building}
              selectedNodeId={selectedProperty}
              onNodeSelect={onPropertySelect}
            />
          </div>
        </section>
      )}

      {/* FULL-PAGE TOPOLOGY VALIDATION TAB */}
      {activeTab === "validation" && <TopologyValidationSection />}

      {/* PROPERTY INSPECTOR DRAWER */}
      {selectedUnitDetails && (
        <section
          style={{
            marginBottom: "24px",
            background: "rgba(15, 23, 42, 0.8)",
            border: "1px solid #3b82f6",
            borderRadius: "14px",
            padding: "22px",
            boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.2)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "18px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#60a5fa",
                  fontWeight: 800,
                  letterSpacing: "0.8px",
                }}
              >
                SELECTED PROPERTY INSPECTOR
              </div>
              <h3
                style={{
                  margin: "4px 0 0",
                  fontSize: "20px",
                  fontWeight: 800,
                  color: "#f8fafc",
                }}
              >
                Unit {selectedUnitDetails.unitNumber}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => onPropertySelect("")}
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
                color: "#94a3b8",
                borderRadius: "6px",
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              Close Inspector ✕
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: "12px",
            }}
          >
            <DrawerDetail label="Property ID" value={selectedUnitDetails.id} />
            <DrawerDetail
              label="Unit Number"
              value={selectedUnitDetails.unitNumber}
            />
            <DrawerDetail
              label="Floor Level"
              value={`Floor ${selectedUnitDetails.floorNumber}`}
            />
            <DrawerDetail
              label="Calculated Area"
              value={`${selectedUnitDetails.area} m²`}
            />
            <DrawerDetail
              label="3D ULPIN ID"
              value={`3D-${building.id}-${selectedUnitDetails.floorNumber}-${selectedUnitDetails.unitNumber}`}
            />
          </div>
        </section>
      )}

      {/* PROPERTY STRUCTURE BREAKDOWN */}
      <section
        style={{
          marginTop: "24px",
          marginBottom: "40px",
          background: "rgba(15, 23, 42, 0.6)",
          border: "1px solid #1e293b",
          borderRadius: "14px",
          padding: "20px",
          backdropFilter: "blur(8px)",
        }}
      >
        <SectionTitle
          title="Property Structure"
          description="Detected vertical property hierarchy."
        />

        <div style={{ marginTop: "18px" }}>
          {building.floors.map((floor) => (
            <div
              key={floor.floorNumber}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "14px 18px",
                marginBottom: "8px",
                background: "#020617",
                border: "1px solid #1e293b",
                borderRadius: "8px",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#f8fafc",
                }}
              >
                Floor {floor.floorNumber}
              </div>

              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                {floor.units.length} properties
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TopologyValidationSection() {
  return (
    <section
      style={{
        marginTop: "24px",
        marginBottom: "24px",
        background: "rgba(15, 23, 42, 0.6)",
        border: "1px solid #1e293b",
        borderRadius: "14px",
        padding: "20px",
        backdropFilter: "blur(8px)",
      }}
    >
      <SectionTitle
        title="Topology Validation"
        description="Automated validation of the generated cadastral structure."
      />

      <div
        style={{
          marginTop: "18px",
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "12px",
        }}
      >
        <ValidationItem label="Geometry parsed" status="valid" />
        <ValidationItem label="Building detected" status="valid" />
        <ValidationItem label="Floor structure" status="valid" />
        <ValidationItem label="Property boundaries" status="valid" />
        <ValidationItem label="Graph connectivity" status="valid" />
        <ValidationItem label="Vertical relationships" status="valid" />
      </div>
    </section>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "none",
        background: active ? "#2563eb" : "transparent",
        color: active ? "#ffffff" : "#94a3b8",
        padding: "8px 16px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: 700,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      {label}
    </button>
  );
}

function NavItem({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "11px 14px",
        marginBottom: "6px",
        borderRadius: "8px",
        background: active ? "rgba(37, 99, 235, 0.15)" : "transparent",
        border: active
          ? "1px solid rgba(59, 130, 246, 0.3)"
          : "1px solid transparent",
        color: active ? "#60a5fa" : "#94a3b8",
        fontSize: "13px",
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      {label}
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        padding: "20px",
        background: "rgba(15, 23, 42, 0.6)",
        border: "1px solid #1e293b",
        borderRadius: "12px",
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>
        {title}
      </div>
      <div
        style={{
          marginTop: "8px",
          fontSize: "26px",
          fontWeight: 800,
          color: "#f8fafc",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Pipeline({ number, title }: { number: string; title: string }) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "10px",
        background: "#020617",
        border: "1px solid #1e293b",
      }}
    >
      <div style={{ fontSize: "11px", color: "#60a5fa", fontWeight: 800 }}>
        {number}
      </div>
      <div
        style={{
          marginTop: "6px",
          fontSize: "13px",
          fontWeight: 700,
          color: "#f8fafc",
        }}
      >
        {title}
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <div style={{ fontSize: "16px", fontWeight: 800, color: "#f8fafc" }}>
        {title}
      </div>
      <div
        style={{
          marginTop: "4px",
          fontSize: "12px",
          color: "#94a3b8",
        }}
      >
        {description}
      </div>
    </div>
  );
}

function DrawerDetail({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "#020617",
        borderRadius: "8px",
        border: "1px solid #1e293b",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          color: "#64748b",
          fontWeight: 800,
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "13px",
          fontWeight: 700,
          color: "#f8fafc",
          wordBreak: "break-all",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ValidationItem({
  label,
  status,
}: {
  label: string;
  status: "valid" | "warning" | "error";
}) {
  const symbol = status === "valid" ? "✓" : status === "warning" ? "!" : "×";

  const background =
    status === "valid"
      ? "rgba(16, 185, 129, 0.1)"
      : status === "warning"
        ? "rgba(245, 158, 11, 0.1)"
        : "rgba(239, 68, 68, 0.1)";

  const border =
    status === "valid"
      ? "rgba(16, 185, 129, 0.25)"
      : status === "warning"
        ? "rgba(245, 158, 11, 0.25)"
        : "rgba(239, 68, 68, 0.25)";

  const text =
    status === "valid"
      ? "#10b981"
      : status === "warning"
        ? "#f59e0b"
        : "#ef4444";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "13px 16px",
        borderRadius: "10px",
        background,
        border: `1px solid ${border}`,
        color: text,
        fontSize: "13px",
        fontWeight: 600,
      }}
    >
      <div
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255, 255, 255, 0.1)",
          fontWeight: 800,
        }}
      >
        {symbol}
      </div>
      {label}
    </div>
  );
}