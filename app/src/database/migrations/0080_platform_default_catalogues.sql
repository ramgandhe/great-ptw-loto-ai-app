CREATE TABLE "default_location_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "name" varchar(64) NOT NULL,
  "description" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "default_location_types_name_unique" ON "default_location_types" (lower("name"));
--> statement-breakpoint
CREATE TABLE "default_ppe_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "name" varchar(128) NOT NULL,
  "is_fallback" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "default_ppe_categories_name_unique" ON "default_ppe_categories" (lower("name"));
--> statement-breakpoint
CREATE UNIQUE INDEX "default_ppe_categories_fallback_unique" ON "default_ppe_categories" ("is_fallback") WHERE "is_fallback" = true;
--> statement-breakpoint
CREATE TABLE "default_ppe_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "code" varchar(64) NOT NULL,
  "name" varchar(255) NOT NULL,
  "category_id" uuid NOT NULL,
  "description" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "default_ppe_items_code_unique" ON "default_ppe_items" (lower("code"));
--> statement-breakpoint
CREATE INDEX "default_ppe_items_category_id_idx" ON "default_ppe_items" ("category_id");
--> statement-breakpoint
ALTER TABLE "default_ppe_items" ADD CONSTRAINT "default_ppe_items_category_id_default_ppe_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "default_ppe_categories"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "default_permit_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "code" varchar(64) NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "color" varchar(7) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "default_permit_types_code_unique" ON "default_permit_types" (lower("code"));
--> statement-breakpoint
INSERT INTO "default_location_types" ("name") VALUES
  ('Plant'),
  ('Building'),
  ('Unit'),
  ('Area'),
  ('Zone'),
  ('Workplace'),
  ('Room'),
  ('Workshop'),
  ('Warehouse'),
  ('Tank Farm');
--> statement-breakpoint
INSERT INTO "default_ppe_categories" ("name", "is_fallback") VALUES
  ('Head Protection', false),
  ('Eye Protection', false),
  ('Face Protection', false),
  ('Hearing Protection', false),
  ('Respiratory Protection', false),
  ('Hand Protection', false),
  ('Foot Protection', false),
  ('Body Protection', false),
  ('Fall Protection', false),
  ('Welding Protection', false),
  ('Electrical Protection', false),
  ('Others', true);
--> statement-breakpoint
INSERT INTO "default_ppe_items" ("code", "name", "category_id", "description")
SELECT v.code, v.name, c.id, v.description
FROM (VALUES
  ('PPE-01', 'Safety Helmet', 'Head Protection', 'Protects the head against falling objects, impacts, and workplace hazards.'),
  ('PPE-02', 'Safety Goggles', 'Eye Protection', 'Protects eyes from dust, flying particles, and other workplace hazards.'),
  ('PPE-03', 'Face Shield', 'Face Protection', 'Protects the face from splashes, sparks, and flying debris.'),
  ('PPE-04', 'Safety Glasses', 'Eye Protection', 'Provides eye protection against impact and airborne particles.'),
  ('PPE-05', 'Ear Plugs', 'Hearing Protection', 'Reduces exposure to excessive workplace noise.'),
  ('PPE-06', 'Ear Muffs', 'Hearing Protection', 'Provides hearing protection in high-noise environments.'),
  ('PPE-07', 'Dust Mask', 'Respiratory Protection', 'Helps protect against dust and non-hazardous airborne particles, depending on the mask rating.'),
  ('PPE-08', 'Respirator', 'Respiratory Protection', 'Protects against specified airborne contaminants when appropriately selected and fitted.'),
  ('PPE-09', 'Safety Gloves', 'Hand Protection', 'Protects hands against general workplace hazards and abrasion.'),
  ('PPE-10', 'Chemical-Resistant Gloves', 'Hand Protection', 'Protects hands from specified chemicals based on glove material compatibility.'),
  ('PPE-11', 'Cut-Resistant Gloves', 'Hand Protection', 'Helps prevent cuts and lacerations when handling sharp materials.'),
  ('PPE-12', 'Safety Shoes', 'Foot Protection', 'Protects feet against impact, compression, and other specified workplace hazards.'),
  ('PPE-13', 'Safety Gumboots', 'Foot Protection', 'Provides foot protection in wet, muddy, or contaminated environments.'),
  ('PPE-14', 'High-Visibility Vest', 'Body Protection', 'Improves worker visibility in traffic, construction, and industrial areas.'),
  ('PPE-15', 'Coverall', 'Body Protection', 'Provides protective clothing against workplace dirt, abrasion, and specified hazards.'),
  ('PPE-16', 'Chemical-Resistant Apron', 'Body Protection', 'Protects the torso and clothing against specified chemical splashes.'),
  ('PPE-17', 'Welding Helmet', 'Welding Protection', 'Protects the face and eyes from welding radiation, sparks, and spatter.'),
  ('PPE-18', 'Welding Gloves', 'Hand Protection', 'Protects hands from welding heat, sparks, and spatter.'),
  ('PPE-19', 'Safety Harness', 'Fall Protection', 'Provides a body support system for approved fall-arrest applications.'),
  ('PPE-20', 'Fall-Arrest Lanyard', 'Fall Protection', 'Connects a compatible full-body harness to an approved anchorage or fall-arrest system.'),
  ('PPE-21', 'Knee Pads', 'Body Protection', 'Cushions and protects knees during kneeling tasks.'),
  ('PPE-22', 'Chemical Splash Goggles', 'Eye Protection', 'Protects eyes against specified liquid chemical splashes.'),
  ('PPE-23', 'Heat-Resistant Gloves', 'Hand Protection', 'Protects hands when handling hot materials or working in high-temperature environments.'),
  ('PPE-24', 'Electrical Insulating Gloves', 'Electrical Protection', 'Provides electrical insulation for approved tasks within the gloves'' rated voltage and usage conditions.'),
  ('PPE-25', 'Disposable Protective Coverall', 'Body Protection', 'Provides disposable protection against specified dust, particles, or contaminants.'),
  ('PPE-26', 'Welding Safety Shoes', 'Foot Protection', 'Provides foot protection in welding environments, including specified heat and spatter hazards.'),
  ('PPE-27', 'Chemical-Resistant Boots', 'Foot Protection', 'Protects feet against specified chemical exposure and liquid penetration.'),
  ('PPE-28', 'Chin Strap', 'Head Protection', 'Helps secure a compatible safety helmet during movement or work at height.'),
  ('PPE-29', 'Arc-Flash Protective Suit', 'Electrical Protection', 'Provides protection against thermal hazards from electrical arc-flash incidents when appropriately rated.'),
  ('PPE-30', 'Personal Protective Clothing', 'Body Protection', 'Provides general protective clothing selected according to identified workplace hazards.')
) AS v(code, name, category_name, description)
JOIN "default_ppe_categories" c ON c.name = v.category_name;
--> statement-breakpoint
INSERT INTO "default_permit_types" ("code", "name", "description", "color") VALUES
  ('HOT', 'Hot Work Permit', 'Authorizes work that generates flames, sparks, heat, or other ignition sources in areas where fire or explosion hazards may exist. Examples: Welding, gas cutting, grinding, brazing, and other ignition-producing activities.', '#DC2626'),
  ('COLD', 'Cold Work Permit', 'Authorizes non-hot-work activities following hazard assessment and implementation of applicable safety precautions, operational controls, and required isolations. Examples: Routine mechanical maintenance, manual repairs, equipment inspection, and non-sparking maintenance activities.', '#16A34A'),
  ('CSP', 'Confined Space Permit', 'Controls entry into designated confined spaces where atmospheric, engulfment, access, or other serious hazards may exist. Examples: Tank entry, vessel inspection, and entry into designated pits or enclosed spaces.', '#7C3AED'),
  ('ELEC', 'Electrical Permit', 'Controls electrical work involving hazards such as electric shock, arc flash, stored energy, and unexpected energization. Examples: Electrical maintenance, panel work, cable repair, and work on electrical equipment.', '#2563EB'),
  ('WAH', 'Work at Height Permit', 'Controls work at elevated locations where a person could fall and suffer injury, according to the site''s permit requirements. Examples: Roof maintenance, elevated structural repairs, and work on scaffolds or elevated platforms.', '#D97706'),
  ('EXC', 'Excavation Permit', 'Controls ground disturbance and excavation activities where buried services, ground instability, hazardous atmospheres, or other site hazards may exist. Examples: Trenching, foundation excavation, ground breaking, and underground utility investigation.', '#92400E');
