import { desc, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { entries, type EntryTag } from "@/db/schema";
import { requireApiAuth } from "@/lib/auth";
import { deepseekChat } from "@/lib/deepseek";
import { isEntryTag } from "@/lib/tags";
import { dateStringOf, formatTime } from "@/lib/timezone";

const SYSTEM = `你帮这个人给未分类日记建议标签。只输出 JSON：
{"suggestions":[{"id":1,"tag":"body","reason":"不超过24个字"}]}
tag 只能是 body、learn、decision、money。
分别对应身体、学习与工作、决定、钱。
拿不准的不要放进 suggestions。
reason 用中文。id 必须来自给出的记录。`;

const TAG_ALIASES: Record<string, EntryTag> = {
  body: "body",
  身体: "body",
  learn: "learn",
  学习与工作: "learn",
  学习: "learn",
  decision: "decision",
  决定: "decision",
  money: "money",
  钱: "money",
};

function parseSuggestions(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1] : text) as unknown;
}

export async function POST(request: NextRequest) {
  const denied = await requireApiAuth(request);
  if (denied) return denied;

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(entries)
      .where(isNull(entries.tag))
      .orderBy(desc(entries.happenedAt), desc(entries.id))
      .limit(30);

    if (rows.length === 0) {
      return NextResponse.json({ suggestions: [], empty: true });
    }

    const byId = new Map(rows.map((row) => [row.id, row]));
    const lines = rows
      .slice()
      .reverse()
      .map(
        (row) =>
          `- id:${row.id} | ${dateStringOf(row.happenedAt)} ${formatTime(row.happenedAt)} | ${row.body.replace(/\s+/g, " ").trim()}`,
      )
      .join("\n");

    const content = await deepseekChat(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: lines },
      ],
      { json: true, maxTokens: 1500 },
    );

    const parsed = parseSuggestions(content) as {
      suggestions?: Array<{ id?: unknown; tag?: unknown; reason?: unknown }>;
    };

    const suggestions = (parsed.suggestions ?? [])
      .map((item) => {
        const id = Number(item.id);
        const row = byId.get(id);
        const tag =
          typeof item.tag === "string" ? TAG_ALIASES[item.tag] : undefined;
        if (!row || !tag || !isEntryTag(tag)) return null;
        const reason =
          typeof item.reason === "string" ? item.reason.trim().slice(0, 40) : "";
        return {
          id,
          tag,
          reason,
          body: row.body,
          happenedAtLocal: `${dateStringOf(row.happenedAt)} ${formatTime(row.happenedAt)}`,
        };
      })
      .filter((item) => item !== null);

    return NextResponse.json({ suggestions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "建议失败";
    const status = message.startsWith("缺少") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
