"use server";

import { prisma } from "@/prisma";

export async function getPublicVerifiedBuildings() {
  try {
    const verifiedBuildings = await prisma.building.findMany({
      where: {
        approvalStatus: "APPROVED", // Strict verification filter
      },
      include: {
        floors: {
          include: {
            units: true,
          },
          orderBy: {
            floorNumber: "asc",
          },
        },
      },
    });

    return { success: true, data: verifiedBuildings };
  } catch (error) {
    console.error("Failed to fetch public verified buildings:", error);
    return { success: false, data: [] };
  }
}