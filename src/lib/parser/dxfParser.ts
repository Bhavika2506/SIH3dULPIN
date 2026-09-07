import { ParsedBuilding, Floor2D, Property2D, Point2D } from "./types";
import { calculateArea } from "./geojsonParser";

const DEFAULT_FLOOR_HEIGHT = 3.2;

export function parseDXF(
  dxfContent: string,
  buildingName: string = "AutoCAD DXF Building"
): ParsedBuilding {
  const polygons: Point2D[][] = [];
  const lines = dxfContent.split(/\r?\n/);
  let currentPolygon: Point2D[] = [];
  let readingPolyline = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "LWPOLYLINE" || line === "POLYLINE") {
      if (currentPolygon.length >= 3) {
        polygons.push(currentPolygon);
      }
      currentPolygon = [];
      readingPolyline = true;
    } else if (readingPolyline && line === "10") {
      const x = parseFloat(lines[i + 1]);
      if (lines[i + 2]?.trim() === "20") {
        const y = parseFloat(lines[i + 3]);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          currentPolygon.push({ x, y });
        }
      }
    }
  }

  if (currentPolygon.length >= 3) {
    polygons.push(currentPolygon);
  }

  const units: Property2D[] = polygons.map((polygon, index) => ({
    id: `DXF-PROP-1-${index + 1}`,
    unitNumber: `10${index + 1}`,
    floorNumber: 1,
    area: calculateArea(polygon),
    polygon,
    ulpin: `3D-${buildingName.toUpperCase()}-F01-10${index + 1}`,
  }));

  return {
    id: `BLD-${Date.now().toString().slice(-4)}`,
    name: buildingName,
    floors: [
      {
        floorNumber: 1,
        elevation: 0,
        height: DEFAULT_FLOOR_HEIGHT,
        units,
      },
    ],
  };
}