import { NextRequest, NextResponse } from "next/server";
import { readJsonFile, writeJsonFile } from "@/lib/jsonStore";
import type { User } from "@/context/AppStore";

const FILE = "session.json";

// GET /api/session -> returns { currentUser: User | null }
export async function GET() {
  const session = await readJsonFile<{ currentUser: User | null }>(FILE, {
    currentUser: null,
  });
  return NextResponse.json(session);
}

// PUT /api/session -> body: { currentUser: User | null }
export async function PUT(req: NextRequest) {
  const body = (await req.json()) as { currentUser: User | null };
  await writeJsonFile(FILE, body);
  return NextResponse.json({ ok: true });
}
