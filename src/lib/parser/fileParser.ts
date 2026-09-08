
import type {
  ParsedBuilding,
  Floor2D,
  Property2D,
  Point2D,
} from "./types";

// ============================================================
// CONSTANTS
// ============================================================

const TOTAL_FLOORS = 5;
const FLOOR_HEIGHT = 3.2;

// ============================================================
// GEOJSON TYPES
// ============================================================

export type GeoJSONFeature = {
  type: "Feature";

  properties?: {
    id?: string;
    unitNumber?: string;
    unit?: string;

    floor?: number | string;
    floorNumber?: number | string;

    area?: number | string;
    areaSqMeters?: number | string;

    height?: number | string;
    heightMeters?: number | string;

    elevationMeters?: number | string;

    spaceType?: string;
    ulpin?: string;
  };

  geometry?: {
    type: string;
    coordinates: unknown;
  };
};

export type GeoJSONFile = {
  type: "FeatureCollection";

  name?: string;
  buildingName?: string;
  buildingId?: string;

  /**
   * IMPORTANT:
   *
   * This is the real-world anchor of the uploaded
   * cadastral building.
   *
   * Example:
   *
   * {
   *   "latitude": 18.4475,
   *   "longitude": 73.8214
   * }
   */
  georeference?: {
    latitude?: number | string;
    longitude?: number | string;
    elevationOffset?: number | string;
  };

  features: GeoJSONFeature[];
};

// ============================================================
// NUMBER HELPERS
// ============================================================

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

// ============================================================
// AREA CALCULATION
// ============================================================

/**
 * Calculates the 2D polygon surface area using
 * the Shoelace formula.
 *
 * Coordinates are assumed to be local building
 * coordinates in metres.
 */
export function calculateArea(
  polygon: Point2D[]
): number {
  let area = 0;

  const n = polygon.length;

  if (n < 3) {
    return 0;
  }

  for (
    let i = 0;
    i < n;
    i++
  ) {
    const j =
      (i + 1) % n;

    area +=
      polygon[i].x *
      polygon[j].y;

    area -=
      polygon[j].x *
      polygon[i].y;
  }

  return Math.round(
    (Math.abs(area) / 2) *
      100
  ) / 100;
}

// ============================================================
// FILE FORMAT
// ============================================================

export function detectFileFormat(
  fileName: string
): string {
  const ext =
    fileName
      .split(".")
      .pop()
      ?.toLowerCase();

  return ext || "unknown";
}

// ============================================================
// POLYGON CONVERSION
// ============================================================

/**
 * Converts a standard GeoJSON Polygon into
 * the application's local Point2D format.
 *
 * GeoJSON:
 *
 * [
 *   [
 *     [x, y],
 *     [x, y],
 *     ...
 *   ]
 * ]
 *
 * Application:
 *
 * [
 *   { x, y },
 *   { x, y },
 *   ...
 * ]
 */
function convertPolygon(
  coordinates: unknown
): Point2D[] {
  if (
    !Array.isArray(
      coordinates
    )
  ) {
    return [];
  }

  /**
   * ----------------------------------------------------------
   * NORMAL POLYGON
   * ----------------------------------------------------------
   */

  const first =
    coordinates[0];

  if (
    Array.isArray(first) &&
    first.length > 0 &&
    Array.isArray(first[0])
  ) {
    return first
      .filter(
        (
          point
        ): point is [
          number,
          number
        ] =>
          Array.isArray(
            point
          ) &&
          point.length >=
            2 &&
          Number.isFinite(
            Number(
              point[0]
            )
          ) &&
          Number.isFinite(
            Number(
              point[1]
            )
          )
      )
      .map(
        ([
          x,
          y,
        ]) => ({
          x: Number(x),
          y: Number(y),
        })
      );
  }

  return [];
}

// ============================================================
// DEFAULT POLYGON
// ============================================================

function createDefaultPolygon(
  unitIndex: number
): Point2D[] {
  const column =
    unitIndex % 2;

  const row =
    Math.floor(
      unitIndex / 2
    );

  const x =
    column * 10;

  const y =
    row * 10;

  const width = 8;
  const depth = 8;

  return [
    { x, y },

    {
      x: x + width,
      y,
    },

    {
      x: x + width,
      y: y + depth,
    },

    {
      x,
      y: y + depth,
    },

    { x, y },
  ];
}

// ============================================================
// GEOREFERENCE
// ============================================================

/**
 * Extract and validate the uploaded file's
 * real-world coordinates.
 *
 * NO FALLBACK COORDINATES ARE CREATED.
 */
function extractGeoreference(
  json: GeoJSONFile
):
  | ParsedBuilding["georeference"]
  | undefined {
  const latitude =
    toFiniteNumber(
      json.georeference
        ?.latitude
    );

  const longitude =
    toFiniteNumber(
      json.georeference
        ?.longitude
    );

  const elevationOffset =
    toFiniteNumber(
      json.georeference
        ?.elevationOffset
    ) ?? 0;

  if (
    latitude ===
      undefined ||
    longitude ===
      undefined
  ) {
    console.warn(
      "[GeoJSON Parser] No georeference found in uploaded file."
    );

    return undefined;
  }

  if (
    !isValidLatitude(
      latitude
    )
  ) {
    console.warn(
      "[GeoJSON Parser] Invalid latitude:",
      latitude
    );

    return undefined;
  }

  if (
    !isValidLongitude(
      longitude
    )
  ) {
    console.warn(
      "[GeoJSON Parser] Invalid longitude:",
      longitude
    );

    return undefined;
  }

  return {
    latitude,
    longitude,
    elevationOffset,
  };
}

// ============================================================
// MAIN GEOJSON PARSER
// ============================================================

/**
 * Parses a GeoJSON FeatureCollection into
 * a ParsedBuilding structure.
 */
export function parseGeoJSON(
  json: GeoJSONFile,
  buildingName = "Cadastral Building"
): ParsedBuilding {
  /**
   * ----------------------------------------------------------
   * VALIDATE
   * ----------------------------------------------------------
   */

  if (
    !json ||
    json.type !==
      "FeatureCollection" ||
    !Array.isArray(
      json.features
    )
  ) {
    return generateFallbackBuilding(
      buildingName
    );
  }

  /**
   * ----------------------------------------------------------
   * CRITICAL: PRESERVE GEOREFERENCE
   * ----------------------------------------------------------
   */

  const georeference =
    extractGeoreference(
      json
    );

  console.log(
    "[GeoJSON Parser] ================================="
  );

  console.log(
    "[GeoJSON Parser] Input georeference:",
    json.georeference
  );

  console.log(
    "[GeoJSON Parser] Parsed georeference:",
    georeference
  );

  /**
   * ----------------------------------------------------------
   * FLOOR MAP
   * ----------------------------------------------------------
   */

  const floorMap =
    new Map<
      number,
      Property2D[]
    >();

  /**
   * ----------------------------------------------------------
   * PROCESS FEATURES
   * ----------------------------------------------------------
   */

  json.features.forEach(
    (
      feature,
      index
    ) => {
      if (
        !feature ||
        feature.type !==
          "Feature"
      ) {
        return;
      }

      const props =
        feature.properties ??
        {};

      /**
       * ------------------------------------------------------
       * FLOOR
       * ------------------------------------------------------
       */

      let floorNumber =
        Number(
          props.floorNumber ??
            props.floor ??
            1
        );

      if (
        !Number.isFinite(
          floorNumber
        )
      ) {
        floorNumber = 1;
      }

      /**
       * ------------------------------------------------------
       * UNIT NUMBER
       * ------------------------------------------------------
       */

      const unitNumber =
        props.unitNumber ??
        props.unit ??
        `F${floorNumber}-UNIT-${index + 1}`;

      /**
       * ------------------------------------------------------
       * ID
       * ------------------------------------------------------
       */

      const id =
        props.id ??
        `PROPERTY-F${floorNumber}-${index + 1}`;

      /**
       * ------------------------------------------------------
       * POLYGON
       * ------------------------------------------------------
       */

      let polygon: Point2D[] =
        [];

      if (
        feature.geometry
          ?.type ===
          "Polygon"
      ) {
        polygon =
          convertPolygon(
            feature.geometry
              .coordinates
          );
      }

      /**
       * Support MultiPolygon.
       *
       * Take the first polygon's first ring.
       */
      else if (
        feature.geometry
          ?.type ===
          "MultiPolygon"
      ) {
        const coordinates =
          feature.geometry
            .coordinates;

        if (
          Array.isArray(
            coordinates
          ) &&
          Array.isArray(
            coordinates[0]
          ) &&
          Array.isArray(
            coordinates[0][0]
          )
        ) {
          polygon =
            convertPolygon(
              coordinates[0]
            );
        }
      }

      /**
       * ------------------------------------------------------
       * INVALID POLYGON
       * ------------------------------------------------------
       *
       * Keep the existing fallback geometry behavior so
       * one malformed feature does not destroy the building.
       */
      if (
        polygon.length < 3
      ) {
        console.warn(
          `[GeoJSON Parser] Invalid polygon for ${unitNumber}; using generated geometry.`
        );

        polygon =
          createDefaultPolygon(
            index
          );
      }

      /**
       * ------------------------------------------------------
       * AREA
       * ------------------------------------------------------
       */

      const suppliedArea =
        Number(
          props.area ??
            props.areaSqMeters
        );

      const calculatedArea =
        calculateArea(
          polygon
        );

      const area =
        Number.isFinite(
          suppliedArea
        ) &&
        suppliedArea > 0
          ? suppliedArea
          : calculatedArea >
              0
            ? calculatedArea
            : 64;

      /**
       * ------------------------------------------------------
       * SPACE TYPE
       * ------------------------------------------------------
       */

      const spaceType =
        props.spaceType ||
        unitNumber;

      /**
       * ------------------------------------------------------
       * ULPIN
       * ------------------------------------------------------
       */

      const ulpin =
        props.ulpin ||
        `3D-${buildingName.toUpperCase()}-F${String(
          floorNumber
        ).padStart(
          2,
          "0"
        )}-${unitNumber}`;

      /**
       * ------------------------------------------------------
       * PROPERTY
       * ------------------------------------------------------
       */

      const propertyUnit: Property2D =
        {
          id,

          unitNumber,

          floorNumber,

          area,

          polygon,

          spaceType,

          ulpin,
        };

      /**
       * ------------------------------------------------------
       * ADD TO FLOOR
       * ------------------------------------------------------
       */

      if (
        !floorMap.has(
          floorNumber
        )
      ) {
        floorMap.set(
          floorNumber,
          []
        );
      }

      floorMap
        .get(floorNumber)!
        .push(
          propertyUnit
        );
    }
  );

  /**
   * ----------------------------------------------------------
   * CREATE FLOORS
   * ----------------------------------------------------------
   */

  const floors: Floor2D[] =
    Array.from(
      floorMap.entries()
    )
      .sort(
        ([a], [b]) =>
          a - b
      )
      .map(
        (
          [
            floorNum,
            units,
          ],
          idx
        ) => ({
          floorNumber:
            floorNum,

          elevation:
            idx *
            FLOOR_HEIGHT,

          height:
            FLOOR_HEIGHT,

          units,
        })
      );

  /**
   * ----------------------------------------------------------
   * BUILDING
   * ----------------------------------------------------------
   */

  const building: ParsedBuilding =
    {
      id:
        json.buildingId ||
        `BLD-${Date.now()
          .toString()
          .slice(-4)}`,

      name:
        json.buildingName ||
        json.name ||
        buildingName,

      floors:
        floors.length > 0
          ? floors
          : generateFallbackBuilding(
              buildingName
            ).floors,

      /**
       * THIS WAS THE MISSING PART.
       *
       * The uploaded georeference now survives the
       * fileParser layer.
       */
      ...(georeference
        ? {
            georeference,
          }
        : {}),
    };

  /**
   * ----------------------------------------------------------
   * FINAL DEBUG
   * ----------------------------------------------------------
   */

  console.log(
    "[GeoJSON Parser] Final ParsedBuilding:"
  );

  console.log(
    JSON.stringify(
      {
        id: building.id,
        name: building.name,
        georeference:
          building.georeference,
        floors:
          building.floors.length,
        units:
          building.floors.reduce(
            (
              total,
              floor
            ) =>
              total +
              floor.units
                .length,
            0
          ),
      },
      null,
      2
    )
  );

  console.log(
    "[GeoJSON Parser] ================================="
  );

  return building;
}

// ============================================================
// UNIVERSAL FILE PARSER
// ============================================================

/**
 * Universal async file parser entry point.
 */
export async function parseUploadedFile(
  file: File
): Promise<ParsedBuilding> {
  const format =
    detectFileFormat(
      file.name
    );

  const buildingName =
    file.name.replace(
      /\.[^/.]+$/,
      ""
    );

  /**
   * ----------------------------------------------------------
   * GEOJSON / JSON
   * ----------------------------------------------------------
   */

  if (
    format ===
      "geojson" ||
    format === "json"
  ) {
    try {
      const content =
        await file.text();

      const json =
        JSON.parse(
          content
        ) as GeoJSONFile;

      console.log(
        "[File Parser] Uploaded GeoJSON georeference:",
        json.georeference
      );

      return parseGeoJSON(
        json,
        buildingName
      );
    } catch (e) {
      console.warn(
        "Error parsing GeoJSON structure:",
        e
      );
    }
  }

  /**
   * ----------------------------------------------------------
   * DXF
   * ----------------------------------------------------------
   */

  if (
    format === "dxf"
  ) {
    try {
      const content =
        await file.text();

      const polygons =
        parseDXFPolygons(
          content
        );

      if (
        polygons.length >
        0
      ) {
        return buildBuildingFromPolygons(
          polygons,
          buildingName
        );
      }
    } catch (e) {
      console.warn(
        "Error parsing DXF structure:",
        e
      );
    }
  }

  /**
   * ----------------------------------------------------------
   * SVG
   * ----------------------------------------------------------
   */

  if (
    format === "svg"
  ) {
    try {
      const content =
        await file.text();

      const polygons =
        parseSVGPolygons(
          content
        );

      if (
        polygons.length >
        0
      ) {
        return buildBuildingFromPolygons(
          polygons,
          buildingName
        );
      }
    } catch (e) {
      console.warn(
        "Error parsing SVG structure:",
        e
      );
    }
  }

  /**
   * ----------------------------------------------------------
   * COMPLETE FALLBACK
   * ----------------------------------------------------------
   */

  return generateFallbackBuilding(
    buildingName
  );
}

// ============================================================
// DXF PARSER
// ============================================================

function parseDXFPolygons(
  dxfContent: string
): Point2D[][] {
  const polygons: Point2D[][] =
    [];

  const lines =
    dxfContent.split(
      /\r?\n/
    );

  let currentPolygon: Point2D[] =
    [];

  let readingPolyline =
    false;

  for (
    let i = 0;
    i < lines.length;
    i++
  ) {
    const line =
      lines[i].trim();

    if (
      line ===
        "LWPOLYLINE" ||
      line ===
        "POLYLINE"
    ) {
      if (
        currentPolygon.length >=
        3
      ) {
        polygons.push(
          currentPolygon
        );
      }

      currentPolygon = [];

      readingPolyline =
        true;
    } else if (
      readingPolyline &&
      line === "10"
    ) {
      const x =
        parseFloat(
          lines[i + 1]
        );

      if (
        lines[i + 2]
          ?.trim() ===
        "20"
      ) {
        const y =
          parseFloat(
            lines[i + 3]
          );

        if (
          !isNaN(x) &&
          !isNaN(y)
        ) {
          currentPolygon.push(
            {
              x,
              y,
            }
          );
        }
      }
    }
  }

  if (
    currentPolygon.length >=
    3
  ) {
    polygons.push(
      currentPolygon
    );
  }

  return polygons;
}

// ============================================================
// SVG PARSER
// ============================================================

function parseSVGPolygons(
  svgContent: string
): Point2D[][] {
  const polygons: Point2D[][] =
    [];

  const polygonMatches =
    svgContent.matchAll(
      /points=["']([^"']+)["']/g
    );

  for (
    const match of polygonMatches
  ) {
    const rawPoints =
      match[1]
        .trim()
        .split(
          /\s+|,/
        );

    const points: Point2D[] =
      [];

    for (
      let i = 0;
      i <
      rawPoints.length - 1;
      i += 2
    ) {
      const x =
        parseFloat(
          rawPoints[i]
        );

      const y =
        parseFloat(
          rawPoints[i + 1]
        );

      if (
        !isNaN(x) &&
        !isNaN(y)
      ) {
        points.push({
          x,
          y,
        });
      }
    }

    if (
      points.length >= 3
    ) {
      polygons.push(
        points
      );
    }
  }

  return polygons;
}

// ============================================================
// BUILD BUILDING FROM POLYGONS
// ============================================================

function buildBuildingFromPolygons(
  polygons: Point2D[][],
  buildingName: string
): ParsedBuilding {
  const units: Property2D[] =
    polygons.map(
      (
        polygon,
        index
      ) => ({
        id: `UNIT-${101 + index}`,

        unitNumber:
          `${101 + index}`,

        floorNumber: 1,

        area:
          calculateArea(
            polygon
          ),

        polygon,

        ulpin:
          `3D-${buildingName.toUpperCase()}-F01-${101 + index}`,
      })
    );

  return {
    id: `BLD-${Date.now()
      .toString()
      .slice(-4)}`,

    name: buildingName,

    floors: [
      {
        floorNumber: 1,

        elevation: 0,

        height:
          FLOOR_HEIGHT,

        units,
      },
    ],
  };
}

// ============================================================
// FALLBACK BUILDING
// ============================================================

/**
 * Used only when the uploaded file cannot be parsed.
 *
 * IMPORTANT:
 *
 * This fallback does NOT have a georeference.
 *
 * Therefore the GIS map should correctly refuse to place
 * this synthetic building on a real-world map.
 */
function generateFallbackBuilding(
  buildingName: string
): ParsedBuilding {
  const floors: Floor2D[] =
    [];

  for (
    let floorNumber = 1;
    floorNumber <=
    TOTAL_FLOORS;
    floorNumber++
  ) {
    floors.push({
      floorNumber,

      elevation:
        (floorNumber - 1) *
        FLOOR_HEIGHT,

      height:
        FLOOR_HEIGHT,

      units: [
        {
          id: `PROP-F${floorNumber}-101`,

          unitNumber:
            `F${floorNumber}-101`,

          floorNumber,

          area: 64,

          polygon: [
            {
              x: 0,
              y: 0,
            },
            {
              x: 8,
              y: 0,
            },
            {
              x: 8,
              y: 8,
            },
            {
              x: 0,
              y: 8,
            },
          ],

          ulpin:
            `3D-${buildingName.toUpperCase()}-F0${floorNumber}-101`,
        },

        {
          id: `PROP-F${floorNumber}-102`,

          unitNumber:
            `F${floorNumber}-102`,

          floorNumber,

          area: 64,

          polygon: [
            {
              x: 10,
              y: 0,
            },
            {
              x: 18,
              y: 0,
            },
            {
              x: 18,
              y: 8,
            },
            {
              x: 10,
              y: 8,
            },
          ],

          ulpin:
            `3D-${buildingName.toUpperCase()}-F0${floorNumber}-102`,
        },
      ],
    });
  }

  return {
    id: `BLD-FALLBACK-${Date.now()
      .toString()
      .slice(-4)}`,

    name: buildingName,

    floors,
  };
}
