import { asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { entries } from "@/db/schema";
import { requireApiAuth } from "@/lib/auth";
import { openDeepseekStream } from "@/lib/deepseek";
import { buildCorpusMarkdown } from "@/lib/export-md";

const SYSTEM = `你是这个人的记录阅读者。材料是他本人写下的日记，时区是 Asia/Shanghai。
未分类是原文。身体、学习与工作、决定、钱是他选的标签。
决定是他写下的选择，不是你的建议。
只根据材料回答。材料里没有的，直接说记录里没有。
不要替他决定职业、搬家、结婚或投资。
用中文，尽量短。`;

export async function POST(request: NextRequest) {
  const denied = await requireApiAuth(request);
  if (denied) return denied;

  let question = "";
  try {
    const payload = (await request.json()) as { question?: string };
    question = payload.question?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "请求无效" }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ error: "写下一个问题" }, { status: 400 });
  }
  if (question.length > 800) {
    return NextResponse.json({ error: "问题太长" }, { status: 400 });
  }

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(entries)
      .orderBy(asc(entries.happenedAt), asc(entries.id));
    const corpus = buildCorpusMarkdown(rows);
    const stream = await openDeepseekStream([
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `记录如下：\n\n${corpus}\n\n问题：${question}`,
      },
    ]);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "提问失败";
    const status = message.startsWith("缺少") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
