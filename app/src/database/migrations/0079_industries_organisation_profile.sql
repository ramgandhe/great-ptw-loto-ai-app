CREATE TABLE "industries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "name" varchar(128) NOT NULL,
  "is_fallback" boolean DEFAULT false NOT NULL
);

CREATE UNIQUE INDEX "industries_name_unique" ON "industries" (lower("name"));
CREATE UNIQUE INDEX "industries_fallback_unique" ON "industries" ("is_fallback") WHERE "is_fallback";

INSERT INTO "industries" ("name", "is_fallback") VALUES
  ('Construction & Infrastructure', false),
  ('Manufacturing & Industrial Plants', false),
  ('Shipyards & Marine', false),
  ('Oil, Gas & Chemical', false),
  ('Pharmaceuticals & Life Sciences', false),
  ('Data Centers & Logistics', false),
  ('Facilities Management', false),
  ('Energy & Utilities', false),
  ('Mining & Metals', false),
  ('Aviation & Airports', false),
  ('Rail & Transport Infrastructure', false),
  ('Others', true);

ALTER TABLE "organisations" ADD COLUMN "about" text;
ALTER TABLE "organisations" ADD COLUMN "industry_id" uuid;
ALTER TABLE "organisations" ADD COLUMN "address_line1" varchar(255);
ALTER TABLE "organisations" ADD COLUMN "address_line2" varchar(255);
ALTER TABLE "organisations" ADD COLUMN "address_state" varchar(128);
ALTER TABLE "organisations" ADD COLUMN "address_country" varchar(128);
ALTER TABLE "organisations" ADD COLUMN "address_pin" varchar(32);

UPDATE "organisations"
SET "industry_id" = (SELECT "id" FROM "industries" WHERE "is_fallback" = true)
WHERE "industry_id" IS NULL;

ALTER TABLE "organisations" ALTER COLUMN "industry_id" SET NOT NULL;
ALTER TABLE "organisations"
  ADD CONSTRAINT "organisations_industry_id_industries_id_fk"
  FOREIGN KEY ("industry_id") REFERENCES "industries"("id");
