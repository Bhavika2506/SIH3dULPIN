export type PropertySelection = {
  id: string;
  unitNumber: string;
  floorNumber: number;
};

export function createPropertySelection(
  property: {
    id: string;
    unitNumber: string;
    floorNumber: number;
  }
): PropertySelection {
  return {
    id: property.id,
    unitNumber: property.unitNumber,
    floorNumber: property.floorNumber,
  };
}