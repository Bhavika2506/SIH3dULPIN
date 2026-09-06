import { ParsedBuilding } from "./types";
import { parseGeoJSON } from "./geojsonParser";

export function parsePDFText(
  pdfContent: string,
  buildingName: string = "PDF Architectural Building"
): ParsedBuilding | null {
  if (pdfContent.includes("FeatureCollection") || pdfContent.includes('"coordinates"')) {
    const jsonMatch = pdfContent.match(/\{[\s\S]*"type"\s*:\s*"FeatureCollection"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const json = JSON.parse(jsonMatch[0]);
        return parseGeoJSON(json, buildingName);
      } catch (e) {
        console.warn("Failed to parse embedded GeoJSON stream in PDF:", e);
      }
    }
  }
  return null;
}