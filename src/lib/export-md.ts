import JSZip from "jszip";
import type { Entry } from "@/db/schema";
import { TAGS, type EntryTag } from "@/db/schema";
import { TAG_LABELS, tagSectionTitle } from "@/lib/tags";
import {
  TIMEZONE,
  dateStringOf,
  formatTime,
} from "@/lib/timezone";

function escapeMdInline(text: string): string {
  return text.replace(/\r?\n/g, " ").trim();
}

function buildReadme(): string {
  return `# 随手记录导出

时区：${TIMEZONE}

## 标签含义

- **未分类**：想到就写的原始记录，尚未归类。
- **身体**：训练、睡眠、饮食、身体感受。
- **学习与工作**：学到的东西、做了什么、进度。
- **决定**：你自己写下的选择与理由（不是建议，不是 AI 的结论）。
- **钱**：这一天花了多少、为什么花。

## 目录

- \`daily/YYYY-MM-DD.md\`：按自然日拆开的记录。
- 每条带本地时间和 \`id\`，方便以后回写或对照数据库。

数据库是工作副本；本目录是可以搬走的副本。换工具时先读本 README，再读 daily 文件即可接手。
`;
}

function buildDailyMarkdown(date: string, dayEntries: Entry[]): string {
  const byTag: Record<"none" | EntryTag, Entry[]> = {
    none: [],
    body: [],
    learn: [],
    decision: [],
    money: [],
  };

  for (const entry of dayEntries) {
    const key =
      entry.tag && (TAGS as readonly string[]).includes(entry.tag)
        ? (entry.tag as EntryTag)
        : "none";
    byTag[key].push(entry);
  }

  const sections: Array<{ title: string; items: Entry[] }> = [
    { title: tagSectionTitle(null), items: byTag.none },
    { title: TAG_LABELS.body, items: byTag.body },
    { title: TAG_LABELS.learn, items: byTag.learn },
    { title: TAG_LABELS.decision, items: byTag.decision },
    { title: TAG_LABELS.money, items: byTag.money },
  ];

  const lines = [
    "---",
    `date: ${date}`,
    `timezone: ${TIMEZONE}`,
    "---",
    "",
    `# ${date}`,
    "",
  ];

  for (const section of sections) {
    lines.push(`## ${section.title}`, "");
    if (section.items.length === 0) {
      lines.push("");
      continue;
    }
    for (const item of section.items) {
      lines.push(
        `- ${formatTime(item.happenedAt)} | id:${item.id} | ${escapeMdInline(item.body)}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export async function buildMarkdownZip(allEntries: Entry[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("README.md", buildReadme());

  const byDate = new Map<string, Entry[]>();
  for (const entry of allEntries) {
    const date = dateStringOf(entry.happenedAt);
    const list = byDate.get(date) ?? [];
    list.push(entry);
    byDate.set(date, list);
  }

  const dates = [...byDate.keys()].sort();
  for (const date of dates) {
    const dayEntries = (byDate.get(date) ?? []).sort(
      (a, b) => a.happenedAt.getTime() - b.happenedAt.getTime(),
    );
    zip.file(`daily/${date}.md`, buildDailyMarkdown(date, dayEntries));
  }

  // 没有任何记录时也留一个空日目录说明
  if (dates.length === 0) {
    zip.file(
      "daily/.gitkeep",
      "导出时还没有记录。开始记之后这里会出现按日期的 Markdown。\n",
    );
  }

  const data = await zip.generateAsync({ type: "nodebuffer" });
  return Buffer.from(data);
}
