"use client";

import {
  validateCadastralModel,
  ValidationResult,
} from "@/src/lib/validator";

function StatusIcon({
  status,
}: {
  status: ValidationResult["status"];
}) {

  if (status === "PASS") {
    return (
      <span
        style={{
          color: "#059669",
          fontWeight: "700",
        }}
      >
        ✓
      </span>
    );
  }

  if (status === "WARNING") {
    return (
      <span
        style={{
          color: "#d97706",
          fontWeight: "700",
        }}
      >
        !
      </span>
    );
  }

  return (
    <span
      style={{
        color: "#dc2626",
        fontWeight: "700",
      }}
    >
      ✕
    </span>
  );
}


function StatusBadge({
  status,
}: {
  status: ValidationResult["status"];
}) {

  const background =
    status === "PASS"
      ? "#ecfdf5"
      : status === "WARNING"
      ? "#fffbeb"
      : "#fef2f2";


  const color =
    status === "PASS"
      ? "#047857"
      : status === "WARNING"
      ? "#b45309"
      : "#b91c1c";


  return (
    <span
      style={{
        background,
        color,
        padding: "4px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: "700",
      }}
    >
      {status}
    </span>
  );
}


export default function TopologyValidator() {

  const results =
    validateCadastralModel();


  const passed =
    results.filter(
      (result) =>
        result.status === "PASS"
    ).length;


  const warnings =
    results.filter(
      (result) =>
        result.status === "WARNING"
    ).length;


  const failures =
    results.filter(
      (result) =>
        result.status === "FAIL"
    ).length;


  const overallStatus =
    failures > 0
      ? "INVALID"
      : warnings > 0
      ? "REVIEW"
      : "VALID";


  return (

    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >

      {/* HEADER */}

      <div
        style={{
          padding: "20px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >

          <div>

            <h2
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: "700",
              }}
            >
              Topology Validation
            </h2>

            <p
              style={{
                margin:
                  "6px 0 0",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              Automated validation of
              the 3D cadastral model.
            </p>

          </div>


          <div
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              background:
                overallStatus ===
                "VALID"
                  ? "#ecfdf5"
                  : overallStatus ===
                    "REVIEW"
                  ? "#fffbeb"
                  : "#fef2f2",
              color:
                overallStatus ===
                "VALID"
                  ? "#047857"
                  : overallStatus ===
                    "REVIEW"
                  ? "#b45309"
                  : "#b91c1c",
              fontWeight: "800",
              fontSize: "14px",
            }}
          >
            {overallStatus}
          </div>

        </div>


        {/* SUMMARY */}

        <div
          style={{
            display: "flex",
            gap: "24px",
            marginTop: "18px",
          }}
        >

          <Summary
            label="Passed"
            value={passed}
          />

          <Summary
            label="Warnings"
            value={warnings}
          />

          <Summary
            label="Failed"
            value={failures}
          />

        </div>

      </div>


      {/* RESULTS */}

      <div>

        {results.map(
          (result) => (

            <div
              key={result.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "14px",
                padding: "18px 20px",
                borderBottom:
                  "1px solid #f1f5f9",
              }}
            >

              <div
                style={{
                  fontSize: "20px",
                  width: "24px",
                }}
              >
                <StatusIcon
                  status={
                    result.status
                  }
                />
              </div>


              <div
                style={{
                  flex: 1,
                }}
              >

                <div
                  style={{
                    fontWeight: "700",
                    fontSize: "14px",
                    marginBottom: "4px",
                  }}
                >
                  {result.name}
                </div>


                <div
                  style={{
                    color: "#64748b",
                    fontSize: "13px",
                    marginBottom: "5px",
                  }}
                >
                  {result.description}
                </div>


                <div
                  style={{
                    color: "#334155",
                    fontSize: "12px",
                  }}
                >
                  {result.details}
                </div>

              </div>


              <StatusBadge
                status={
                  result.status
                }
              />

            </div>

          )
        )}

      </div>

    </div>
  );
}


// ==========================================
// SUMMARY
// ==========================================

function Summary({
  label,
  value,
}: {
  label: string;
  value: number;
}) {

  return (

    <div>

      <div
        style={{
          fontSize: "22px",
          fontWeight: "800",
        }}
      >
        {value}
      </div>

      <div
        style={{
          color: "#64748b",
          fontSize: "12px",
        }}
      >
        {label}
      </div>

    </div>
  );
}