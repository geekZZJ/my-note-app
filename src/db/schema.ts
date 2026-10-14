import {
  bigint,
  datetime,
  mysqlTable,
  text,
  varchar,
} from "drizzle-orm/mysql-core";

export const TAGS = ["body", "learn", "decision", "money"] as const;
export type EntryTag = (typeof TAGS)[number];

export const entries = mysqlTable("entries", {
  id: bigint("id", { mode: "number", unsigned: true })
    .autoincrement()
    .primaryKey(),
  body: text("body").notNull(),
  tag: varchar("tag", { length: 32 }),
  happenedAt: datetime("happened_at", { mode: "date", fsp: 3 }).notNull(),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
