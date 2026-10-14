import type { EntryTag } from "@/db/schema";
import { TAGS } from "@/db/schema";

export const TAG_LABELS: Record<EntryTag, string> = {
  body: "身体",
  learn: "学习与工作",
  decision: "决定",
  money: "钱",
};

export const TAG_OPTIONS: Array<{ value: EntryTag | ""; label: string }> = [
  { value: "", label: "不标" },
  { value: "body", label: "身体" },
  { value: "learn", label: "学习与工作" },
  { value: "decision", label: "决定" },
  { value: "money", label: "钱" },
];

/** 把金额和原因收成一条可读记录。金额允许 0，最多两位小数。 */
export function formatMoneyBody(amountRaw: string, reasonRaw: string): string {
  const reason = reasonRaw.trim();
  const amountText = amountRaw.trim();
  if (!reason || !amountText) {
    throw new Error("写下花了多少、为什么花");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(amountText)) {
    throw new Error("金额写成数字，最多两位小数");
  }
  const shown = Number(amountText).toFixed(2).replace(/\.?0+$/, "");
  return `花了 ${shown} 元：${reason}`;
}

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
