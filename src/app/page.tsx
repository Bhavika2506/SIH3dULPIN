
"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import FileUploader from "@/src/components/FileUploader";
import type {
  ParsedBuilding,
  Property2D,
} from "@/src/lib/parser/types";

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
  {
    ssr: false,
  }
);

type RoleMode =
  | "PUBLIC_VIEWER"
  | "SURVEYOR"
  | "UPLOADER";

export default function Dashboard() {
  const router = useRouter();

  const [roleMode, setRoleMode] =
    useState<RoleMode>("PUBLIC_VIEWER");

  const [showUploader, setShowUploader] =
    useState(false);

  const [buildingList, setBuildingList] =
    useState<any[]>([]);

  const [building, setBuilding] =
    useState<ParsedBuilding | null>(null);

  const [selectedProperty, setSelectedProperty] =
    useState<string | null>(null);

  const [verification, setVerification] =
    useState<SurveyorVerificationData | null>(null);

  const [loadingDb, setLoadingDb] =
    useState(false);

  /**
   * ------------------------------------------------------------
   * DATABASE BUILDING → ParsedBuilding
   * ------------------------------------------------------------
   *
   * IMPORTANT:
   *
   * There are NO hardcoded latitude/longitude fallbacks here.
   *
   * The map must use the actual coordinates belonging to the
   * uploaded cadastral building.
   */
  const mapDbToParsedBuilding = (
    dbBuilding: any
  ): ParsedBuilding => {
    const latitude = Number(
      dbBuilding?.latitude ??
        dbBuilding?.georeference?.latitude
    );

    const longitude = Number(
      dbBuilding?.longitude ??
        dbBuilding?.georeference?.longitude
    );

    const hasValidGeoreference =
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180;

    const floors = Array.isArray(
      dbBuilding?.floors
    )
      ? dbBuilding.floors
      : [];

    return {
      id:
        dbBuilding?.id ??
        `BLDG-${Date.now()}`,

      name:
        dbBuilding?.name ??
        dbBuilding?.buildingName ??
        "Cadastral Building",

      /**
       * Only add georeference when the database actually
       * contains valid coordinates.
       *
       * This prevents the application from silently placing
       * buildings at an unrelated fallback location.
       */
      ...(hasValidGeoreference
        ? {
            georeference: {
              latitude,
              longitude,
            },
          }
        : {}),

      floors: floors.map(
        (floor: any) => ({
          floorNumber:
            Number(floor?.floorNumber) || 0,

          elevation:
            Number(floor?.elevation) || 0,

          height:
            Number(floor?.height) || 3,

          units: Array.isArray(
            floor?.units
          )
            ? floor.units.map(
                (unit: any) => {
                  let polygon =
                    unit?.polygon;

                  /**
                   * PostgreSQL may return polygon as
                   * a JSON string.
                   */
                  if (
                    typeof polygon ===
                    "string"
                  ) {
                    try {
                      polygon =
                        JSON.parse(
                          polygon
                        );
                    } catch {
                      polygon = [];
                    }
                  }

                  return {
                    id:
                      unit?.id ??
                      `UNIT-${Date.now()}-${Math.random()}`,

                    unitNumber:
                      unit?.unitNumber ??
                      unit?.id ??
                      "UNIT",

                    floorNumber:
                      Number(
                        floor?.floorNumber
                      ) || 0,

                    area:
                      Number(
                        unit?.area
                      ) || 0,

                    polygon:
                      Array.isArray(
                        polygon
                      )
                        ? polygon
                        : [],

                    ulpin:
                      unit?.ulpin ||
                      undefined,

                    spaceType:
                      unit?.spaceType ??
                      "RESIDENTIAL",
                  };
                }
              )
            : [],
        })
      ),
    };
  };

  /**
   * ------------------------------------------------------------
   * LOAD DATABASE RECORDS
   * ------------------------------------------------------------
   */
  const loadDatabaseRecords =
    async () => {
      setLoadingDb(true);

      try {
        /**
         * ------------------------------------------------------
         * PUBLIC VIEWER
         * ------------------------------------------------------
         */
        if (
          roleMode ===
          "PUBLIC_VIEWER"
        ) {
          const res =
            await getPublicVerifiedBuildings();

          if (
            res.success &&
            res.data &&
            res.data.length > 0
          ) {
            setBuildingList(
              res.data
            );

            /**
             * Display the first verified building.
             */
            setBuilding(
              mapDbToParsedBuilding(
                res.data[0]
              )
            );
          } else {
            setBuildingList([]);
            setBuilding(null);
          }

          return;
        }

        /**
         * ------------------------------------------------------
         * SURVEYOR
         * ------------------------------------------------------
         */
        if (
          roleMode === "SURVEYOR"
        ) {
          const res =
            await getAllBuildings();

          if (
            res.success &&
            res.data
          ) {
            setBuildingList(
              res.data
            );

            /**
             * Only select the first building when there is
             * currently no selected building.
             */
            if (
              res.data.length > 0
            ) {
              setBuilding(
                (
                  current
                ) => {
                  if (current) {
                    return current;
                  }

                  return mapDbToParsedBuilding(
                    res.data[0]
                  );
                }
              );
            } else {
              setBuilding(null);
            }
          } else {
            setBuildingList([]);
          }

          return;
        }

        /**
         * ------------------------------------------------------
         * UPLOADER
         * ------------------------------------------------------
         *
         * Do not clear the currently uploaded building here.
         * The uploader itself controls the building state.
         */
        if (
          roleMode === "UPLOADER"
        ) {
          return;
        }
      } catch (error) {
        console.error(
          "Failed to load cadastral records:",
          error
        );
      } finally {
        setLoadingDb(false);
      }
    };

  /**
   * ------------------------------------------------------------
   * LOAD DATABASE WHEN ROLE CHANGES
   * ------------------------------------------------------------
   */
  useEffect(() => {
    loadDatabaseRecords();
  }, [roleMode]);

  /**
   * ------------------------------------------------------------
   * PARSED BUILDING FROM FILE UPLOADER
   * ------------------------------------------------------------
   *
   * This is intentionally set BEFORE the database request.
   *
   * Therefore:
   *
   * GeoJSON
   *    ↓
   * ParsedBuilding
   *    ↓
   * setBuilding()
   *    ↓
   * RealWorldMapViewer
   *
   * The uploaded georeference reaches the map directly.
   */
  const handleParsed = async (
    parsedBuilding: ParsedBuilding
  ) => {
    console.log(
      "Uploaded ParsedBuilding:",
      parsedBuilding
    );

    console.log(
      "Uploaded GeoReference:",
      parsedBuilding.georeference
    );

    /**
     * Immediately display the uploaded building.
     */
    setBuilding(
      parsedBuilding
    );

    /**
     * Clear previous property selection.
     */
    setSelectedProperty(
      null
    );

    /**
     * Close uploader modal.
     */
    setShowUploader(false);

    try {
      /**
       * Persist the exact ParsedBuilding to PostgreSQL.
       */
      const res =
        await savePendingBuilding(
          parsedBuilding
        );

      if (res.success) {
        alert(
          "Plan saved to database queue with updated coordinates as PENDING_REVIEW!"
        );

        /**
         * Refresh database records.
         *
         * We intentionally do not rely on this refresh to
         * display the uploaded building because setBuilding()
         * above already has the original GeoJSON coordinates.
         */
        await loadDatabaseRecords();
      } else {
        alert(
          "Upload failed."
        );
      }
    } catch (error) {
      console.error(
        "Upload/save error:",
        error
      );

      alert(
        "Upload failed."
      );
    }
  };

  /**
   * ------------------------------------------------------------
   * STATUS CHANGE
   * ------------------------------------------------------------
   */
  const handleStatusChange = async (
    buildingId: string,
    newStatus:
      | "PENDING_REVIEW"
      | "REJECTED"
  ) => {
    try {
      const res =
        await updateBuildingStatus(
          buildingId,
          newStatus
        );

      if (res.success) {
        await loadDatabaseRecords();
      } else {
        alert(
          "Failed to update building status."
        );
      }
    } catch (error) {
      console.error(
        "Status update error:",
        error
      );

      alert(
        "Failed to update building status."
      );
    }
  };

  /**
   * ------------------------------------------------------------
   * DELETE BUILDING
   * ------------------------------------------------------------
   */
  const handleDelete = async (
    buildingId: string
  ) => {
    if (
      !confirm(
        "Are you sure you want to permanently delete this cadastral submission?"
      )
    ) {
      return;
    }

    try {
      const res =
        await deleteBuilding(
          buildingId
        );

      if (res.success) {
        if (
          building?.id ===
          buildingId
        ) {
          setBuilding(null);
          setSelectedProperty(
            null
          );
        }

        await loadDatabaseRecords();
      } else {
        alert(
          "Deletion failed."
        );
      }
    } catch (error) {
      console.error(
        "Delete error:",
        error
      );

      alert(
        "Deletion failed."
      );
    }
  };

  /**
   * ------------------------------------------------------------
   * SURVEYOR VERIFICATION
   * ------------------------------------------------------------
   */
  const handleVerificationComplete =
    async (
      data: SurveyorVerificationData
    ) => {
      setVerification(
        data
      );

      if (
        building?.id &&
        data.status ===
          "APPROVED"
      ) {
        try {
          const res =
            await approveBuilding(
              building.id,
              "SURVEYOR-OFFICER-01"
            );

          if (res.success) {
            alert(
              "Building approved & assigned official ULPINs in PostgreSQL!"
            );

            await loadDatabaseRecords();
          } else {
            alert(
              "Database approval failed."
            );
          }
        } catch (error) {
          console.error(
            "Approval error:",
            error
          );

          alert(
            "Database approval failed."
          );
        }
      }
    };

  /**
   * ------------------------------------------------------------
   * PROPERTY NAVIGATION
   * ------------------------------------------------------------
   */
  const handlePropertyNavigate = (
    property:
      | Property2D
      | string
  ) => {
    const propId =
      typeof property ===
      "string"
        ? property
        : property.id;

    setSelectedProperty(
      propId
    );

    if (building) {
      sessionStorage.setItem(
        "activeBuildingData",
        JSON.stringify(
          building
        )
      );
    }

    if (propId) {
      router.push(
        `/properties/${propId}`
      );
    }
  };

  /**
   * ------------------------------------------------------------
   * PROPERTY SELECTION
   * ------------------------------------------------------------
   */
  const handlePropertySelect = (
    property:
      | Property2D
      | string
  ) => {
    const propId =
      typeof property ===
      "string"
        ? property
        : property.id;

    setSelectedProperty(
      propId
    );

    if (building) {
      sessionStorage.setItem(
        "activeBuildingData",
        JSON.stringify(
          building
        )
      );
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
      {/* ======================================================
          HEADER
          ====================================================== */}

      <header
        style={{
          height: "70px",
          minHeight: "70px",
          padding: "0 28px",
          background:
            "rgba(15, 23, 42, 0.85)",
          backdropFilter:
            "blur(12px)",
          borderBottom:
            "1px solid #1e293b",
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
          maxWidth: "100vw",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "9px",
              background:
                "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "#ffffff",
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              fontWeight: 800,
            }}
          >
            3D
          </div>

          <div>
            <div
              style={{
                fontSize: "17px",
                fontWeight: 800,
              }}
            >
              3D ULPIN Engine
            </div>

            <div
              style={{
                fontSize: "10px",
                color: "#94a3b8",
              }}
            >
              Volumetric Cadastre &
              Vertical Land Governance
            </div>
          </div>
        </div>

        {/* ROLE SWITCHER */}

        <div
          style={{
            display: "flex",
            background:
              "#0f172a",
            padding: "4px",
            borderRadius: "10px",
            border:
              "1px solid #1e293b",
          }}
        >
          <button
            type="button"
            onClick={() =>
              setRoleMode(
                "PUBLIC_VIEWER"
              )
            }
            style={{
              padding:
                "7px 14px",
              borderRadius: "7px",
              border: "none",
              background:
                roleMode ===
                "PUBLIC_VIEWER"
                  ? "#2563eb"
                  : "transparent",
              color:
                roleMode ===
                "PUBLIC_VIEWER"
                  ? "#ffffff"
                  : "#94a3b8",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            👁 Public Viewer
          </button>

          <button
            type="button"
            onClick={() =>
              setRoleMode(
                "SURVEYOR"
              )
            }
            style={{
              padding:
                "7px 14px",
              borderRadius: "7px",
              border: "none",
              background:
                roleMode ===
                "SURVEYOR"
                  ? "#059669"
                  : "transparent",
              color:
                roleMode ===
                "SURVEYOR"
                  ? "#ffffff"
                  : "#94a3b8",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🛡 Surveyor Portal
          </button>

          <button
            type="button"
            onClick={() =>
              setRoleMode(
                "UPLOADER"
              )
            }
            style={{
              padding:
                "7px 14px",
              borderRadius: "7px",
              border: "none",
              background:
                roleMode ===
                "UPLOADER"
                  ? "#d97706"
                  : "transparent",
              color:
                roleMode ===
                "UPLOADER"
                  ? "#ffffff"
                  : "#94a3b8",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            📤 Uploader Portal
          </button>
        </div>
      </header>

      {/* ======================================================
          UPLOADER MODAL
          ====================================================== */}

      {showUploader && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background:
              "rgba(2, 6, 23, 0.75)",
            backdropFilter:
              "blur(6px)",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background:
                "#0f172a",
              border:
                "1px solid #1e293b",
              borderRadius:
                "16px",
              padding: "28px",
              width: "100%",
              maxWidth: "550px",
              boxShadow:
                "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                marginBottom:
                  "20px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize:
                    "18px",
                  fontWeight: 800,
                  color:
                    "#f8fafc",
                }}
              >
                Upload Field Plan
              </h2>

              <button
                type="button"
                onClick={() =>
                  setShowUploader(
                    false
                  )
                }
                style={{
                  border: "none",
                  background:
                    "#1e293b",
                  color:
                    "#94a3b8",
                  borderRadius:
                    "6px",
                  padding:
                    "6px 10px",
                  cursor:
                    "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <FileUploader
              onParsed={
                handleParsed
              }
            />
          </div>
        </div>
      )}

      {/* ======================================================
          MAIN LAYOUT
          ====================================================== */}

      <div
        style={{
          flex: "1 1 auto",
          padding: "28px",
          maxWidth:
            "1400px",
          width: "100%",
          margin: "0 auto",
          boxSizing:
            "border-box",
          minWidth: 0,
        }}
      >
        {/* ====================================================
            SURVEYOR
            ==================================================== */}

        {roleMode ===
        "SURVEYOR" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "360px 1fr",
              gap: "24px",
              minWidth: 0,
            }}
          >
            {/* SUBMISSIONS LIST */}

            <aside
              style={{
                background:
                  "rgba(15, 23, 42, 0.6)",
                border:
                  "1px solid #1e293b",
                borderRadius:
                  "12px",
                padding: "18px",
                maxHeight:
                  "calc(100vh - 140px)",
                overflowY:
                  "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  marginBottom:
                    "16px",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize:
                      "15px",
                    fontWeight: 800,
                    color:
                      "#38bdf8",
                  }}
                >
                  📋 Managed Records (
                  {
                    buildingList.length
                  }
                  )
                </h3>

                <button
                  type="button"
                  onClick={() =>
                    setShowUploader(
                      true
                    )
                  }
                  style={{
                    background:
                      "#2563eb",
                    border:
                      "none",
                    color:
                      "#fff",
                    fontSize:
                      "11px",
                    fontWeight:
                      700,
                    padding:
                      "6px 10px",
                    borderRadius:
                      "6px",
                    cursor:
                      "pointer",
                  }}
                >
                  + Add Plan
                </button>
              </div>

              {loadingDb ? (
                <p
                  style={{
                    fontSize:
                      "12px",
                    color:
                      "#94a3b8",
                  }}
                >
                  Querying
                  database...
                </p>
              ) : buildingList.length ===
                0 ? (
                <p
                  style={{
                    fontSize:
                      "12px",
                    color:
                      "#94a3b8",
                  }}
                >
                  No cadastral
                  submissions
                  found.
                </p>
              ) : (
                buildingList.map(
                  (item) => (
                    <div
                      key={
                        item.id
                      }
                      onClick={() =>
                        setBuilding(
                          mapDbToParsedBuilding(
                            item
                          )
                        )
                      }
                      style={{
                        padding:
                          "12px",
                        borderRadius:
                          "8px",
                        marginBottom:
                          "12px",
                        background:
                          building?.id ===
                          item.id
                            ? "#1e293b"
                            : "#0f172a",
                        border:
                          building?.id ===
                          item.id
                            ? "1px solid #3b82f6"
                            : "1px solid #1e293b",
                        cursor:
                          "pointer",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize:
                              "13px",
                            fontWeight:
                              700,
                          }}
                        >
                          {
                            item.name
                          }
                        </span>

                        <span
                          style={{
                            fontSize:
                              "10px",
                            fontWeight:
                              800,
                            padding:
                              "2px 6px",
                            borderRadius:
                              "4px",
                            background:
                              item.approvalStatus ===
                              "APPROVED"
                                ? "#065f46"
                                : item.approvalStatus ===
                                    "REJECTED"
                                  ? "#881337"
                                  : "#854d0e",
                            color:
                              "#ffffff",
                          }}
                        >
                          {
                            item.approvalStatus
                          }
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop:
                            "10px",
                          display:
                            "flex",
                          gap: "6px",
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={(
                            e
                          ) => {
                            e.stopPropagation();

                            handleStatusChange(
                              item.id,
                              "PENDING_REVIEW"
                            );
                          }}
                          style={{
                            background:
                              "#334155",
                            border:
                              "none",
                            color:
                              "#cbd5e1",
                            fontSize:
                              "10px",
                            padding:
                              "4px 8px",
                            borderRadius:
                              "4px",
                            cursor:
                              "pointer",
                          }}
                        >
                          Reset Pending
                        </button>

                        <button
                          type="button"
                          onClick={(
                            e
                          ) => {
                            e.stopPropagation();

                            handleStatusChange(
                              item.id,
                              "REJECTED"
                            );
                          }}
                          style={{
                            background:
                              "#991b1b",
                            border:
                              "none",
                            color:
                              "#ffffff",
                            fontSize:
                              "10px",
                            padding:
                              "4px 8px",
                            borderRadius:
                              "4px",
                            cursor:
                              "pointer",
                          }}
                        >
                          Reject
                        </button>

                        <button
                          type="button"
                          onClick={(
                            e
                          ) => {
                            e.stopPropagation();

                            handleDelete(
                              item.id
                            );
                          }}
                          style={{
                            background:
                              "#450a0a",
                            border:
                              "none",
                            color:
                              "#f87171",
                            fontSize:
                              "10px",
                            padding:
                              "4px 8px",
                            borderRadius:
                              "4px",
                            cursor:
                              "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                )
              )}
            </aside>

            {/* SURVEYOR INSPECTION */}

            <section
              style={{
                display:
                  "flex",
                flexDirection:
                  "column",
                gap: "20px",
                minWidth: 0,
              }}
            >
              {building ? (
                <>
                  <TopologyValidator
                    building={
                      building
                    }
                  />

                  <SurveyorApprovalPanel
                    building={
                      building
                    }
                    onVerificationComplete={
                      handleVerificationComplete
                    }
                  />

                  <div
                    style={{
                      position:
                        "relative",
                      width:
                        "100%",
                      height:
                        "550px",
                      maxHeight:
                        "550px",
                      borderRadius:
                        "14px",
                      overflow:
                        "hidden",
                      border:
                        "1px solid #1e293b",
                      boxSizing:
                        "border-box",
                      minWidth: 0,
                    }}
                  >
                    <RealWorldMapViewer
                      key={
                        building.id
                      }
                      building={
                        building
                      }
                      approvalStatus={
                        verification?.status ||
                        "PENDING_REVIEW"
                      }
                      onPropertyNavigate={
                        handlePropertyNavigate
                      }
                      onPropertySelect={
                        handlePropertySelect
                      }
                    />
                  </div>
                </>
              ) : (
                <div
                  style={{
                    textAlign:
                      "center",
                    padding:
                      "80px",
                    color:
                      "#94a3b8",
                  }}
                >
                  Select an upload
                  from the left
                  panel to inspect
                  and manage.
                </div>
              )}
            </section>
          </div>
        ) : (
          /* ==================================================
             PUBLIC + UPLOADER
             ================================================== */

          <div
            style={{
              display:
                "flex",
              flexDirection:
                "column",
              gap: "24px",
              width: "100%",
              minWidth: 0,
            }}
          >
            {/* ==================================================
                PUBLIC VIEWER
                ================================================== */}

            {roleMode ===
              "PUBLIC_VIEWER" && (
              <>
                {building ? (
                  <>
                    <ULPINSearch
                      building={
                        building
                      }
                      onSelectProperty={(
                        id
                      ) =>
                        handlePropertyNavigate(
                          id
                        )
                      }
                    />

                    {/* 3D + GRAPH */}

                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "1fr 1fr",
                        gap: "20px",
                        width:
                          "100%",
                        minWidth: 0,
                        overflow:
                          "hidden",
                      }}
                    >
                      {/* 3D MODEL */}

                      <section
                        style={{
                          background:
                            "rgba(15, 23, 42, 0.6)",
                          border:
                            "1px solid #1e293b",
                          borderRadius:
                            "12px",
                          padding:
                            "20px",
                          minWidth: 0,
                          overflow:
                            "hidden",
                        }}
                      >
                        <div
                          style={{
                            fontSize:
                              "16px",
                            fontWeight:
                              800,
                          }}
                        >
                          3D Building
                          Model
                        </div>

                        <div
                          style={{
                            marginTop:
                              "16px",
                            height:
                              "420px",
                            maxHeight:
                              "420px",
                            borderRadius:
                              "10px",
                            overflow:
                              "hidden",
                            background:
                              "#020617",
                            border:
                              "1px solid #1e293b",
                            position:
                              "relative",
                          }}
                        >
                          <VolumetricViewer
                            building={
                              building
                            }
                            selectedPropertyId={
                              selectedProperty
                            }
                            onPropertySelect={(
                              property
                            ) =>
                              handlePropertySelect(
                                property.id
                              )
                            }
                          />
                        </div>
                      </section>

                      {/* CADASTRAL GRAPH */}

                      <section
                        style={{
                          background:
                            "rgba(15, 23, 42, 0.6)",
                          border:
                            "1px solid #1e293b",
                          borderRadius:
                            "12px",
                          padding:
                            "20px",
                          minWidth: 0,
                          overflow:
                            "hidden",
                        }}
                      >
                        <div
                          style={{
                            fontSize:
                              "16px",
                            fontWeight:
                              800,
                          }}
                        >
                          Cadastral Graph
                        </div>

                        <div
                          style={{
                            marginTop:
                              "16px",
                            height:
                              "420px",
                            maxHeight:
                              "420px",
                            borderRadius:
                              "10px",
                            overflow:
                              "auto",
                            background:
                              "#020617",
                            border:
                              "1px solid #1e293b",
                            position:
                              "relative",
                          }}
                        >
                          <CadastralGraph
                            building={
                              building
                            }
                            selectedNodeId={
                              selectedProperty
                            }
                            onNodeSelect={(
                              nodeId
                            ) =>
                              handlePropertySelect(
                                nodeId
                              )
                            }
                          />
                        </div>
                      </section>
                    </div>

                    {/* ==================================================
                        REAL WORLD MAP
                        ================================================== */}

                    <div
                      style={{
                        position:
                          "relative",
                        width:
                          "100%",
                        height:
                          "550px",
                        maxHeight:
                          "550px",
                        borderRadius:
                          "14px",
                        overflow:
                          "hidden",
                        border:
                          "1px solid #1e293b",
                        boxSizing:
                          "border-box",
                        minWidth: 0,
                      }}
                    >
                      <RealWorldMapViewer
                        key={
                          building.id
                        }
                        building={
                          building
                        }
                        approvalStatus="APPROVED"
                        onPropertyNavigate={
                          handlePropertyNavigate
                        }
                        onPropertySelect={
                          handlePropertySelect
                        }
                      />
                    </div>

                    <ExportPanel
                      building={
                        building
                      }
                    />
                  </>
                ) : (
                  <div
                    style={{
                      textAlign:
                        "center",
                      padding:
                        "80px",
                      color:
                        "#94a3b8",
                    }}
                  >
                    No verified public
                    buildings found.
                  </div>
                )}
              </>
            )}

            {/* ==================================================
                UPLOADER
                ================================================== */}

            {roleMode ===
              "UPLOADER" && (
              <section
                style={{
                  background:
                    "rgba(15, 23, 42, 0.6)",
                  padding:
                    "24px",
                  borderRadius:
                    "12px",
                  border:
                    "1px solid #1e293b",
                }}
              >
                <h3
                  style={{
                    margin:
                      "0 0 12px",
                    fontSize:
                      "18px",
                    color:
                      "#f8fafc",
                  }}
                >
                  Upload Revisions &
                  Field Drawings
                </h3>

                <FileUploader
                  onParsed={
                    handleParsed
                  }
                />
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
