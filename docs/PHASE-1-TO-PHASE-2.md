# Unified implementation: Phase 1 → Phase 2

This repository is the single, integrated IssueBuddy application. It includes the Phase 1 CRUD learning objectives and their expanded Phase 2 implementation. There are not two separate apps to run.

## How Phase 1 is represented

The original report's core ticket operations are all retained: create, list/read, read by ID, update, partial update, delete, status and priority validation, search, filtering and pagination. They are implemented in the unified Express API under `/api/issues`, backed by PostgreSQL rather than the original prototype's JSON file. This avoids maintaining two competing data stores and ensures the basic CRUD features work with projects, users, comments and activity history.

The report's original status values (`open`, `in_progress`, `review`, `closed`) and priority values (`low`, `medium`, `high`, `urgent`) are represented as Prisma enums and exposed through the API. The UI provides both table/list and Kanban workflows.

## How Phase 2 extends it

Phase 2 adds PostgreSQL/Prisma persistence, authentication, global and project roles, project membership, comments, activity history, notifications, attachments, analytics, Docker Compose orchestration and GitHub Actions CI.

## Running the one unified app

Run `docker compose up --build -d` from this repository root. Use the root README for setup and API documentation. The Phase 1 Postman collection is retained as a reference for the original CRUD exercise; the Phase 2 collection tests the unified API.

## Data migration note

The original Phase 1 `db.json` is not automatically imported. The unified app starts with PostgreSQL and seeded demo data. If you have created real tickets in a previous Phase 1 JSON volume, export/transform them before importing; do not delete the old Docker volume until that data has been backed up.
