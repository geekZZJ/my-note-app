import "dotenv/config";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("缺少 DATABASE_URL");
}

const parsed = new URL(url);
const database = parsed.pathname.replace(/^\//, "") || "my_note";

const schema = `
CREATE TABLE IF NOT EXISTS entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  body TEXT NOT NULL,
  tag VARCHAR(32) NULL,
  happened_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_entries_happened_at (happened_at),
  KEY idx_entries_tag (tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const conn = await mysql.createConnection({
  host: parsed.hostname,
  port: Number(parsed.port || 3306),
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  multipleStatements: true,
});

await conn.query(
  `CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`,
);
await conn.query(`USE \`${database}\``);
await conn.query(schema);

const [rows] = await conn.query("SHOW TABLES LIKE 'entries'");
console.log("tables:", rows);

const [cols] = await conn.query("DESCRIBE entries");
console.log(
  "columns:",
  cols.map((c) => c.Field).join(", "),
);

await conn.end();
console.log("setup ok:", database);
