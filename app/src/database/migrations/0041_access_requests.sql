CREATE TABLE IF NOT EXISTS "access_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "full_name" varchar(255) NOT NULL,
  "work_email" varchar(255) NOT NULL,
  "phone" varchar(32),
  "company_name" varchar(255) NOT NULL,
  "job_title" varchar(128),
  "site_count" varchar(16),
  "message" text,
  "status" varchar(32) NOT NULL DEFAULT 'new',
  "consented_at" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS "access_requests_status_idx"
  ON "access_requests" ("status");

CREATE INDEX IF NOT EXISTS "access_requests_work_email_idx"
  ON "access_requests" ("work_email");
