import { execFileSync } from "node:child_process";

execFileSync("npx", ["prisma", "db", "push"], {
  stdio: "inherit"
});
