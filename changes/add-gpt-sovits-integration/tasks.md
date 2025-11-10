## 1. Backend - GPT-SoVITS Provider
- [x] 1.1 Extend voice persistence (entity + migration) with provider/config fields and helpers.
- [x] 1.2 Implement GPT-SoVITS import endpoint (file handling, config validation, storage) with JWT protection.
- [x] 1.3 Integrate GPT-SoVITS inference (preview, ttsStream, query/delete/list) using configurable base URL + streaming support.
- [x] 1.4 Expose provider info + config summaries via existing voice APIs.

## 2. Admin Frontend
- [x] 2.1 Add API client helpers for GPT-SoVITS import and surface provider metadata on list rows.
- [x] 2.2 Build a "GPT-SoVITS model import" form (uploads, validation, submission) and wire it to the backend.
- [x] 2.3 Update preview/test UIs to handle provider-specific options (text language, format hints) and show provider badges.

## 3. Ops & Validation
- [x] 3.1 Document new env/config knobs in `.env.example` and ensure migrations/scripts cover schema changes.
- [x] 3.2 Smoke-test flows (import, preview, delete) via existing dev scripts or manual API calls; update TODOs/checklist when verified.
