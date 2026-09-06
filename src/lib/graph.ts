import { building } from "@/src/lib/building";


// ==========================================
// GRAPH TYPES
// ==========================================

export type NodeType =
  | "BUILDING"
  | "FLOOR"
  | "PROPERTY";

export type EdgeRelation =
  | "HAS_FLOOR"
  | "CONTAINS"
  | "ABOVE"
  | "BELOW"
  | "ADJACENT";

export type GraphNode = {
  id: string;
  type: NodeType;
  label: string;
  referenceId: string;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  relation: EdgeRelation;
};


// ==========================================
// GRAPH GENERATOR
// ==========================================

export function generateCadastralGraph() {

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // ========================================
  // BUILDING NODE
  // ========================================

  const buildingNodeId = building.id;

  nodes.push({
    id: buildingNodeId,
    type: "BUILDING",
    label: building.name,
    referenceId: building.id,
  });


  // ========================================
  // FLOOR + PROPERTY NODES
  // ========================================

  building.floorsData.forEach((floor) => {

    const floorNodeId =
      `${building.id}-F${floor.floorNumber}`;

    // --------------------------------------
    // FLOOR NODE
    // --------------------------------------

    nodes.push({
      id: floorNodeId,
      type: "FLOOR",
      label: `Floor ${floor.floorNumber}`,
      referenceId: floorNodeId,
    });


    // --------------------------------------
    // BUILDING → FLOOR
    // --------------------------------------

    edges.push({
      id:
        `${buildingNodeId}-HAS_FLOOR-${floorNodeId}`,

      source:
        buildingNodeId,

      target:
        floorNodeId,

      relation:
        "HAS_FLOOR",
    });


    // ======================================
    // PROPERTY NODES
    // ======================================

    floor.units.forEach((unit) => {

      const propertyNodeId =
        unit.id;

      // ------------------------------------
      // PROPERTY NODE
      // ------------------------------------

      nodes.push({
        id:
          propertyNodeId,

        type:
          "PROPERTY",

        label:
          `Apartment ${unit.unitNumber}`,

        referenceId:
          unit.id,
      });


      // ------------------------------------
      // FLOOR → PROPERTY
      // ------------------------------------

      edges.push({
        id:
          `${floorNodeId}-CONTAINS-${propertyNodeId}`,

        source:
          floorNodeId,

        target:
          propertyNodeId,

        relation:
          "CONTAINS",
      });


      // ====================================
      // ABOVE / BELOW
      // ====================================

      if (floor.floorNumber > 1) {

        const previousFloor =
          building.floorsData[
            floor.floorNumber - 2
          ];

        const matchingUnit =
          previousFloor.units.find(
            (previousUnit) =>
              previousUnit.id.split("-")[1] ===
              unit.id.split("-")[1]
          );

        if (matchingUnit) {

          // Previous → Current
          // Current is ABOVE previous

          edges.push({
            id:
              `${matchingUnit.id}-ABOVE-${unit.id}`,

            source:
              matchingUnit.id,

            target:
              unit.id,

            relation:
              "ABOVE",
          });


          // Current → Previous

          edges.push({
            id:
              `${unit.id}-BELOW-${matchingUnit.id}`,

            source:
              unit.id,

            target:
              matchingUnit.id,

            relation:
              "BELOW",
          });
        }
      }
    });


    // ======================================
    // ADJACENCY
    // ======================================

    for (
      let i = 0;
      i < floor.units.length;
      i++
    ) {

      for (
        let j = i + 1;
        j < floor.units.length;
        j++
      ) {

        const unitA =
          floor.units[i];

        const unitB =
          floor.units[j];


        /*
         * Simple MVP adjacency detection.
         *
         * Two properties are considered
         * adjacent when their 2D bounding
         * boxes touch.
         */

        const aRight =
          unitA.x + unitA.width;

        const aTop =
          unitA.y + unitA.depth;

        const bRight =
          unitB.x + unitB.width;

        const bTop =
          unitB.y + unitB.depth;


        const horizontalTouch =
          aRight === unitB.x ||
          bRight === unitA.x;


        const verticalOverlap =
          unitA.y < bTop &&
          aTop > unitB.y;


        const verticalTouch =
          aTop === unitB.y ||
          bTop === unitA.y;


        const horizontalOverlap =
          unitA.x < bRight &&
          aRight > unitB.x;


        const isAdjacent =
          (
            horizontalTouch &&
            verticalOverlap
          ) ||
          (
            verticalTouch &&
            horizontalOverlap
          );


        if (isAdjacent) {

          edges.push({
            id:
              `${unitA.id}-ADJACENT-${unitB.id}`,

            source:
              unitA.id,

            target:
              unitB.id,

            relation:
              "ADJACENT",
          });

          edges.push({
            id:
              `${unitB.id}-ADJACENT-${unitA.id}`,

            source:
              unitB.id,

            target:
              unitA.id,

            relation:
              "ADJACENT",
          });
        }
      }
    }
  });


  return {
    nodes,
    edges,
  };
}