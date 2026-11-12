// Local PostgreSQL for development.
//
// Starts a real PostgreSQL server from the binaries shipped in
// @embedded-postgres/windows-x64 (no system install, no Docker) on port 5433.
// Data lives in .pgdata and survives restarts. In production point
// DATABASE_URL at a managed PostgreSQL instance instead; the schema and
// migrations are identical.
//
//   node scripts/dev-db.mjs start   # start (initialises on first run)
//   Ctrl+C                          # stop
//
// The server is a child process of this script, so it stops when the script
// exits. Keep this script running in its own terminal while developing.

import fs from "node:fs";
import EmbeddedPostgres from "embedded-postgres";
import pkg from "pg";

const port = Number(process.env.PG_PORT || 5433);
const database = process.env.PG_DATABASE || "portfolio";
const databaseDir = process.env.PG_DATA_DIR || ".pgdata";

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
});

async function main() {
  if (!fs.existsSync(`${databaseDir}/PG_VERSION`)) {
    console.log(`[db] initialising cluster in ${databaseDir}`);
    await pg.initialise();
  }

  await pg.start();
  console.log(`[db] PostgreSQL listening on 127.0.0.1:${port}`);

  // Create the database explicitly as UTF-8. A Windows cluster defaults to
  // WIN1252, which cannot store Vietnamese or any non-Latin content.
  const admin = new pkg.Client({ host: "127.0.0.1", port, user: "postgres", password: "postgres", database: "postgres" });
  await admin.connect();
  const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
  if (existing.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${database}" WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`);
    console.log(`[db] created database "${database}" (UTF8)`);
  } else {
    console.log(`[db] database "${database}" already exists`);
  }
  await admin.end();

  const shutdown = async () => {
    console.log("[db] stopping");
    await pg.stop().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep the cluster (and this bridge process) alive.
  setInterval(() => {}, 1 << 30);
}

main().catch((error) => {
  console.error("[db] failed:", error);
  process.exit(1);
});
