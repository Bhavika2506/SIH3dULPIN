export interface Point2D {
  x: number;
  y: number;
}

export interface Property2D {
  id: string;
  unitNumber: string;
  floorNumber: number;
  area: number;
  polygon: Point2D[];
  ulpin?: string;
  spaceType?: string;
}

export interface Floor2D {
  floorNumber: number;
  elevation: number;
  height: number;
  units: Property2D[];
}

export interface ParsedBuilding {
  id: string;
  name: string;
  floors: Floor2D[];
  georeference?: {
    latitude: number;
    longitude: number;
  };
}