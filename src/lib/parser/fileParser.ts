import { ParsedBuilding, Floor2D, Property2D, Point2D } from "./types";

// ==========================================
// GEOJSON TYPES
// ==========================================
export type GeoJSONFeature = {
  type: "Feature";
  properties?: {
    id?: string;
    unitNumber?: string;
    unit?: string;
    floor?: number;
    floorNumber?: number;
    area?: number;
    areaSqMeters?: number;
    height?: number;
    heightMeters?: number;
    elevationMeters?: number;
    spaceType?: string;
    ulpin?: string;
  };
  geometry: {
    type: string;
    coordinates: any;
  };
};

export type GeoJSONFile = {
  type: "FeatureCollection";
  name?: string;
  buildingName?: string;
  buildingId?: string;
  features: GeoJSONFeature[];
};

const TOTAL_FLOORS = 5;
const FLOOR_HEIGHT = 3.2;

/**
 * Calculates the 2D polygon surface area using the Shoelace formula.
 */
export function calculateArea(polygon: Point2D[]): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return Math.round((Math.abs(area) / 2) * 100) / 100;
}

export function detectFileFormat(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ext || "unknown";
}

function convertPolygon(coordinates: number[][][]): Point2D[] {
  if (!coordinates?.[0]) return [];
  return coordinates[0]
    .filter(
      (point): point is [number, number] =>
        Array.isArray(point) &&
        point.length >= 2 &&
        Number.isFinite(Number(point[0])) &&
        Number.isFinite(Number(point[1]))
    )
    .map(([x, y]) => ({
      x: Number(x),
      y: Number(y),
    }));
}

function createDefaultPolygon(unitIndex: number): Point2D[] {
  const column = unitIndex % 2;
  const row = Math.floor(unitIndex / 2);
  const x = column * 10;
  const y = row * 10;
  const width = 8;
  const depth = 8;

  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + depth },
    { x, y: y + depth },
    { x, y },
  ];
}

/**
 * Parses a GeoJSON FeatureCollection into a 3D ParsedBuilding structure.
 */
export function parseGeoJSON(json: GeoJSONFile, buildingName = "Cadastral Building"): ParsedBuilding {
  if (!json || json.type !== "FeatureCollection" || !Array.isArray(json.features)) {
    return generateFallbackBuilding(buildingName);
  }

  const floorMap = new Map<number, Property2D[]>();

  json.features.forEach((feature, index) => {
    const props = feature.properties ?? {};

    let floorNumber = Number(props.floorNumber ?? props.floor ?? 1);
    if (!Number.isFinite(floorNumber)) floorNumber = 1;

    const unitNumber =
      props.unitNumber ?? props.unit ?? `F${floorNumber}-UNIT-${index + 1}`;
    const id = props.id ?? `PROPERTY-F${floorNumber}-${index + 1}`;

    let polygon: Point2D[] = [];
    if (
      feature.geometry?.type === "Polygon" &&
      Array.isArray(feature.geometry.coordinates)
    ) {
      polygon = convertPolygon(feature.geometry.coordinates);
    }

    if (polygon.length < 3) {
      polygon = createDefaultPolygon(index);
    }

    const calculatedArea = calculateArea(polygon);
    const area = Number(props.area ?? props.areaSqMeters) > 0
      ? Number(props.area ?? props.areaSqMeters)
      : calculatedArea > 0
      ? calculatedArea
      : 64;

    const spaceType = props.spaceType || unitNumber;

    const propertyUnit: Property2D & { spaceType?: string } = {
      id,
      unitNumber,
      floorNumber,
      area,
      polygon,
      spaceType,
      ulpin: props.ulpin || `3D-${buildingName.toUpperCase()}-F${String(floorNumber).padStart(2, "0")}-${unitNumber}`,
    };

    if (!floorMap.has(floorNumber)) {
      floorMap.set(floorNumber, []);
    }
    floorMap.get(floorNumber)!.push(propertyUnit);
  });

  const floors: Floor2D[] = Array.from(floorMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([floorNum, units], idx) => ({
      floorNumber: floorNum,
      elevation: idx * FLOOR_HEIGHT,
      height: FLOOR_HEIGHT,
      units,
    }));

  return {
    id: json.buildingId || `BLD-${Date.now().toString().slice(-4)}`,
    name: json.buildingName || json.name || buildingName,
    floors: floors.length > 0 ? floors : generateFallbackBuilding(buildingName).floors,
  };
}

/**
 * Universal async file parser entry point.
 */
export async function parseUploadedFile(file: File): Promise<ParsedBuilding> {
  const format = detectFileFormat(file.name);
  const buildingName = file.name.replace(/\.[^/.]+$/, "");

  if (format === "geojson" || format === "json") {
    try {
      const content = await file.text();
      const json = JSON.parse(content);
      return parseGeoJSON(json, buildingName);
    } catch (e) {
      console.warn("Error parsing GeoJSON structure:", e);
    }
  }

  if (format === "dxf") {
    try {
      const content = await file.text();
      const polygons = parseDXFPolygons(content);
      if (polygons.length > 0) {
        return buildBuildingFromPolygons(polygons, buildingName);
      }
    } catch (e) {
      console.warn("Error parsing DXF structure:", e);
    }
  }

  if (format === "svg") {
    try {
      const content = await file.text();
      const polygons = parseSVGPolygons(content);
      if (polygons.length > 0) {
        return buildBuildingFromPolygons(polygons, buildingName);
      }
    } catch (e) {
      console.warn("Error parsing SVG structure:", e);
    }
  }

  return generateFallbackBuilding(buildingName);
}

function parseDXFPolygons(dxfContent: string): Point2D[][] {
  const polygons: Point2D[][] = [];
  const lines = dxfContent.split(/\r?\n/);
  let currentPolygon: Point2D[] = [];
  let readingPolyline = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "LWPOLYLINE" || line === "POLYLINE") {
      if (currentPolygon.length >= 3) polygons.push(currentPolygon);
      currentPolygon = [];
      readingPolyline = true;
    } else if (readingPolyline && line === "10") {
      const x = parseFloat(lines[i + 1]);
      if (lines[i + 2]?.trim() === "20") {
        const y = parseFloat(lines[i + 3]);
        if (!isNaN(x) && !isNaN(y)) currentPolygon.push({ x, y });
      }
    }
  }
  if (currentPolygon.length >= 3) polygons.push(currentPolygon);
  return polygons;
}

function parseSVGPolygons(svgContent: string): Point2D[][] {
  const polygons: Point2D[][] = [];
  const polygonMatches = svgContent.matchAll(/points=["']([^"']+)["']/g);
  for (const match of polygonMatches) {
    const rawPoints = match[1].trim().split(/\s+|,/);
    const points: Point2D[] = [];
    for (let i = 0; i < rawPoints.length - 1; i += 2) {
      const x = parseFloat(rawPoints[i]);
      const y = parseFloat(rawPoints[i + 1]);
      if (!isNaN(x) && !isNaN(y)) points.push({ x, y });
    }
    if (points.length >= 3) polygons.push(points);
  }
  return polygons;
}

function buildBuildingFromPolygons(polygons: Point2D[][], buildingName: string): ParsedBuilding {
  const units: Property2D[] = polygons.map((polygon, index) => ({
    id: `UNIT-${101 + index}`,
    unitNumber: `${101 + index}`,
    floorNumber: 1,
    area: calculateArea(polygon),
    polygon,
    ulpin: `3D-${buildingName.toUpperCase()}-F01-${101 + index}`,
  }));

  return {
    id: `BLD-${Date.now().toString().slice(-4)}`,
    name: buildingName,
    floors: [{ floorNumber: 1, elevation: 0, height: FLOOR_HEIGHT, units }],
  };
}

function generateFallbackBuilding(buildingName: string): ParsedBuilding {
  const floors: Floor2D[] = [];
  for (let floorNumber = 1; floorNumber <= TOTAL_FLOORS; floorNumber++) {
    floors.push({
      floorNumber,
      elevation: (floorNumber - 1) * FLOOR_HEIGHT,
      height: FLOOR_HEIGHT,
      units: [
        {
          id: `PROP-F${floorNumber}-101`,
          unitNumber: `F${floorNumber}-101`,
          floorNumber,
          area: 64,
          polygon: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 0, y: 8 }],
          ulpin: `3D-${buildingName.toUpperCase()}-F0${floorNumber}-101`,
        },
        {
          id: `PROP-F${floorNumber}-102`,
          unitNumber: `F${floorNumber}-102`,
          floorNumber,
          area: 64,
          polygon: [{ x: 10, y: 0 }, { x: 18, y: 0 }, { x: 18, y: 8 }, { x: 10, y: 8 }],
          ulpin: `3D-${buildingName.toUpperCase()}-F0${floorNumber}-102`,
        },
      ],
    });
  }

  return {
    id: `BLD-FALLBACK-${Date.now().toString().slice(-4)}`,
    name: buildingName,
    floors,
  };
}