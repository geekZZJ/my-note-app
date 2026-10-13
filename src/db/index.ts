import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  mysqlPool?: mysql.Pool;
};

function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("缺少 DATABASE_URL");
  }

  if (!globalForDb.mysqlPool) {
    globalForDb.mysqlPool = mysql.createPool(url);
  }

  return globalForDb.mysqlPool;
}

export function getDb() {
  return drizzle(getPool(), { schema, mode: "default" });
}
