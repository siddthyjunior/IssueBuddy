import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("Phase 2 project includes Prisma schema and initial migration", async () => {
  const schema = await readFile(resolve("prisma/schema.prisma"), "utf8");
  const migration = await readFile(resolve("prisma/migrations/20261031000000_init/migration.sql"), "utf8");
  for (const model of ["User", "Project", "ProjectMember", "Issue", "Comment", "ActivityLog", "Label", "Attachment", "Notification"]) {
    assert.match(schema, new RegExp(`model\\s+${model}\\s*\\{`));
  }
  assert.match(migration, /CREATE TABLE "issues"/);
  assert.match(migration, /CREATE TABLE "notifications"/);
});

test("project documents the Docker-first setup and API surface", async () => {
  const compose = await readFile(resolve("../docker-compose.yml"), "utf8");
  const docs = await readFile(resolve("../docs/API.md"), "utf8");
  assert.match(compose, /postgres:/);
  assert.match(compose, /backend:/);
  assert.match(compose, /frontend:/);
  assert.match(docs, /\/api\/issues/);
  assert.match(docs, /\/api\/analytics/);
});
