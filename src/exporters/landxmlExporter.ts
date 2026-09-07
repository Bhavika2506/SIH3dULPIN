import type { ParsedBuilding } from "@/src/lib/parser/types";

export function exportToLandXML(building: ParsedBuilding): string {
  let parcelsXml = "";

  building.floors.forEach((floor) => {
    floor.units.forEach((unit) => {
      const coordList = unit.polygon.map((p) => `${p.y} ${p.x}`).join(" ");
      const ulpin = unit.ulpin || `3D-${building.id}-F${floor.floorNumber}-${unit.unitNumber}`;

      parcelsXml += `
    <Parcel name="${unit.unitNumber}" desc="${ulpin}" area="${unit.area}">
      <CoordGeom>
        <IrregularLine>
          <Start>${unit.polygon[0]?.y} ${unit.polygon[0]?.x}</Start>
          <PntList>${coordList}</PntList>
        </IrregularLine>
      </CoordGeom>
      <Feature name="VolumetricLimits">
        <Property label="ElevationMin" value="${floor.elevation}"/>
        <Property label="ElevationMax" value="${floor.elevation + floor.height}"/>
        <Property label="ULPIN" value="${ulpin}"/>
      </Feature>
    </Parcel>`;
    });
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2" version="1.2">
  <Units>
    <Metric areaUnit="squareMeter" linearUnit="meter"/>
  </Units>
  <Parcels name="${building.name}">${parcelsXml}
  </Parcels>
</LandXML>`;
}
