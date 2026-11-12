// Creates the database used by the vitest suite (UTF-8, separate from dev data).
// Run once after `npm run db:start`:  npm run db:create-test

import pkg from "pg";

const host = process.env.PG_HOST || "127.0.0.1";
const port = Number(process.env.PG_PORT || 5433);
const name = process.env.PG_TEST_DATABASE || "portfolio_test";

const client = new pkg.Client({ host, port, user: "postgres", password: "postgres", database: "postgres" });
await client.connect();

const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
if (existing.rowCount === 0) {
  await client.query(`CREATE DATABASE "${name}" WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`);
  console.log(`[test-db] created ${name}`);
} else {
  console.log(`[test-db] ${name} already exists`);
}
await client.end();
