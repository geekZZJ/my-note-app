import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  mysqlPoolShanghai?: mysql.Pool;
};

function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("缺少 DATABASE_URL");
  }

  if (!globalForDb.mysqlPoolShanghai) {
    const parsed = new URL(url);
    const database = parsed.pathname.replace(/^\//, "");
    globalForDb.mysqlPoolShanghai = mysql.createPool({
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database,
      charset: "utf8mb4",
      // DATETIME 不带时区。读写都按上海时间，避免本机和服务器时区不一致时日期错位。
      timezone: "+08:00",
    });
  }

  return globalForDb.mysqlPoolShanghai;
}

export function getDb() {
  return drizzle(getPool(), { schema, mode: "default" });
}
