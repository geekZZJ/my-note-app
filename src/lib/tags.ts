import type { EntryTag } from "@/db/schema";
import { TAGS } from "@/db/schema";

export const TAG_LABELS: Record<EntryTag, string> = {
  body: "身体",
  learn: "学习与工作",
  decision: "决定",
};

export const TAG_OPTIONS: Array<{ value: EntryTag | ""; label: string }> = [
  { value: "", label: "不标" },
  { value: "body", label: "身体" },
  { value: "learn", label: "学习与工作" },
  { value: "decision", label: "决定" },
];

export function isEntryTag(value: unknown): value is EntryTag {
  return typeof value === "string" && (TAGS as readonly string[]).includes(value);
}

export function normalizeTag(value: unknown): EntryTag | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (isEntryTag(value)) {
    return value;
  }
  throw new Error("无效标签");
}

export function tagSectionTitle(tag: EntryTag | null): string {
  if (!tag) return "未分类";
  return TAG_LABELS[tag];
}
