import { execSync, spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createConnection } from "node:net";

function getDatabaseUrl() {
  if (process.env.ERP_DATABASE_URL) return process.env.ERP_DATABASE_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const globalEnvPath = join(homedir(), ".env.global");
  if (existsSync(globalEnvPath)) {
    const content = readFileSync(globalEnvPath, "utf-8");
    const match = content.match(/^ERP_DATABASE_URL=(.+)$/m);
    if (match) return match[1].trim();
  }
  return "";
}

function parsePostgresUrl(url) {
  try {
    const u = new URL(url);
    return { host: u.hostname || "localhost", port: parseInt(u.port) || 5432 };
  } catch {
    return null;
  }
}

function checkTcp(host, port) {
  return new Promise((resolve) => {
    const sock = createConnection({ host, port, timeout: 3000 });
    sock.on("connect", () => { sock.destroy(); resolve(true); });
    sock.on("error", () => resolve(false));
    sock.on("timeout", () => { sock.destroy(); resolve(false); });
  });
}

function log(icon, msg) {
  console.log(`${icon}  ${msg}`);
}

async function main() {
  console.log("\n--- dev:safe preflight ---\n");

  // 1. DATABASE_URL
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    log("\u2716", "DATABASE_URL not found (checked ERP_DATABASE_URL, DATABASE_URL, ~/.env.global)");
    process.exit(1);
  }
  log("\u2714", "DATABASE_URL found");

  // 2. TCP-connect to Postgres
  const parsed = parsePostgresUrl(dbUrl);
  if (!parsed) {
    log("\u2716", "Cannot parse DATABASE_URL");
    process.exit(1);
  }
  const reachable = await checkTcp(parsed.host, parsed.port);
  if (!reachable) {
    log("\u2716", `PostgreSQL unreachable at ${parsed.host}:${parsed.port}`);
    process.exit(1);
  }
  log("\u2714", `PostgreSQL reachable at ${parsed.host}:${parsed.port}`);

  // 3. prisma generate
  log("\u2699", "Running prisma generate...");
  try {
    execSync("npx prisma generate", { stdio: "inherit" });
  } catch {
    log("\u2716", "prisma generate failed");
    process.exit(1);
  }

  // 4. Migration status
  log("\u2699", "Checking migration status...");
  try {
    execSync("npx prisma migrate status", { stdio: "inherit" });
  } catch {
    log("\u26A0", "Migration status check returned warnings (see above)");
  }

  // 5. Start next dev
  console.log("\n--- Starting next dev ---\n");
  const child = spawn("npx", ["next", "dev"], { stdio: "inherit", env: process.env });
  child.on("exit", (code) => process.exit(code ?? 0));
}

main();
