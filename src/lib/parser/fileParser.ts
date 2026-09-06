import { ParsedBuilding } from "./types";
import { parseGeoJSON } from "./geojsonParser";
import { parseDXF } from "./dxfParser";
import { parseSVG } from "./svgParser";
import { parsePDFText } from "./pdfParser";

export function detectFileFormat(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ext || "unknown";
}

export async function parseUploadedFile(file: File): Promise<ParsedBuilding> {
  const format = detectFileFormat(file.name);
  const buildingName = file.name.replace(/\.[^/.]+$/, "");
  const content = await file.text();

  // 1. GEOJSON / JSON
  if (format === "geojson" || format === "json") {
    try {
      const json = JSON.parse(content);
      return parseGeoJSON(json, buildingName);
    } catch (e) {
      console.warn("Error parsing GeoJSON stream:", e);
    }
  }

  // 2. DXF
  if (format === "dxf") {
    try {
      const parsed = parseDXF(content, buildingName);
      if (parsed.floors[0].units.length > 0) return parsed;
    } catch (e) {
      console.warn("Error parsing DXF contents:", e);
    }
  }

  // 3. SVG
  if (format === "svg") {
    try {
      const parsed = parseSVG(content, buildingName);
      if (parsed.floors[0].units.length > 0) return parsed;
    } catch (e) {
      console.warn("Error parsing SVG contents:", e);
    }
  }

  // 4. PDF / TXT
  if (format === "pdf" || format === "txt") {
    try {
      const parsed = parsePDFText(content, buildingName);
      if (parsed) return parsed;
    } catch (e) {
      console.warn("Error reading spatial stream from PDF/Text file:", e);
    }
  }

  // Fallback demo structure for unknown or corrupted formats
  return {
    id: `BLD-${Date.now().toString().slice(-4)}`,
    name: buildingName,
    floors: [
      {
        floorNumber: 1,
        elevation: 0,
        height: 3.2,
        units: [
          {
            id: "PROP-101",
            unitNumber: "101",
            floorNumber: 1,
            area: 80,
            polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }],
            ulpin: `3D-${buildingName.toUpperCase()}-F01-101`,
          },
          {
            id: "PROP-102",
            unitNumber: "102",
            floorNumber: 1,
            area: 80,
            polygon: [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 8 }, { x: 10, y: 8 }],
            ulpin: `3D-${buildingName.toUpperCase()}-F01-102`,
          },
        ],
      },
      {
        floorNumber: 2,
        elevation: 3.2,
        height: 3.2,
        units: [
          {
            id: "PROP-201",
            unitNumber: "201",
            floorNumber: 2,
            area: 80,
            polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }],
            ulpin: `3D-${buildingName.toUpperCase()}-F02-201`,
          },
          {
            id: "PROP-202",
            unitNumber: "202",
            floorNumber: 2,
            area: 80,
            polygon: [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 8 }, { x: 10, y: 8 }],
            ulpin: `3D-${buildingName.toUpperCase()}-F02-202`,
          },
        ],
      },
    ],
  };
}