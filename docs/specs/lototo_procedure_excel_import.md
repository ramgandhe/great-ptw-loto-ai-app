# LOTOTO procedure Excel import

Spec workbook (review layout): `docs/specs/lototo_procedure_template.xlsx`

## Runtime behaviour

- **Download:** `GET /api/v1/lototo/procedures/import/template`  
  Filename: `permitwiseai_{tenant-slug}_lototo_procedure_template.xlsx`.  
  Builds a tenant-specific `.xlsx` with a hidden `Reference` sheet (assets by tag, work locations by code, energy/methods/proofs/phases). Header links use **Asset** and/or **WorkLocation** only (no Machinery or Workstation fields).
- **Upload:** `POST /api/v1/lototo/procedures/import` (multipart `file`, optional `confirmOverride=true`)
- **Roles:** `tenant-admin`, `tenant-owner`, `platform-admin`
- **Result:** always a **draft** procedure (create or replace draft). Publish remains a separate UI step.
- **Existing code:** without `confirmOverride` → `409 PROCEDURE_IMPORT_OVERRIDE_REQUIRED`. With confirm → replace current draft in place; if published with no draft, create a revision draft first (published snapshot unchanged).
- **Validation:** fail-fast with full error list (`sheet` / `row` / `field` / `message`). Missing master-data codes fail the upload.
- **UI:** download on `/lototo/procedures`; upload on `/lototo/procedures/new`.

## Procedure editor alignment

The procedure editor exposes the same narrative and sequence fields the Excel import writes (`facility`, `locationText`, `purpose`, `scope`, `authorization`, `enforcement`, `description`, `note`, lockout points including `verificationMethod`, and apply/remove sequence steps). Imported drafts can be reviewed and edited there before publish.

## Out of scope (v1)

- Procedure info image import via Excel  
- AuthorizedRoles sheet  
- Job evidence photos / certificates / locks  
- Auto-publish  
