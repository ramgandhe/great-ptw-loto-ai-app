CREATE TABLE IF NOT EXISTS "isolation_execution" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "plan_id" uuid NOT NULL,
  "status" varchar(32) DEFAULT 'in_progress' NOT NULL,
  "started_by" uuid NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "isolated_at" timestamp with time zone,
  "verified_at" timestamp with time zone,
  "restored_at" timestamp with time zone,
  "restored_by" uuid,
  CONSTRAINT "isolation_execution_status_check"
    CHECK ("status" IN ('in_progress', 'isolated', 'verified', 'restored')),
  CONSTRAINT "isolation_execution_plan_id_lototo_plans_id_fk"
    FOREIGN KEY ("plan_id") REFERENCES "lototo_plans"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "isolation_execution_plan_id_unique"
  ON "isolation_execution" ("plan_id");
CREATE INDEX IF NOT EXISTS "isolation_execution_tenant_id_idx"
  ON "isolation_execution" ("tenant_id");
CREATE INDEX IF NOT EXISTS "isolation_execution_tenant_status_idx"
  ON "isolation_execution" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "isolation_execution_started_by_idx"
  ON "isolation_execution" ("started_by");

CREATE TABLE IF NOT EXISTS "applied_locks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "execution_id" uuid NOT NULL,
  "isolation_point_id" uuid NOT NULL,
  "lock_tag" varchar(64) NOT NULL,
  "lock_method" varchar(64) NOT NULL,
  "status" varchar(32) DEFAULT 'applied' NOT NULL,
  "applied_by" uuid NOT NULL,
  "applied_at" timestamp with time zone DEFAULT now() NOT NULL,
  "removed_by" uuid,
  "removed_at" timestamp with time zone,
  CONSTRAINT "applied_locks_status_check"
    CHECK ("status" IN ('applied', 'removed')),
  CONSTRAINT "applied_locks_execution_id_isolation_execution_id_fk"
    FOREIGN KEY ("execution_id") REFERENCES "isolation_execution"("id") ON DELETE CASCADE,
  CONSTRAINT "applied_locks_isolation_point_id_isolation_points_id_fk"
    FOREIGN KEY ("isolation_point_id") REFERENCES "isolation_points"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "applied_locks_tenant_id_idx"
  ON "applied_locks" ("tenant_id");
CREATE INDEX IF NOT EXISTS "applied_locks_execution_id_idx"
  ON "applied_locks" ("execution_id");
CREATE INDEX IF NOT EXISTS "applied_locks_isolation_point_id_idx"
  ON "applied_locks" ("isolation_point_id");
CREATE UNIQUE INDEX IF NOT EXISTS "applied_locks_execution_point_tag_unique"
  ON "applied_locks" ("execution_id", "isolation_point_id", "lock_tag");

CREATE TABLE IF NOT EXISTS "applied_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "execution_id" uuid NOT NULL,
  "isolation_point_id" uuid NOT NULL,
  "tag_number" varchar(64) NOT NULL,
  "tag_type" varchar(64) NOT NULL,
  "reason" text,
  "status" varchar(32) DEFAULT 'applied' NOT NULL,
  "applied_by" uuid NOT NULL,
  "applied_at" timestamp with time zone DEFAULT now() NOT NULL,
  "removed_by" uuid,
  "removed_at" timestamp with time zone,
  CONSTRAINT "applied_tags_status_check"
    CHECK ("status" IN ('applied', 'removed')),
  CONSTRAINT "applied_tags_execution_id_isolation_execution_id_fk"
    FOREIGN KEY ("execution_id") REFERENCES "isolation_execution"("id") ON DELETE CASCADE,
  CONSTRAINT "applied_tags_isolation_point_id_isolation_points_id_fk"
    FOREIGN KEY ("isolation_point_id") REFERENCES "isolation_points"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "applied_tags_tenant_id_idx"
  ON "applied_tags" ("tenant_id");
CREATE INDEX IF NOT EXISTS "applied_tags_execution_id_idx"
  ON "applied_tags" ("execution_id");
CREATE INDEX IF NOT EXISTS "applied_tags_isolation_point_id_idx"
  ON "applied_tags" ("isolation_point_id");
CREATE UNIQUE INDEX IF NOT EXISTS "applied_tags_execution_point_number_unique"
  ON "applied_tags" ("execution_id", "isolation_point_id", "tag_number");

CREATE TABLE IF NOT EXISTS "isolation_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "tenant_id" uuid NOT NULL,
  "execution_id" uuid NOT NULL,
  "isolation_point_id" uuid NOT NULL,
  "result" varchar(32) NOT NULL,
  "method" varchar(64),
  "verified_by" uuid NOT NULL,
  "verified_at" timestamp with time zone DEFAULT now() NOT NULL,
  "comment" text,
  CONSTRAINT "isolation_verifications_result_check"
    CHECK ("result" IN ('pass', 'fail')),
  CONSTRAINT "isolation_verifications_execution_id_isolation_execution_id_fk"
    FOREIGN KEY ("execution_id") REFERENCES "isolation_execution"("id") ON DELETE CASCADE,
  CONSTRAINT "isolation_verifications_isolation_point_id_isolation_points_id_fk"
    FOREIGN KEY ("isolation_point_id") REFERENCES "isolation_points"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "isolation_verifications_tenant_id_idx"
  ON "isolation_verifications" ("tenant_id");
CREATE INDEX IF NOT EXISTS "isolation_verifications_execution_id_idx"
  ON "isolation_verifications" ("execution_id");
CREATE INDEX IF NOT EXISTS "isolation_verifications_isolation_point_id_idx"
  ON "isolation_verifications" ("isolation_point_id");
CREATE INDEX IF NOT EXISTS "isolation_verifications_verified_by_idx"
  ON "isolation_verifications" ("verified_by");
-- Only one passing verification may exist per isolation point within an execution.
CREATE UNIQUE INDEX IF NOT EXISTS "isolation_verifications_execution_point_pass_unique"
  ON "isolation_verifications" ("execution_id", "isolation_point_id")
  WHERE "result" = 'pass';

CREATE TABLE IF NOT EXISTS "isolation_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "tenant_id" uuid NOT NULL,
  "execution_id" uuid NOT NULL,
  "isolation_point_id" uuid,
  "verification_id" uuid,
  "file_name" varchar(255) NOT NULL,
  "content_type" varchar(128) NOT NULL,
  "file_size" bigint NOT NULL,
  "storage_bucket" varchar(128) NOT NULL,
  "storage_key" varchar(512) NOT NULL,
  "checksum" varchar(128),
  "captured_by" uuid NOT NULL,
  "captured_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "isolation_evidence_execution_id_isolation_execution_id_fk"
    FOREIGN KEY ("execution_id") REFERENCES "isolation_execution"("id") ON DELETE CASCADE,
  CONSTRAINT "isolation_evidence_isolation_point_id_isolation_points_id_fk"
    FOREIGN KEY ("isolation_point_id") REFERENCES "isolation_points"("id") ON DELETE SET NULL,
  CONSTRAINT "isolation_evidence_verification_id_isolation_verifications_id_fk"
    FOREIGN KEY ("verification_id") REFERENCES "isolation_verifications"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "isolation_evidence_tenant_id_idx"
  ON "isolation_evidence" ("tenant_id");
CREATE INDEX IF NOT EXISTS "isolation_evidence_execution_id_idx"
  ON "isolation_evidence" ("execution_id");
CREATE INDEX IF NOT EXISTS "isolation_evidence_isolation_point_id_idx"
  ON "isolation_evidence" ("isolation_point_id");
CREATE INDEX IF NOT EXISTS "isolation_evidence_verification_id_idx"
  ON "isolation_evidence" ("verification_id");
CREATE UNIQUE INDEX IF NOT EXISTS "isolation_evidence_storage_key_unique"
  ON "isolation_evidence" ("storage_bucket", "storage_key");

-- Tenant isolation: an execution must belong to the same tenant as its LOTOTO plan.
CREATE OR REPLACE FUNCTION enforce_isolation_execution_tenant()
RETURNS trigger AS $$
DECLARE
  plan_tenant_id uuid;
BEGIN
  SELECT "tenant_id" INTO plan_tenant_id
  FROM "lototo_plans"
  WHERE "id" = NEW."plan_id";

  IF plan_tenant_id IS NULL THEN
    RAISE EXCEPTION 'isolation_execution requires an existing LOTOTO plan';
  END IF;

  IF plan_tenant_id IS DISTINCT FROM NEW."tenant_id" THEN
    RAISE EXCEPTION 'isolation_execution tenant_id must match its LOTOTO plan tenant';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS isolation_execution_tenant_match ON "isolation_execution";
CREATE TRIGGER isolation_execution_tenant_match
  BEFORE INSERT OR UPDATE ON "isolation_execution"
  FOR EACH ROW EXECUTE FUNCTION enforce_isolation_execution_tenant();

-- Tenant isolation + referential scope for lock/tag/verification children:
-- tenant must match the parent execution, and the isolation point must belong
-- to the same LOTOTO plan as the execution (blocks cross-tenant references).
CREATE OR REPLACE FUNCTION enforce_isolation_child_scope()
RETURNS trigger AS $$
DECLARE
  execution_tenant_id uuid;
  execution_plan_id uuid;
  point_plan_id uuid;
BEGIN
  SELECT "tenant_id", "plan_id" INTO execution_tenant_id, execution_plan_id
  FROM "isolation_execution"
  WHERE "id" = NEW."execution_id";

  IF execution_tenant_id IS NULL THEN
    RAISE EXCEPTION '% requires an existing isolation execution', TG_TABLE_NAME;
  END IF;

  IF execution_tenant_id IS DISTINCT FROM NEW."tenant_id" THEN
    RAISE EXCEPTION '% tenant_id must match its isolation execution tenant', TG_TABLE_NAME;
  END IF;

  SELECT "plan_id" INTO point_plan_id
  FROM "isolation_points"
  WHERE "id" = NEW."isolation_point_id";

  IF point_plan_id IS DISTINCT FROM execution_plan_id THEN
    RAISE EXCEPTION '% isolation_point_id must belong to the execution LOTOTO plan', TG_TABLE_NAME;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS applied_locks_scope_match ON "applied_locks";
CREATE TRIGGER applied_locks_scope_match
  BEFORE INSERT OR UPDATE ON "applied_locks"
  FOR EACH ROW EXECUTE FUNCTION enforce_isolation_child_scope();

DROP TRIGGER IF EXISTS applied_tags_scope_match ON "applied_tags";
CREATE TRIGGER applied_tags_scope_match
  BEFORE INSERT OR UPDATE ON "applied_tags"
  FOR EACH ROW EXECUTE FUNCTION enforce_isolation_child_scope();

DROP TRIGGER IF EXISTS isolation_verifications_scope_match ON "isolation_verifications";
CREATE TRIGGER isolation_verifications_scope_match
  BEFORE INSERT ON "isolation_verifications"
  FOR EACH ROW EXECUTE FUNCTION enforce_isolation_child_scope();

-- Evidence tenant isolation + optional point/verification scope.
CREATE OR REPLACE FUNCTION enforce_isolation_evidence_scope()
RETURNS trigger AS $$
DECLARE
  execution_tenant_id uuid;
  execution_plan_id uuid;
  point_plan_id uuid;
  verification_execution_id uuid;
BEGIN
  SELECT "tenant_id", "plan_id" INTO execution_tenant_id, execution_plan_id
  FROM "isolation_execution"
  WHERE "id" = NEW."execution_id";

  IF execution_tenant_id IS NULL THEN
    RAISE EXCEPTION 'isolation_evidence requires an existing isolation execution';
  END IF;

  IF execution_tenant_id IS DISTINCT FROM NEW."tenant_id" THEN
    RAISE EXCEPTION 'isolation_evidence tenant_id must match its isolation execution tenant';
  END IF;

  IF NEW."isolation_point_id" IS NOT NULL THEN
    SELECT "plan_id" INTO point_plan_id
    FROM "isolation_points"
    WHERE "id" = NEW."isolation_point_id";

    IF point_plan_id IS DISTINCT FROM execution_plan_id THEN
      RAISE EXCEPTION 'isolation_evidence isolation_point_id must belong to the execution LOTOTO plan';
    END IF;
  END IF;

  IF NEW."verification_id" IS NOT NULL THEN
    SELECT "execution_id" INTO verification_execution_id
    FROM "isolation_verifications"
    WHERE "id" = NEW."verification_id";

    IF verification_execution_id IS DISTINCT FROM NEW."execution_id" THEN
      RAISE EXCEPTION 'isolation_evidence verification_id must belong to the same isolation execution';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS isolation_evidence_scope_match ON "isolation_evidence";
CREATE TRIGGER isolation_evidence_scope_match
  BEFORE INSERT ON "isolation_evidence"
  FOR EACH ROW EXECUTE FUNCTION enforce_isolation_evidence_scope();

-- Immutability: verification records may never be updated or deleted.
CREATE OR REPLACE FUNCTION prevent_isolation_verification_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'isolation_verifications records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS isolation_verifications_immutable ON "isolation_verifications";
CREATE TRIGGER isolation_verifications_immutable
  BEFORE UPDATE OR DELETE ON "isolation_verifications"
  FOR EACH ROW EXECUTE FUNCTION prevent_isolation_verification_mutation();

-- Immutability: captured evidence may never be updated or deleted.
CREATE OR REPLACE FUNCTION prevent_isolation_evidence_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'isolation_evidence records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS isolation_evidence_immutable ON "isolation_evidence";
CREATE TRIGGER isolation_evidence_immutable
  BEFORE UPDATE OR DELETE ON "isolation_evidence"
  FOR EACH ROW EXECUTE FUNCTION prevent_isolation_evidence_mutation();

-- Immutability: audit fields (created_at/created_by) cannot be altered on update
-- for the mutable execution/lock/tag registries.
CREATE OR REPLACE FUNCTION prevent_isolation_audit_field_mutation()
RETURNS trigger AS $$
BEGIN
  IF NEW."created_at" IS DISTINCT FROM OLD."created_at"
     OR NEW."created_by" IS DISTINCT FROM OLD."created_by" THEN
    RAISE EXCEPTION '% audit fields (created_at, created_by) are immutable', TG_TABLE_NAME;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS isolation_execution_audit_immutable ON "isolation_execution";
CREATE TRIGGER isolation_execution_audit_immutable
  BEFORE UPDATE ON "isolation_execution"
  FOR EACH ROW EXECUTE FUNCTION prevent_isolation_audit_field_mutation();

DROP TRIGGER IF EXISTS applied_locks_audit_immutable ON "applied_locks";
CREATE TRIGGER applied_locks_audit_immutable
  BEFORE UPDATE ON "applied_locks"
  FOR EACH ROW EXECUTE FUNCTION prevent_isolation_audit_field_mutation();

DROP TRIGGER IF EXISTS applied_tags_audit_immutable ON "applied_tags";
CREATE TRIGGER applied_tags_audit_immutable
  BEFORE UPDATE ON "applied_tags"
  FOR EACH ROW EXECUTE FUNCTION prevent_isolation_audit_field_mutation();
