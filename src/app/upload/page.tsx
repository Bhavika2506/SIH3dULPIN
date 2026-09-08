"use client";

import { useState } from "react";
import FileUploader from "@/src/components/FileUploader";
import RealWorldMapViewer from "@/src/components/RealWorldMapViewer";
import type { ParsedBuilding } from "@/src/lib/parser/types";

export default function UploadPage() {
  const [building, setBuilding] = useState<ParsedBuilding | null>(null);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "40px 25px",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            marginBottom: "25px",
          }}
        >
          <a
            href="/"
            style={{
              fontSize: "12px",
              color: "#2563eb",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            ← Back to Dashboard
          </a>

          <h1
            style={{
              margin: "15px 0 5px",
              fontSize: "28px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Import 2D Property Data
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "#64748b",
            }}
          >
            Upload a cadastral or architectural floor plan to generate a 3D
            property structure and cadastral graph.
          </p>
        </div>

        {/* 
          FileUploader parses the uploaded GeoJSON.
          The resulting ParsedBuilding is passed back here.
        */}
        <FileUploader
          onParsed={(parsedBuilding) => {
            console.log("Uploaded ParsedBuilding:", parsedBuilding);
            console.log(
              "Uploaded GeoReference:",
              parsedBuilding.georeference
            );

            setBuilding(parsedBuilding);
          }}
        />

        {/* 
          RealWorldMapViewer receives ONLY the parsed building.
          It must obtain coordinates from:
          building.georeference.latitude
          building.georeference.longitude
        */}
        {building && (
          <div
            style={{
              marginTop: "25px",
              width: "100%",
              height: "650px",
            }}
          >
            <RealWorldMapViewer
              building={building}
            />
          </div>
        )}
      </div>
    </main>
  );
}