
import type {
  ParsedBuilding,
  Floor2D,
  Property2D,
  Point2D,
} from "./types";

/**
 * ============================================================
 * GEOJSON TYPES
 * ============================================================
 */

interface GeoJSONFeature {
  type: "Feature";

  properties?: {
    id?: string;
    unitNumber?: string;

    floorNumber?: number | string;
    area?: number | string;

    elevationMeters?: number | string;
    heightMeters?: number | string;

    ulpin?: string;
    spaceType?: string;

    /**
     * Some cadastral files put georeference inside
     * Feature properties.
     */
    georeference?: {
      latitude?: number | string;
      longitude?: number | string;
      elevationOffset?: number | string;
    };
  };

  geometry?: {
    type: "Polygon" | "MultiPolygon";
    coordinates: unknown;
  };
}

interface CadastralGeoJSON {
  type: "FeatureCollection";

  buildingName?: string;
  buildingId?: string;

  /**
   * Primary expected location.
   *
   * Example:
   *
   * "georeference": {
   *   "latitude": 18.4475,
   *   "longitude": 73.8214
   * }
   */
  georeference?: {
    latitude?: number | string;
    longitude?: number | string;
    elevationOffset?: number | string;
  };

  /**
   * Some exported cadastral files store metadata here.
   */
  metadata?: {
    georeference?: {
      latitude?: number | string;
      longitude?: number | string;
      elevationOffset?: number | string;
    };

    latitude?: number | string;
    longitude?: number | string;
  };

  /**
   * Some files may use properties at the root.
   */
  properties?: {
    georeference?: {
      latitude?: number | string;
      longitude?: number | string;
      elevationOffset?: number | string;
    };

    latitude?: number | string;
    longitude?: number | string;
  };

  features?: GeoJSONFeature[];
}

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

/**
 * Convert an unknown value into a finite number.
 */
function toFiniteNumber(
  value: unknown
): number | undefined {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return undefined;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : undefined;
}

/**
 * Validate latitude.
 */
function isValidLatitude(
  value: unknown
): value is number {
  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number >= -90 &&
    number <= 90
  );
}

/**
 * Validate longitude.
 */
function isValidLongitude(
  value: unknown
): value is number {
  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number >= -180 &&
    number <= 180
  );
}

/**
 * ============================================================
 * GEOREFERENCE EXTRACTION
 * ============================================================
 *
 * We NEVER create artificial coordinates.
 *
 * We only read coordinates that exist in the uploaded file.
 *
 * Priority:
 *
 * 1. input.georeference
 * 2. input.metadata.georeference
 * 3. input.properties.georeference
 * 4. input.metadata.latitude / longitude
 * 5. input.properties.latitude / longitude
 *
 * No Pune fallback.
 */

function extractGeoreference(
  input: CadastralGeoJSON
): {
  latitude: number;
  longitude: number;
  elevationOffset: number;
} | null {
  /**
   * ----------------------------------------------------------
   * SOURCE 1
   * ----------------------------------------------------------
   *
   * Standard structure used by your file.
   */

  const rootGeo =
    input.georeference;

  let latitude =
    toFiniteNumber(
      rootGeo?.latitude
    );

  let longitude =
    toFiniteNumber(
      rootGeo?.longitude
    );

  let elevationOffset =
    toFiniteNumber(
      rootGeo?.elevationOffset
    ) ?? 0;

  if (
    latitude !== undefined &&
    longitude !== undefined &&
    isValidLatitude(latitude) &&
    isValidLongitude(longitude)
  ) {
    return {
      latitude,
      longitude,
      elevationOffset,
    };
  }

  /**
   * ----------------------------------------------------------
   * SOURCE 2
   * ----------------------------------------------------------
   *
   * metadata.georeference
   */

  const metadataGeo =
    input.metadata
      ?.georeference;

  latitude =
    toFiniteNumber(
      metadataGeo?.latitude
    );

  longitude =
    toFiniteNumber(
      metadataGeo?.longitude
    );

  elevationOffset =
    toFiniteNumber(
      metadataGeo?.elevationOffset
    ) ?? 0;

  if (
    latitude !== undefined &&
    longitude !== undefined &&
    isValidLatitude(latitude) &&
    isValidLongitude(longitude)
  ) {
    return {
      latitude,
      longitude,
      elevationOffset,
    };
  }

  /**
   * ----------------------------------------------------------
   * SOURCE 3
   * ----------------------------------------------------------
   *
   * root properties.georeference
   */

  const propertiesGeo =
    input.properties
      ?.georeference;

  latitude =
    toFiniteNumber(
      propertiesGeo?.latitude
    );

  longitude =
    toFiniteNumber(
      propertiesGeo?.longitude
    );

  elevationOffset =
    toFiniteNumber(
      propertiesGeo?.elevationOffset
    ) ?? 0;

  if (
    latitude !== undefined &&
    longitude !== undefined &&
    isValidLatitude(latitude) &&
    isValidLongitude(longitude)
  ) {
    return {
      latitude,
      longitude,
      elevationOffset,
    };
  }

  /**
   * ----------------------------------------------------------
   * SOURCE 4
   * ----------------------------------------------------------
   *
   * metadata.latitude / metadata.longitude
   */

  latitude =
    toFiniteNumber(
      input.metadata
        ?.latitude
    );

  longitude =
    toFiniteNumber(
      input.metadata
        ?.longitude
    );

  if (
    latitude !== undefined &&
    longitude !== undefined &&
    isValidLatitude(latitude) &&
    isValidLongitude(longitude)
  ) {
    return {
      latitude,
      longitude,
      elevationOffset:
        toFiniteNumber(
          input.metadata
            ?.georeference
            ?.elevationOffset
        ) ?? 0,
    };
  }

  /**
   * ----------------------------------------------------------
   * SOURCE 5
   * ----------------------------------------------------------
   *
   * root properties.latitude / longitude
   */

  latitude =
    toFiniteNumber(
      input.properties
        ?.latitude
    );

  longitude =
    toFiniteNumber(
      input.properties
        ?.longitude
    );

  if (
    latitude !== undefined &&
    longitude !== undefined &&
    isValidLatitude(latitude) &&
    isValidLongitude(longitude)
  ) {
    return {
      latitude,
      longitude,
      elevationOffset:
        toFiniteNumber(
          input.properties
            ?.georeference
            ?.elevationOffset
        ) ?? 0,
    };
  }

  /**
   * Nothing valid was found.
   */
  return null;
}

/**
 * ============================================================
 * POLYGON PARSER
 * ============================================================
 *
 * Your cadastral coordinates are LOCAL METRES.
 *
 * Example:
 *
 * [6, 0]
 * [8, 0]
 * [8, 27]
 *
 * means:
 *
 * X = 6 metres east/west
 * Y = 0 metres north/south
 *
 * These are NOT latitude/longitude.
 *
 * RealWorldMapViewer converts these local coordinates using
 * the building's georeference.
 */

function parsePolygon(
  coordinates: unknown
): Point2D[] | null {
  if (
    !Array.isArray(
      coordinates
    )
  ) {
    return null;
  }

  if (
    coordinates.length === 0
  ) {
    return null;
  }

  /**
   * ----------------------------------------------------------
   * NORMAL POLYGON
   * ----------------------------------------------------------
   *
   * [
   *   [
   *     [x, y],
   *     [x, y],
   *     ...
   *   ]
   * ]
   */

  let ring: unknown;

  /**
   * Standard Polygon.
   */
  if (
    Array.isArray(
      coordinates[0]
    ) &&
    Array.isArray(
      coordinates[0]?.[0]
    ) &&
    typeof coordinates[0]?.[0]?.[0] !==
      "undefined"
  ) {
    ring =
      coordinates[0];
  }

  /**
   * MultiPolygon.
   *
   * [
   *   [
   *     [
   *       [x,y],
   *       ...
   *     ]
   *   ]
   * ]
   *
   * Use the first polygon's first ring.
   */
  else if (
    Array.isArray(
      coordinates[0]
    ) &&
    Array.isArray(
      coordinates[0]?.[0]
    ) &&
    Array.isArray(
      coordinates[0]?.[0]?.[0]
    )
  ) {
    ring =
      coordinates[0][0];
  }

  if (
    !Array.isArray(ring)
  ) {
    return null;
  }

  const polygon: Point2D[] =
    [];

  for (
    const coordinate of ring
  ) {
    if (
      !Array.isArray(
        coordinate
      )
    ) {
      continue;
    }

    if (
      coordinate.length < 2
    ) {
      continue;
    }

    const x =
      toFiniteNumber(
        coordinate[0]
      );

    const y =
      toFiniteNumber(
        coordinate[1]
      );

    if (
      x === undefined ||
      y === undefined
    ) {
      continue;
    }

    polygon.push({
      x,
      y,
    });
  }

  if (
    polygon.length < 3
  ) {
    return null;
  }

  return polygon;
}

/**
 * ============================================================
 * MAIN PARSER
 * ============================================================
 */

export function parseCadastralGeoJSON(
  input: CadastralGeoJSON
): ParsedBuilding {
  /**
   * ----------------------------------------------------------
   * VALIDATE INPUT
   * ----------------------------------------------------------
   */

  if (
    !input ||
    input.type !==
      "FeatureCollection"
  ) {
    throw new Error(
      "Invalid cadastral GeoJSON: expected FeatureCollection."
    );
  }

  /**
   * ----------------------------------------------------------
   * EXTRACT GEOREFERENCE
   * ----------------------------------------------------------
   */

  const georeference =
    extractGeoreference(
      input
    );

  /**
   * IMPORTANT DEBUGGING OUTPUT
   */

  console.log(
    "=================================================="
  );

  console.log(
    "[Cadastral Parser] Raw input georeference:",
    input.georeference
  );

  console.log(
    "[Cadastral Parser] Extracted georeference:",
    georeference
  );

  console.log(
    "=================================================="
  );

  /**
   * ----------------------------------------------------------
   * FLOOR MAP
   * ----------------------------------------------------------
   */

  const floorMap =
    new Map<
      number,
      Floor2D
    >();

  /**
   * ----------------------------------------------------------
   * PROCESS FEATURES
   * ----------------------------------------------------------
   */

  for (
    const feature of
      input.features ?? []
  ) {
    if (
      !feature ||
      feature.type !==
        "Feature"
    ) {
      continue;
    }

    const properties =
      feature.properties ??
      {};

    /**
     * Floor.
     */
    const floorNumber =
      toFiniteNumber(
        properties.floorNumber
      ) ?? 1;

    /**
     * Geometry.
     */
    const coordinates =
      feature.geometry
        ?.coordinates;

    const polygon =
      parsePolygon(
        coordinates
      );

    if (!polygon) {
      continue;
    }

    /**
     * --------------------------------------------------------
     * PROPERTY
     * --------------------------------------------------------
     */

    const unitId =
      properties.id ??
      properties.unitNumber ??
      `UNIT-${floorNumber}-${floorMap.size + 1}`;

    const unitNumber =
      properties.unitNumber ??
      properties.id ??
      `UNIT-${floorNumber}`;

    const unit: Property2D = {
      id: unitId,

      unitNumber,

      floorNumber,

      area:
        toFiniteNumber(
          properties.area
        ) ?? 0,

      polygon,

      ulpin:
        properties.ulpin,

      spaceType:
        properties.spaceType ??
        "RESIDENTIAL",
    };

    /**
     * --------------------------------------------------------
     * FLOOR
     * --------------------------------------------------------
     */

    if (
      !floorMap.has(
        floorNumber
      )
    ) {
      floorMap.set(
        floorNumber,
        {
          floorNumber,

          elevation:
            toFiniteNumber(
              properties.elevationMeters
            ) ?? 0,

          height:
            toFiniteNumber(
              properties.heightMeters
            ) ?? 3.2,

          units: [],
        }
      );
    }

    /**
     * Add unit.
     */
    floorMap
      .get(floorNumber)!
      .units.push(
        unit
      );
  }

  /**
   * ----------------------------------------------------------
   * SORT FLOORS
   * ----------------------------------------------------------
   */

  const floors =
    Array.from(
      floorMap.values()
    ).sort(
      (a, b) =>
        a.floorNumber -
        b.floorNumber
    );

  /**
   * ----------------------------------------------------------
   * CREATE BUILDING
   * ----------------------------------------------------------
   */

  const building: ParsedBuilding =
    {
      id:
        input.buildingId ??
        `BLDG-${Date.now()}`,

      name:
        input.buildingName ??
        "Uploaded Cadastral Building",

      floors,

      /**
       * Preserve the actual uploaded georeference.
       */
      ...(georeference
        ? {
            georeference: {
              latitude:
                georeference.latitude,

              longitude:
                georeference.longitude,

              elevationOffset:
                georeference.elevationOffset,
            },
          }
        : {}),
    };

  /**
   * ----------------------------------------------------------
   * FINAL DEBUG
   * ----------------------------------------------------------
   */

  console.log(
    "[Cadastral Parser] ==============================="
  );

  console.log(
    "[Cadastral Parser] Building:",
    building.name
  );

  console.log(
    "[Cadastral Parser] Building ID:",
    building.id
  );

  console.log(
    "[Cadastral Parser] Final GeoReference:",
    building.georeference
  );

  console.log(
    "[Cadastral Parser] Latitude:",
    building.georeference
      ?.latitude
  );

  console.log(
    "[Cadastral Parser] Longitude:",
    building.georeference
      ?.longitude
  );

  console.log(
    "[Cadastral Parser] Floors:",
    floors.length
  );

  console.log(
    "[Cadastral Parser] Units:",
    floors.reduce(
      (
        total,
        floor
      ) =>
        total +
        floor.units.length,
      0
    )
  );

  console.log(
    "[Cadastral Parser] ==============================="
  );

  return building;
}
