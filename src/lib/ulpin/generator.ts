export interface ULPINMetadata {
  stateCode: string;         // e.g., "14" (Maharashtra)
  districtCode: string;      // LGD Code, e.g., "4012"
  surfaceParcelId: string;   // Base land parcel identifier, e.g., "0012"
  floorLevel: number;        // Elevation index (negative for subterranean)
  unitIdentifier: string;    // Sub-unit code or room ID
  spaceType?: "ROOM" | "STAIRS" | "LIFT" | "PASSAGE" | "UTILITY" | "BASEMENT";
}

export function generate3DULPIN(meta: ULPINMetadata): string {
  const state = meta.stateCode.padStart(2, "0").toUpperCase();
  const district = meta.districtCode.padStart(4, "0").toUpperCase();
  const parcel = meta.surfaceParcelId.padStart(4, "0").toUpperCase();

  // Format vertical level: F01, F02, B01 (Basement 1), B02, etc.
  let levelTag = "";
  if (meta.floorLevel < 0) {
    levelTag = `B${Math.abs(meta.floorLevel).toString().padStart(2, "0")}`;
  } else {
    levelTag = `F${meta.floorLevel.toString().padStart(2, "0")}`;
  }

  // Sanitize unit identifier
  const sanitizedUnit = meta.unitIdentifier
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  return `${state}-${district}-${parcel}-3D-${levelTag}-${sanitizedUnit}`;
}

export function parse3DULPIN(ulpin: string): Partial<ULPINMetadata> | null {
  const parts = ulpin.split("-");
  if (parts.length < 6 || parts[3] !== "3D") return null;

  const [stateCode, districtCode, surfaceParcelId, , levelRaw, ...unitParts] = parts;
  const unitIdentifier = unitParts.join("-");

  let floorLevel = 0;
  if (levelRaw.startsWith("B")) {
    floorLevel = -parseInt(levelRaw.substring(1), 10);
  } else if (levelRaw.startsWith("F")) {
    floorLevel = parseInt(levelRaw.substring(1), 10);
  }

  return {
    stateCode,
    districtCode,
    surfaceParcelId,
    floorLevel,
    unitIdentifier,
  };
}

export function validateULPINFormat(ulpin: string): boolean {
  const ulpinRegex = /^\d{2}-\d{4}-\d{4}-3D-(F|B)\d{2}-[A-Z0-9]+$/;
  return ulpinRegex.test(ulpin);
}