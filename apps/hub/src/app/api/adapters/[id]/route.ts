import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAdapter, deleteAdapter } from "@/lib/adapter-store";
import { isAuthorized } from "@/lib/auth";

// ---------------------------------------------------------------------------
// GET /api/adapters/[id] — single adapter detail
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const entry = getAdapter(id);

  if (!entry || entry.status !== "published") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Adapter not found." } },
      { status: 404 },
    );
  }

  // Strip internal-only fields from unauthenticated public response
  const { rejectionReason: _, ...publicEntry } = entry;

  return NextResponse.json({ data: publicEntry });
}

// ---------------------------------------------------------------------------
// DELETE /api/adapters/[id] — remove adapter (auth required)
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Missing or invalid authorization token." } },
      { status: 401 },
    );
  }

  const { id } = await params;
  const deleted = deleteAdapter(id);

  if (!deleted) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Adapter not found." } },
      { status: 404 },
    );
  }

  return new NextResponse(null, { status: 204 });
}
