import type { Entry } from "@/db/schema";
import { toDatetimeLocalValue } from "@/lib/timezone";

export function serializeEntry(entry: Entry) {
  return {
    id: entry.id,
    body: entry.body,
    tag: entry.tag ?? null,
    happenedAt: entry.happenedAt.toISOString(),
    happenedAtLocal: toDatetimeLocalValue(entry.happenedAt),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export type SerializedEntry = ReturnType<typeof serializeEntry>;
