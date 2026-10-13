import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { entries } from "@/db/schema";
import { requireApiAuth } from "@/lib/auth";
import { serializeEntry } from "@/lib/serialize";
import { normalizeTag } from "@/lib/tags";
import { parseHappenedAt } from "@/lib/timezone";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const denied = await requireApiAuth(request);
  if (denied) return denied;

  const { id: idRaw } = await context.params;
  const id = Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "id 无效" }, { status: 400 });
  }

  try {
    const payload = (await request.json()) as {
      body?: string;
      tag?: string | null;
      happenedAt?: string;
    };

    const patch: Partial<typeof entries.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (payload.body !== undefined) {
      const body = payload.body.trim();
      if (!body) {
        return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
      }
      patch.body = body;
    }

    if (payload.tag !== undefined) {
      patch.tag = normalizeTag(payload.tag);
    }

    if (payload.happenedAt !== undefined) {
      patch.happenedAt = parseHappenedAt(payload.happenedAt);
    }

    const db = getDb();
    await db.update(entries).set(patch).where(eq(entries.id, id));

    const [row] = await db
      .select()
      .from(entries)
      .where(eq(entries.id, id))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }

    return NextResponse.json({ entry: serializeEntry(row) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const denied = await requireApiAuth(request);
  if (denied) return denied;

  const { id: idRaw } = await context.params;
  const id = Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "id 无效" }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .select()
    .from(entries)
    .where(eq(entries.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  }

  await db.delete(entries).where(eq(entries.id, id));
  return NextResponse.json({ ok: true });
}
