ALTER TABLE "permit_lototo_instances" ADD COLUMN "certificate_id" uuid;
--> statement-breakpoint
ALTER TABLE "permit_lototo_instances" ADD CONSTRAINT "permit_lototo_instances_certificate_id_isolation_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "isolation_certificates"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "permit_lototo_instances_certificate_id_idx" ON "permit_lototo_instances" ("certificate_id");
