import { and, asc, eq, gte, isNull, lt, like } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { entries } from "@/db/schema";
import { requireApiAuth } from "@/lib/auth";
import { serializeEntry } from "@/lib/serialize";
import { normalizeTag } from "@/lib/tags";
import {
  dayRange,
  parseHappenedAt,
  todayDateString,
} from "@/lib/timezone";

export async function GET(request: NextRequest) {
  const denied = await requireApiAuth(request);
  if (denied) return denied;

  const { searchParams } = request.nextUrl;
  const date = searchParams.get("date") || todayDateString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日期无效" }, { status: 400 });
  }

  const tagParam = searchParams.get("tag");
  const q = searchParams.get("q")?.trim() ?? "";

  try {
    const { start, end } = dayRange(date);
    const conditions = [
      gte(entries.happenedAt, start),
      lt(entries.happenedAt, end),
    ];

    if (tagParam === "none") {
      conditions.push(isNull(entries.tag));
    } else if (tagParam) {
      const tag = normalizeTag(tagParam);
      if (!tag) {
        return NextResponse.json({ error: "标签无效" }, { status: 400 });
      }
      conditions.push(eq(entries.tag, tag));
    }

    if (q) {
      conditions.push(like(entries.body, `%${q.replace(/[%_]/g, "\\$&")}%`));
    }

    const db = getDb();
    const rows = await db
      .select()
      .from(entries)
      .where(and(...conditions))
      .orderBy(asc(entries.happenedAt), asc(entries.id));

    return NextResponse.json({
      date,
      entries: rows.map(serializeEntry),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireApiAuth(request);
  if (denied) return denied;

  try {
    const payload = (await request.json()) as {
      body?: string;
      tag?: string | null;
      happenedAt?: string;
    };

    const body = payload.body?.trim() ?? "";
    if (!body) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }

    const tag = normalizeTag(payload.tag);
    const happenedAt = parseHappenedAt(payload.happenedAt);
    const now = new Date();

    const db = getDb();
    const result = await db.insert(entries).values({
      body,
      tag,
      happenedAt,
      createdAt: now,
      updatedAt: now,
    });

    const insertId = Number(result[0].insertId);
    const [row] = await db
      .select()
      .from(entries)
      .where(eq(entries.id, insertId))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "保存失败" }, { status: 500 });
    }

    return NextResponse.json({ entry: serializeEntry(row) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
