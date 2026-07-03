import { NextRequest, NextResponse } from "next/server";
import { readJsonFile, writeJsonFile } from "@/lib/jsonStore";
import type { User } from "@/context/AppStore";

const FILE = "users.json";

export async function GET() {
  const users = await readJsonFile<User[]>(FILE, []);
  return NextResponse.json(users);
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as User[];
  if (!Array.isArray(body)) {
    return NextResponse.json(
      { error: "Expected an array of users" },
      { status: 400 }
    );
  }
  await writeJsonFile(FILE, body);
  return NextResponse.json({ ok: true });
}