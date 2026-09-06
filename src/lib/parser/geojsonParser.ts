import { ParsedBuilding, Floor2D, Property2D, Point2D } from "./types";

// ==========================================
// TYPES & CONSTANTS
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
    height?: number;
    ownerName?: string;
    propertyType?: string;
  };
  geometry: {
    type: string;
    coordinates: any;
  };
};

export type GeoJSONFile = {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
};

const DEFAULT_FLOOR_HEIGHT = 3.2;

// ==========================================
// AREA & GEOMETRY UTILITIES
// ==========================================

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
  const column = unitIndex % 3;
  const row = Math.floor(unitIndex / 3);

  const x = column * 10;
  const y = row * 8;
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

// ==========================================
// PARSER
// ==========================================

export function parseGeoJSON(
  json: GeoJSONFile,
  buildingName: string = "GeoJSON Cadastral Building"
): ParsedBuilding {
  if (!json || json.type !== "FeatureCollection" || !Array.isArray(json.features)) {
    throw new Error("Invalid GeoJSON file structure.");
  }

  const floorMap = new Map<number, Property2D[]>();

  json.features.forEach((feature, index) => {
    const properties = feature.properties ?? {};

    let floorNumber = Number(
      properties.floorNumber ?? properties.floor ?? 1
    );

    if (!Number.isFinite(floorNumber)) floorNumber = 1;
    floorNumber = Math.max(0, Math.round(floorNumber));

    const unitNumber =
      properties.unitNumber ?? properties.unit ?? `UNIT-${index + 1}`;

    const id = properties.id ?? `PROP-F${floorNumber}-${index + 1}`;

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

    const area =
      Number(properties.area) > 0
        ? Number(properties.area)
        : calculateArea(polygon);

    const property: Property2D = {
      id,
      unitNumber: String(unitNumber),
      floorNumber,
      area,
      polygon,
      ulpin: `3D-${buildingName.toUpperCase()}-F${String(floorNumber).padStart(2, "0")}-${unitNumber}`,
    };

    if (!floorMap.has(floorNumber)) {
      floorMap.set(floorNumber, []);
    }
    floorMap.get(floorNumber)!.push(property);
  });

  const floors: Floor2D[] = Array.from(floorMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([floorNumber, units], idx) => ({
      floorNumber,
      elevation: idx * DEFAULT_FLOOR_HEIGHT,
      height: DEFAULT_FLOOR_HEIGHT,
      units,
    }));

  return {
    id: `BLD-${Date.now().toString().slice(-4)}`,
    name: buildingName,
    floors,
  };
}