import type { ParsedBuilding } from "@/src/lib/parser/types";

export function exportToCityGML(building: ParsedBuilding): string {
  const buildingId = building.id || "BLD-3D-001";
  const buildingName = building.name || "Volumetric Parcel";

  let gmlUnits = "";

  building.floors.forEach((floor) => {
    floor.units.forEach((unit) => {
      const zMin = floor.elevation;
      const zMax = floor.elevation + floor.height;

      // Construct 3D bounding polygon ring coordinates (X, Y, Z)
      const ringCoords = unit.polygon
        .map((p) => `${p.x} ${p.y} ${zMin}`)
        .join(" ");
      const topRingCoords = unit.polygon
        .map((p) => `${p.x} ${p.y} ${zMax}`)
        .join(" ");

      const unitUlpin =
        unit.ulpin ||
        `14-4012-${buildingId.slice(-4)}-3D-F${floor.floorNumber}-${unit.unitNumber}`;

      gmlUnits += `
    <bldg:BuildingUnit gml:id="${unit.id}">
      <gml:description>3D Cadastral Unit: ${unit.unitNumber}</gml:description>
      <gml:name>${unitUlpin}</gml:name>
      <bldg:class>PropertyUnit</bldg:class>
      <bldg:usage>${(unit as any).spaceType || "PrivateProperty"}</bldg:usage>
      <bldg:lod2Solid>
        <gml:Solid>
          <gml:exterior>
            <gml:CompositeSurface>
              <gml:surfaceMember>
                <gml:Polygon>
                  <gml:exterior>
                    <gml:LinearRing>
                      <gml:posList>${ringCoords}</gml:posList>
                    </gml:LinearRing>
                  </gml:exterior>
                </gml:Polygon>
              </gml:surfaceMember>
              <gml:surfaceMember>
                <gml:Polygon>
                  <gml:exterior>
                    <gml:LinearRing>
                      <gml:posList>${topRingCoords}</gml:posList>
                    </gml:LinearRing>
                  </gml:exterior>
                </gml:Polygon>
              </gml:surfaceMember>
            </gml:CompositeSurface>
          </gml:exterior>
        </gml:Solid>
      </bldg:lod2Solid>
    </bldg:BuildingUnit>`;
    });
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<CityModel xmlns="http://www.opengis.net/citygml/3.0"
           xmlns:gml="http://www.opengis.net/gml/3.2"
           xmlns:bldg="http://www.opengis.net/citygml/building/3.0">
  <gml:name>${buildingName}</gml:name>
  <bldg:Building gml:id="${buildingId}">${gmlUnits}
  </bldg:Building>
</CityModel>`;
}