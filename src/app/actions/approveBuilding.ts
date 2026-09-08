"use server";

import { prisma } from "@/src/lib/prisma";

export async function approveAndRegisterBuilding(
  buildingId: string,
  surveyorId: string
) {
  try {
    const updatedBuilding = await prisma.$transaction(async (tx) => {
      // 1. Mark Building as Surveyor Approved
      const building = await tx.building.update({
        where: { id: buildingId },
        data: {
          approvalStatus: "APPROVED",
          surveyorId: surveyorId,
          verifiedAt: new Date(),
        },
        include: {
          floors: {
            include: { units: true },
          },
        },
      });

      // 2. Generate 3D ULPINs for all units in building
      for (const floor of building.floors) {
        for (const unit of floor.units) {
          const generatedULPIN = `14-4012-0001-3D-F0${floor.floorNumber}-${unit.unitNumber}`;
          await tx.property.update({
            where: { id: unit.id },
            data: { ulpin: generatedULPIN },
          });
        }
      }

      return building;
    });

    return { success: true, data: updatedBuilding };
  } catch (error) {
    console.error("Surveyor approval transaction failed:", error);
    return { success: false, error: "Approval failed." };
  }
}