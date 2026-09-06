import { Point2D } from "./parser/types";

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

export function normalizePolygon(polygon: Point2D[], origin: Point2D): Point2D[] {
  return polygon.map((p) => ({
    x: p.x - origin.x,
    y: p.y - origin.y,
  }));
}

export function getPolygonCenter(polygon: Point2D[]): Point2D {
  if (!polygon.length) return { x: 0, y: 0 };
  const sum = polygon.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return {
    x: sum.x / polygon.length,
    y: sum.y / polygon.length,
  };
}