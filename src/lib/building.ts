export type PropertyUnit = {
  id: string;
  unitNumber: string;
  name: string;

  // 2D position
  x: number;
  y: number;

  // 2D dimensions
  width: number;
  depth: number;

  // Calculated area
  area: number;

  // Vertical information
  floorNumber: number;
  zMin: number;
  zMax: number;

  // 3D ULPIN
  ulpin: string;
};

export type Floor = {
  floorNumber: number;
  height: number;
  zMin: number;
  zMax: number;
  units: PropertyUnit[];
};

export type Building = {
  id: string;
  name: string;

  countryCode: string;
  stateCode: string;
  cityCode: string;

  floors: number;
  floorHeight: number;

  floorsData: Floor[];
};


// ==========================================
// BUILDING CONFIGURATION
// ==========================================

const buildingId = "000001";

const numberOfFloors = 5;

const floorHeight = 3;


// ==========================================
// 2D FLOOR PLAN
// ==========================================
//
// This is our temporary 2D input.
//
// Later this will come from:
// DXF / GeoJSON / PDF
//

const floorTemplate = [
  {
    id: "A",
    name: "Apartment A",
    x: 0,
    y: 0,
    width: 6,
    depth: 5,
  },

  {
    id: "B",
    name: "Apartment B",
    x: 6,
    y: 0,
    width: 4,
    depth: 5,
  },

  {
    id: "C",
    name: "Apartment C",
    x: 0,
    y: 5,
    width: 10,
    depth: 5,
  },
];


// ==========================================
// ULPIN GENERATOR
// ==========================================

function generateULPIN(
  floorNumber: number,
  unitIndex: number
): string {

  const floor = floorNumber
    .toString()
    .padStart(2, "0");

  const unitNumber =
    `${floorNumber}${(unitIndex + 1)
      .toString()
      .padStart(2, "0")}`;

  return `IN-MH-PUN-${buildingId}-F${floor}-U${unitNumber}`;
}


// ==========================================
// FLOOR GENERATOR
// ==========================================

function generateFloors(): Floor[] {

  return Array.from(
    { length: numberOfFloors },

    (_, floorIndex) => {

      const floorNumber = floorIndex + 1;

      const zMin =
        floorIndex * floorHeight;

      const zMax =
        zMin + floorHeight;


      const units: PropertyUnit[] =
        floorTemplate.map(
          (unit, unitIndex) => {

            const area =
              unit.width * unit.depth;

            const unitNumber =
              `${floorNumber}${(unitIndex + 1)
                .toString()
                .padStart(2, "0")}`;

            return {

              id:
                `F${floorNumber}-${unit.id}`,

              unitNumber,

              name:
                unit.name,

              x:
                unit.x,

              y:
                unit.y,

              width:
                unit.width,

              depth:
                unit.depth,

              area,

              floorNumber,

              zMin,

              zMax,

              ulpin:
                generateULPIN(
                  floorNumber,
                  unitIndex
                ),
            };
          }
        );


      return {

        floorNumber,

        height:
          floorHeight,

        zMin,

        zMax,

        units,
      };
    }
  );
}


// ==========================================
// BUILDING
// ==========================================

export const building: Building = {

  id:
    `BLD-${buildingId}`,

  name:
    "Demo Vertical Property",

  countryCode:
    "IN",

  stateCode:
    "MH",

  cityCode:
    "PUN",

  floors:
    numberOfFloors,

  floorHeight,

  floorsData:
    generateFloors(),
};