import { NextResponse } from "next/server";
import { validateULPINFormat } from "@/src/lib/ulpin/generator";

export interface ParcelSubmission {
  id: string;
  applicantName: string;
  surfaceParcelId: string;
  buildingData: any;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "REVISION_REQUIRED";
  submittedAt: string;
  surveyorNotes?: string;
  georeference: {
    latitude: number;
    longitude: number;
    elevationOffset: number;
  };
}

// In-memory mock storage for pending surveyor reviews
const pendingSubmissions: Map<string, ParcelSubmission> = new Map();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { applicantName, surfaceParcelId, buildingData, georeference } = body;

    const submissionId = `SUB-${Date.now().toString().slice(-6)}`;
    const submission: ParcelSubmission = {
      id: submissionId,
      applicantName: applicantName || "Anonymous Citizen",
      surfaceParcelId: surfaceParcelId || "PARCEL-4012",
      buildingData,
      status: "PENDING_REVIEW",
      submittedAt: new Date().toISOString(),
      georeference: georeference || { latitude: 18.5204, longitude: 73.8567, elevationOffset: 0 },
    };

    pendingSubmissions.set(submissionId, submission);

    return NextResponse.json({
      success: true,
      message: "Field data submitted successfully. Pending Cadastral Surveyor approval.",
      submissionId,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Invalid submission data" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { submissionId, status, surveyorNotes } = body;

    const submission = pendingSubmissions.get(submissionId);
    if (!submission) {
      return NextResponse.json({ success: false, error: "Submission not found" }, { status: 404 });
    }

    submission.status = status;
    submission.surveyorNotes = surveyorNotes;
    pendingSubmissions.set(submissionId, submission);

    return NextResponse.json({
      success: true,
      message: `Parcel status updated to ${status}`,
      submission,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to update review status" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(Array.from(pendingSubmissions.values()));
}