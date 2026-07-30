CREATE TABLE IF NOT EXISTS "equipment_restorations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "execution_id" uuid NOT NULL,
  "isolation_point_id" uuid NOT NULL,
  "status" varchar(32) DEFAULT 'restored' NOT NULL,
  "method" varchar(64),
  "notes" text,
  "restored_by" uuid NOT NULL,
  "restored_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "equipment_restorations_status_check"
    CHECK ("status" IN ('pending', 'restored')),
  CONSTRAINT "equipment_restorations_execution_id_isolation_execution_id_fk"
    FOREIGN KEY ("execution_id") REFERENCES "isolation_execution"("id") ON DELETE CASCADE,
  CONSTRAINT "equipment_restorations_isolation_point_id_isolation_points_id_fk"
    FOREIGN KEY ("isolation_point_id") REFERENCES "isolation_points"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "equipment_restorations_tenant_id_idx"
  ON "equipment_restorations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "equipment_restorations_execution_id_idx"
  ON "equipment_restorations" ("execution_id");
CREATE INDEX IF NOT EXISTS "equipment_restorations_isolation_point_id_idx"
  ON "equipment_restorations" ("isolation_point_id");
CREATE UNIQUE INDEX IF NOT EXISTS "equipment_restorations_execution_point_unique"
  ON "equipment_restorations" ("execution_id", "isolation_point_id");

CREATE TABLE IF NOT EXISTS "lock_removals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "tenant_id" uuid NOT NULL,
  "execution_id" uuid NOT NULL,
  "applied_lock_id" uuid NOT NULL,
  "reason" text,
  "removed_by" uuid NOT NULL,
  "removed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "lock_removals_execution_id_isolation_execution_id_fk"
    FOREIGN KEY ("execution_id") REFERENCES "isolation_execution"("id") ON DELETE CASCADE,
  CONSTRAINT "lock_removals_applied_lock_id_applied_locks_id_fk"
    FOREIGN KEY ("applied_lock_id") REFERENCES "applied_locks"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "lock_removals_tenant_id_idx" ON "lock_removals" ("tenant_id");
CREATE INDEX IF NOT EXISTS "lock_removals_execution_id_idx" ON "lock_removals" ("execution_id");
CREATE UNIQUE INDEX IF NOT EXISTS "lock_removals_applied_lock_id_unique"
  ON "lock_removals" ("applied_lock_id");

CREATE TABLE IF NOT EXISTS "tag_removals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "tenant_id" uuid NOT NULL,
  "execution_id" uuid NOT NULL,
  "applied_tag_id" uuid NOT NULL,
  "reason" text,
  "removed_by" uuid NOT NULL,
  "removed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tag_removals_execution_id_isolation_execution_id_fk"
    FOREIGN KEY ("execution_id") REFERENCES "isolation_execution"("id") ON DELETE CASCADE,
  CONSTRAINT "tag_removals_applied_tag_id_applied_tags_id_fk"
    FOREIGN KEY ("applied_tag_id") REFERENCES "applied_tags"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "tag_removals_tenant_id_idx" ON "tag_removals" ("tenant_id");
CREATE INDEX IF NOT EXISTS "tag_removals_execution_id_idx" ON "tag_removals" ("execution_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tag_removals_applied_tag_id_unique"
  ON "tag_removals" ("applied_tag_id");

CREATE TABLE IF NOT EXISTS "restoration_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "tenant_id" uuid NOT NULL,
  "execution_id" uuid NOT NULL,
  "restoration_id" uuid,
  "isolation_point_id" uuid,
  "result" varchar(32) NOT NULL,
  "method" varchar(64),
  "verified_by" uuid NOT NULL,
  "verified_at" timestamp with time zone DEFAULT now() NOT NULL,
  "comment" text,
  CONSTRAINT "restoration_verifications_result_check"
    CHECK ("result" IN ('pass', 'fail')),
  CONSTRAINT "restoration_verifications_execution_id_isolation_execution_id_fk"
    FOREIGN KEY ("execution_id") REFERENCES "isolation_execution"("id") ON DELETE CASCADE,
  CONSTRAINT "restoration_verifications_restoration_id_equipment_restorations_id_fk"
    FOREIGN KEY ("restoration_id") REFERENCES "equipment_restorations"("id") ON DELETE SET NULL,
  CONSTRAINT "restoration_verifications_isolation_point_id_isolation_points_id_fk"
    FOREIGN KEY ("isolation_point_id") REFERENCES "isolation_points"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "restoration_verifications_tenant_id_idx"
  ON "restoration_verifications" ("tenant_id");
CREATE INDEX IF NOT EXISTS "restoration_verifications_execution_id_idx"
  ON "restoration_verifications" ("execution_id");
CREATE INDEX IF NOT EXISTS "restoration_verifications_restoration_id_idx"
  ON "restoration_verifications" ("restoration_id");
-- Only one passing restoration verification per isolation point within an execution.
CREATE UNIQUE INDEX IF NOT EXISTS "restoration_verifications_execution_point_pass_unique"
  ON "restoration_verifications" ("execution_id", "isolation_point_id")
  WHERE "result" = 'pass' AND "isolation_point_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "lototo_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "tenant_id" uuid NOT NULL,
  "plan_id" uuid,
  "execution_id" uuid,
  "action" varchar(64) NOT NULL,
  "entity_type" varchar(64) NOT NULL,
  "entity_id" uuid,
  "actor_id" uuid NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb
);

CREATE INDEX IF NOT EXISTS "lototo_history_tenant_id_idx" ON "lototo_history" ("tenant_id");
CREATE INDEX IF NOT EXISTS "lototo_history_plan_id_idx" ON "lototo_history" ("plan_id");
CREATE INDEX IF NOT EXISTS "lototo_history_execution_id_idx" ON "lototo_history" ("execution_id");
CREATE INDEX IF NOT EXISTS "lototo_history_tenant_occurred_at_idx"
  ON "lototo_history" ("tenant_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "lototo_history_plan_occurred_at_idx"
  ON "lototo_history" ("plan_id", "occurred_at");

-- Tenant isolation: restoration children must share their execution's tenant.
CREATE OR REPLACE FUNCTION enforce_restoration_execution_tenant()
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

  -- When an isolation point is referenced it must belong to the execution plan.
  IF NEW."isolation_point_id" IS NOT NULL THEN
    SELECT "plan_id" INTO point_plan_id
    FROM "isolation_points"
    WHERE "id" = NEW."isolation_point_id";

    IF point_plan_id IS DISTINCT FROM execution_plan_id THEN
      RAISE EXCEPTION '% isolation_point_id must belong to the execution LOTOTO plan', TG_TABLE_NAME;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS equipment_restorations_scope_match ON "equipment_restorations";
CREATE TRIGGER equipment_restorations_scope_match
  BEFORE INSERT OR UPDATE ON "equipment_restorations"
  FOR EACH ROW EXECUTE FUNCTION enforce_restoration_execution_tenant();

DROP TRIGGER IF EXISTS restoration_verifications_scope_match ON "restoration_verifications";
CREATE TRIGGER restoration_verifications_scope_match
  BEFORE INSERT ON "restoration_verifications"
  FOR EACH ROW EXECUTE FUNCTION enforce_restoration_execution_tenant();

-- Lock removal must reference a lock belonging to the same execution + tenant.
CREATE OR REPLACE FUNCTION enforce_lock_removal_scope()
RETURNS trigger AS $$
DECLARE
  execution_tenant_id uuid;
  lock_execution_id uuid;
BEGIN
  SELECT "tenant_id" INTO execution_tenant_id
  FROM "isolation_execution"
  WHERE "id" = NEW."execution_id";

  IF execution_tenant_id IS DISTINCT FROM NEW."tenant_id" THEN
    RAISE EXCEPTION 'lock_removals tenant_id must match its isolation execution tenant';
  END IF;

  SELECT "execution_id" INTO lock_execution_id
  FROM "applied_locks"
  WHERE "id" = NEW."applied_lock_id";

  IF lock_execution_id IS DISTINCT FROM NEW."execution_id" THEN
    RAISE EXCEPTION 'lock_removals applied_lock_id must belong to the same isolation execution';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lock_removals_scope_match ON "lock_removals";
CREATE TRIGGER lock_removals_scope_match
  BEFORE INSERT ON "lock_removals"
  FOR EACH ROW EXECUTE FUNCTION enforce_lock_removal_scope();

CREATE OR REPLACE FUNCTION enforce_tag_removal_scope()
RETURNS trigger AS $$
DECLARE
  execution_tenant_id uuid;
  tag_execution_id uuid;
BEGIN
  SELECT "tenant_id" INTO execution_tenant_id
  FROM "isolation_execution"
  WHERE "id" = NEW."execution_id";

  IF execution_tenant_id IS DISTINCT FROM NEW."tenant_id" THEN
    RAISE EXCEPTION 'tag_removals tenant_id must match its isolation execution tenant';
  END IF;

  SELECT "execution_id" INTO tag_execution_id
  FROM "applied_tags"
  WHERE "id" = NEW."applied_tag_id";

  IF tag_execution_id IS DISTINCT FROM NEW."execution_id" THEN
    RAISE EXCEPTION 'tag_removals applied_tag_id must belong to the same isolation execution';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tag_removals_scope_match ON "tag_removals";
CREATE TRIGGER tag_removals_scope_match
  BEFORE INSERT ON "tag_removals"
  FOR EACH ROW EXECUTE FUNCTION enforce_tag_removal_scope();

-- lototo_history: if an execution is referenced, tenant must match it.
CREATE OR REPLACE FUNCTION enforce_lototo_history_tenant()
RETURNS trigger AS $$
DECLARE
  execution_tenant_id uuid;
BEGIN
  IF NEW."execution_id" IS NOT NULL THEN
    SELECT "tenant_id" INTO execution_tenant_id
    FROM "isolation_execution"
    WHERE "id" = NEW."execution_id";

    IF execution_tenant_id IS DISTINCT FROM NEW."tenant_id" THEN
      RAISE EXCEPTION 'lototo_history tenant_id must match its referenced execution tenant';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lototo_history_tenant_match ON "lototo_history";
CREATE TRIGGER lototo_history_tenant_match
  BEFORE INSERT ON "lototo_history"
  FOR EACH ROW EXECUTE FUNCTION enforce_lototo_history_tenant();

-- Immutability: removal, verification and history records may never be
-- updated or deleted (safety-critical audit / evidence).
CREATE OR REPLACE FUNCTION prevent_lock_removal_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'lock_removals records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lock_removals_immutable ON "lock_removals";
CREATE TRIGGER lock_removals_immutable
  BEFORE UPDATE OR DELETE ON "lock_removals"
  FOR EACH ROW EXECUTE FUNCTION prevent_lock_removal_mutation();

CREATE OR REPLACE FUNCTION prevent_tag_removal_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'tag_removals records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tag_removals_immutable ON "tag_removals";
CREATE TRIGGER tag_removals_immutable
  BEFORE UPDATE OR DELETE ON "tag_removals"
  FOR EACH ROW EXECUTE FUNCTION prevent_tag_removal_mutation();

CREATE OR REPLACE FUNCTION prevent_restoration_verification_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'restoration_verifications records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS restoration_verifications_immutable ON "restoration_verifications";
CREATE TRIGGER restoration_verifications_immutable
  BEFORE UPDATE OR DELETE ON "restoration_verifications"
  FOR EACH ROW EXECUTE FUNCTION prevent_restoration_verification_mutation();

CREATE OR REPLACE FUNCTION prevent_lototo_history_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'lototo_history records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lototo_history_immutable ON "lototo_history";
CREATE TRIGGER lototo_history_immutable
  BEFORE UPDATE OR DELETE ON "lototo_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_lototo_history_mutation();

-- equipment_restorations rows may transition status but their audit fields
-- (created_at/created_by) are immutable.
CREATE OR REPLACE FUNCTION prevent_equipment_restoration_audit_mutation()
RETURNS trigger AS $$
BEGIN
  IF NEW."created_at" IS DISTINCT FROM OLD."created_at"
     OR NEW."created_by" IS DISTINCT FROM OLD."created_by" THEN
    RAISE EXCEPTION 'equipment_restorations audit fields (created_at, created_by) are immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS equipment_restorations_audit_immutable ON "equipment_restorations";
CREATE TRIGGER equipment_restorations_audit_immutable
  BEFORE UPDATE ON "equipment_restorations"
  FOR EACH ROW EXECUTE FUNCTION prevent_equipment_restoration_audit_mutation();
