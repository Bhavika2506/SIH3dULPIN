import { ParsedBuilding, Floor2D, Property2D, Point2D } from "./types";
import { calculateArea } from "./geojsonParser";

const DEFAULT_FLOOR_HEIGHT = 3.2;

export function parseSVG(
  svgContent: string,
  buildingName: string = "SVG Vector Building"
): ParsedBuilding {
  const polygons: Point2D[][] = [];

  // Extract <polygon points="..." />
  const polygonMatches = svgContent.matchAll(/points=["']([^"']+)["']/g);
  for (const match of polygonMatches) {
    const rawPoints = match[1].trim().split(/\s+|,/);
    const points: Point2D[] = [];
    for (let i = 0; i < rawPoints.length - 1; i += 2) {
      const x = parseFloat(rawPoints[i]);
      const y = parseFloat(rawPoints[i + 1]);
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
    }
    if (points.length >= 3) polygons.push(points);
  }

  // Extract <rect x="..." y="..." width="..." height="..." />
  const rectMatches = svgContent.matchAll(/<rect[^>]+>/g);
  for (const match of rectMatches) {
    const rectStr = match[0];
    const xMatch = rectStr.match(/x=["']([^"']+)["']/);
    const yMatch = rectStr.match(/y=["']([^"']+)["']/);
    const wMatch = rectStr.match(/width=["']([^"']+)["']/);
    const hMatch = rectStr.match(/height=["']([^"']+)["']/);

    if (wMatch && hMatch) {
      const x = xMatch ? parseFloat(xMatch[1]) : 0;
      const y = yMatch ? parseFloat(yMatch[1]) : 0;
      const w = parseFloat(wMatch[1]);
      const h = parseFloat(hMatch[1]);

      if (Number.isFinite(w) && Number.isFinite(h)) {
        polygons.push([
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h },
        ]);
      }
    }
  }

  const units: Property2D[] = polygons.map((polygon, index) => ({
    id: `SVG-PROP-1-${index + 1}`,
    unitNumber: `10${index + 1}`,
    floorNumber: 1,
    area: calculateArea(polygon),
    polygon,
    ulpin: `3D-${buildingName.toUpperCase()}-F01-10${index + 1}`,
  }));

  const floors: Floor2D[] = [
    {
      floorNumber: 1,
      elevation: 0,
      height: DEFAULT_FLOOR_HEIGHT,
      units,
    },
  ];

  return {
    id: `BLD-${Date.now().toString().slice(-4)}`,
    name: buildingName,
    floors,
  };
}