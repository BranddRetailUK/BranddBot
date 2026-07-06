import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

try {
  execFileSync("npx", ["prisma", "db", "push"], {
    stdio: "inherit"
  });
  process.exit(0);
} catch {
  console.warn("prisma db push failed; falling back to Prisma-generated SQL applied with sqlite3.");
}

const dbPath = path.join(process.cwd(), "prisma", "dev.db");

if (fs.existsSync(dbPath)) {
  console.log(`SQLite database already exists at ${dbPath}. Leaving it unchanged.`);
  process.exit(0);
}

const sql = execFileSync(
  "npx",
  ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"],
  { encoding: "utf8" }
);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
execFileSync("sqlite3", [dbPath], {
  input: sql,
  stdio: ["pipe", "inherit", "inherit"]
});

console.log(`SQLite database initialized at ${dbPath}.`);
