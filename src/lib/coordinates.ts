import type { Point2D } from "@/src/lib/parser/types";

export interface GeoAnchor {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS = 6378137; // Mean Earth radius in meters

/**
 * Projects local Cartesian offsets (x, y in meters) relative to a GNSS anchor
 * into WGS84 Geographic coordinates [longitude, latitude].
 */
export function projectLocalToGeographic(
  xMeters: number,
  yMeters: number,
  anchor: GeoAnchor
): [number, number] {
  const dLat = yMeters / EARTH_RADIUS;
  const dLng =
    xMeters / (EARTH_RADIUS * Math.cos((Math.PI * anchor.latitude) / 180));

  const newLat = anchor.latitude + (dLat * 180) / Math.PI;
  const newLng = anchor.longitude + (dLng * 180) / Math.PI;

  return [newLng, newLat];
}

/**
 * Calculates bounding box origin across all 2D polygons.
 */
export function getBuildingOrigin(polygons: Point2D[][]): Point2D {
  const points = polygons.flat();
  if (!points.length) return { x: 0, y: 0 };

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

/**
 * Normalizes polygon points relative to an origin center.
 */
export function normalizePolygon(
  polygon: Point2D[],
  origin: Point2D
): Point2D[] {
  return polygon.map((p) => ({
    x: p.x - origin.x,
    y: p.y - origin.y,
  }));
}

/**
 * Calculates the centroid point of a 2D polygon.
 */
export function getPolygonCenter(polygon: Point2D[]): Point2D {
  if (!polygon.length) return { x: 0, y: 0 };
  const sum = polygon.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  return {
    x: sum.x / polygon.length,
    y: sum.y / polygon.length,
  };
}