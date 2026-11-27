# LOTOTO procedure PDF import

## Behaviour

- Separate **Upload PDF** on `/lototo/procedures/new` (Excel import unchanged).
- Roles: `tenant-admin`, `tenant-owner`, `platform-admin`.
- Always creates or replaces a **draft**. Publish stays a separate step.
- Async job (BullMQ). UI stages: Uploading, Extracting document, Interpreting procedures, Creating draft, Done / Failed.
- Existing procedure code without confirm pauses the job (`awaiting_override`). Confirm resumes the **same** job (no second model call). Cancel deletes the temp PDF immediately.
- Abandoned jobs expire after 24 hours and their temp objects are deleted.
- Source PDF is discarded after success, failure cleanup, cancel, or expiry. It is not stored on the procedure.
- Missing asset / work location: draft is created with empty links and warnings.
- Invalid enums from the model are cleared (or mapped to `other` for energy) with warnings.
- A missing field does not stop the draft. The draft keeps what the PDF contained, and a warning names each blank the user should fill. A PDF with no code or title still opens a draft so the user can enter them.
- Images: a cropped photo includes arrows drawn on it. It is attached to the lockout point on the same page whose label is closest to the photo. A picture that covers the page, and logos or icons, are not stored. A photo that is not beside a lockout point stays unassigned. Photos are not attached to sequence steps.
- Model is configured by env. v1 default: `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`. The extraction module is the only caller.

## API

- `POST /api/v1/lototo/procedures/import/pdf` — multipart `file` (PDF, max 20 MB). `202 { jobId }`.
- `GET /api/v1/lototo/procedures/import/pdf/jobs/:jobId`
- `POST /api/v1/lototo/procedures/import/pdf/jobs/:jobId/confirm-override`
- `POST /api/v1/lototo/procedures/import/pdf/jobs/:jobId/cancel`

## Env

- `LOTOTO_PDF_LLM_BASE_URL` (default `https://integrate.api.nvidia.com/v1`)
- `LOTOTO_PDF_LLM_API_KEY` or `NVIDIA_API_KEY`
- `LOTOTO_PDF_LLM_MODEL` (default `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`)
- `LOTOTO_PDF_IMPORT_MAX_BYTES` (default 20971520)
- `LOTOTO_PDF_LLM_TIMEOUT_MS` (default 120000)
- `LOTOTO_PDF_IMPORT_TTL_HOURS` (default 24)
