import type { Point2D, Property2D, Floor2D, ParsedBuilding } from "../parser/types";
import { calculateArea } from "../parser/geojsonParser";
import { generate3DULPIN } from "../ulpin/generator";

export interface AIProcessOptions {
  buildingName: string;
  totalFloors: number;
  storyHeight: number;
  scalePixelsPerMeter: number;
}

/**
 * Simplifies a polygon boundary using a light Douglas-Peucker approach to remove noisy vertices
 */
export function simplifyContour(points: Point2D[], tolerance: number = 0.5): Point2D[] {
  if (points.length <= 4) return points;

  const simplified: Point2D[] = [points[0]];
  let lastPoint = points[0];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = Math.hypot(points[i].x - lastPoint.x, points[i].y - lastPoint.y);
    if (dist >= tolerance) {
      simplified.push(points[i]);
      lastPoint = points[i];
    }
  }

  simplified.push(points[points.length - 1]);
  return simplified;
}

/**
 * Classifies extracted boundary spaces based on area and geometric ratios
 */
export function classifySpaceType(area: number, width: number, height: number): {
  spaceType: "ROOM" | "STAIRS" | "LIFT" | "PASSAGE" | "UTILITY";
  suggestedName: string;
} {
  const aspectRatio = Math.max(width / height, height / width);

  // Long, narrow polygons are classified as circulation corridors
  if (aspectRatio > 3.0 && area > 15) {
    return { spaceType: "PASSAGE", suggestedName: "Circulation Corridor" };
  }

  // Small square-ish regions are classified as lifts or vertical shafts
  if (area >= 4 && area <= 12 && aspectRatio < 1.5) {
    return { spaceType: "LIFT", suggestedName: "Elevator Core Shaft" };
  }

  // Medium compact regions are classified as stairwells
  if (area > 12 && area <= 24 && aspectRatio < 2.0) {
    return { spaceType: "STAIRS", suggestedName: "Vertical Stairwell" };
  }

  return { spaceType: "ROOM", suggestedName: "Property Unit" };
}

/**
 * Main AI/ML Segmentation Engine: Simulates vector contour extraction from raster floorplan matrices
 */
export async function processFloorPlanImage(
  imageData: ImageData | string,
  options: AIProcessOptions
): Promise<ParsedBuilding> {
  const scale = options.scalePixelsPerMeter || 20; // Default 20px per meter
  const floors: Floor2D[] = [];

  for (let floorIdx = 1; floorIdx <= options.totalFloors; floorIdx++) {
    const units: Property2D[] = [];
    const elevation = (floorIdx - 1) * options.storyHeight;

    // Grid matrix detection simulation for architectural extraction
    const rawBounds = [
      // Left Wing Units
      [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 160 }, { x: 0, y: 160 }],
      [{ x: 0, y: 160 }, { x: 120, y: 160 }, { x: 120, y: 320 }, { x: 0, y: 320 }],
      // Central Corridor
      [{ x: 120, y: 0 }, { x: 160, y: 0 }, { x: 160, y: 320 }, { x: 120, y: 320 }],
      // Vertical Cores (Stairs & Lift)
      [{ x: 160, y: 0 }, { x: 240, y: 0 }, { x: 240, y: 80 }, { x: 160, y: 80 }],
      [{ x: 240, y: 0 }, { x: 280, y: 0 }, { x: 280, y: 80 }, { x: 240, y: 80 }],
      // Right Wing Units
      [{ x: 160, y: 80 }, { x: 280, y: 80 }, { x: 280, y: 320 }, { x: 160, y: 320 }],
    ];

    rawBounds.forEach((pixelRing, idx) => {
      // Scale pixel values to meters
      const polygonMeters: Point2D[] = pixelRing.map((p) => ({
        x: Math.round((p.x / scale) * 100) / 100,
        y: Math.round((p.y / scale) * 100) / 100,
      }));

      const simplified = simplifyContour(polygonMeters);
      const area = calculateArea(simplified);

      const xs = simplified.map((p) => p.x);
      const ys = simplified.map((p) => p.y);
      const width = Math.max(...xs) - Math.min(...xs);
      const height = Math.max(...ys) - Math.min(...ys);

      const classification = classifySpaceType(area, width, height);
      const unitCode = `U${floorIdx}0${idx + 1}`;

      const ulpin = generate3DULPIN({
        stateCode: "14",
        districtCode: "4012",
        surfaceParcelId: "0088",
        floorLevel: floorIdx,
        unitIdentifier: unitCode,
        spaceType: classification.spaceType,
      });

      units.push({
        id: `AI-PROP-F${floorIdx}-${idx + 1}`,
        unitNumber: `${classification.suggestedName} ${unitCode}`,
        floorNumber: floorIdx,
        area,
        polygon: simplified,
        ulpin,
        spaceType: classification.spaceType,
      } as Property2D);
    });

    floors.push({
      floorNumber: floorIdx,
      elevation,
      height: options.storyHeight,
      units,
    });
  }

  return {
    id: `BLD-AI-${Date.now().toString().slice(-4)}`,
    name: options.buildingName || "AI_Extracted_Building",
    floors,
  };
}