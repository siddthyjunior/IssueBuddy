CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'DEVELOPER', 'VIEWER');
CREATE TYPE "ProjectRole" AS ENUM ('MANAGER', 'DEVELOPER', 'VIEWER');
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'REVIEW', 'CLOSED');
CREATE TYPE "IssuePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "NotificationType" AS ENUM ('ISSUE_ASSIGNED', 'COMMENT_ADDED', 'ISSUE_UPDATED');

CREATE TABLE "users" (
  "id" UUID NOT NULL, "name" VARCHAR(100) NOT NULL, "email" VARCHAR(255) NOT NULL,
  "password_hash" TEXT NOT NULL, "role" "UserRole" NOT NULL DEFAULT 'DEVELOPER',
  "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "projects" (
  "id" UUID NOT NULL, "name" VARCHAR(120) NOT NULL, "key" VARCHAR(12) NOT NULL,
  "description" TEXT NOT NULL DEFAULT '', "next_issue_number" INTEGER NOT NULL DEFAULT 1,
  "owner_id" UUID NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "projects_key_key" ON "projects"("key");
CREATE INDEX "projects_owner_id_idx" ON "projects"("owner_id");

CREATE TABLE "project_members" (
  "id" UUID NOT NULL, "project_id" UUID NOT NULL, "user_id" UUID NOT NULL,
  "role" "ProjectRole" NOT NULL DEFAULT 'DEVELOPER', "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

CREATE TABLE "issues" (
  "id" UUID NOT NULL, "issue_key" VARCHAR(30) NOT NULL, "title" VARCHAR(160) NOT NULL,
  "description" TEXT NOT NULL DEFAULT '', "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "IssuePriority" NOT NULL DEFAULT 'MEDIUM', "project_id" UUID NOT NULL,
  "assignee_id" UUID, "reporter_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "issues_issue_key_key" ON "issues"("issue_key");
CREATE INDEX "issues_project_id_status_idx" ON "issues"("project_id", "status");
CREATE INDEX "issues_project_id_priority_idx" ON "issues"("project_id", "priority");
CREATE INDEX "issues_assignee_id_idx" ON "issues"("assignee_id");
CREATE INDEX "issues_reporter_id_idx" ON "issues"("reporter_id");

CREATE TABLE "comments" (
  "id" UUID NOT NULL, "body" VARCHAR(5000) NOT NULL, "issue_id" UUID NOT NULL,
  "user_id" UUID NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "comments_issue_id_created_at_idx" ON "comments"("issue_id", "created_at");

CREATE TABLE "activity_logs" (
  "id" UUID NOT NULL, "action" VARCHAR(80) NOT NULL, "details" JSONB NOT NULL,
  "issue_id" UUID NOT NULL, "actor_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "activity_logs_issue_id_created_at_idx" ON "activity_logs"("issue_id", "created_at");

CREATE TABLE "labels" (
  "id" UUID NOT NULL, "name" VARCHAR(40) NOT NULL, "color" VARCHAR(7) NOT NULL DEFAULT '#8b6df0',
  "project_id" UUID NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "labels_project_id_name_key" ON "labels"("project_id", "name");

CREATE TABLE "issue_labels" (
  "issue_id" UUID NOT NULL, "label_id" UUID NOT NULL,
  CONSTRAINT "issue_labels_pkey" PRIMARY KEY ("issue_id", "label_id")
);

CREATE TABLE "attachments" (
  "id" UUID NOT NULL, "original_name" VARCHAR(255) NOT NULL, "storage_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(120) NOT NULL, "size" INTEGER NOT NULL, "issue_id" UUID NOT NULL,
  "uploaded_by_id" UUID NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "attachments_storage_name_key" ON "attachments"("storage_name");
CREATE INDEX "attachments_issue_id_idx" ON "attachments"("issue_id");

CREATE TABLE "notifications" (
  "id" UUID NOT NULL, "type" "NotificationType" NOT NULL, "message" VARCHAR(500) NOT NULL,
  "recipient_id" UUID NOT NULL, "actor_id" UUID, "issue_id" UUID,
  "read_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_recipient_id_read_at_created_at_idx" ON "notifications"("recipient_id", "read_at", "created_at");

ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issues" ADD CONSTRAINT "issues_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "issues" ADD CONSTRAINT "issues_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "labels" ADD CONSTRAINT "labels_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
