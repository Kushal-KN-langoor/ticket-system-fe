import { NextRequest, NextResponse } from "next/server";
import { readJsonFile, writeJsonFile } from "@/lib/jsonStore";
import { Project, MOCK_PROJECTS } from "@/lib/data";

const FILE = "projects.json";

export async function GET() {
  const projects = await readJsonFile<Project[]>(FILE, MOCK_PROJECTS);
  return NextResponse.json(projects);
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as Project[];
  if (!Array.isArray(body)) {
    return NextResponse.json(
      { error: "Expected an array of projects" },
      { status: 400 }
    );
  }
  await writeJsonFile(FILE, body);
  return NextResponse.json({ ok: true });
}
