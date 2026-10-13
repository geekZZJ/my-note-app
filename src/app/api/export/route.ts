import { asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { entries } from "@/db/schema";
import { requireApiAuth } from "@/lib/auth";
import { buildMarkdownZip } from "@/lib/export-md";
import { todayDateString } from "@/lib/timezone";

export async function GET(request: NextRequest) {
  const denied = await requireApiAuth(request);
  if (denied) return denied;

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(entries)
      .orderBy(asc(entries.happenedAt), asc(entries.id));

    const zip = await buildMarkdownZip(rows);
    const filename = `my-note-${todayDateString()}.zip`;

    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "导出失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
