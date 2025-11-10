## Context
Voice management currently stores CosyVoice references and talks to DashScope only. GPT-SoVITS voices come as pairs of GPT/SoVITS checkpoints plus prompt audio metadata, and inference happens through the FastAPI server shipped with GPT-SoVITS-V2. We must onboard these models, keep their artefacts on disk, and drive synthesis through the HTTP streaming API while keeping the rest of the platform (admin UI, realtime voice call) unchanged.

## Goals / Non-Goals
- **Goals**: persist provider-aware voice entries, upload/store GPT-SoVITS assets, configure inference parameters, and deliver audio for previews/realtime flows.
- **Non-Goals**: building GPT-SoVITS training pipelines, multi-tenant scheduling, or replacing DashScope flows.

## Decisions
1. **Schema**: add `provider` (`dashscope` | `gpt-sovits`) and `config` (JSON) columns on `voice`. Config keeps GPT/SoVITS absolute paths, prompt metadata, and tuning params.
2. **File storage**: write uploaded checkpoints/audio to `${GPT_SOVITS_STORAGE_ROOT}/<voiceId>/` on the service host (default `storage/gpt-sovits`). UploadService remains for cloud assets, but GPT-SoVITS needs filesystem paths for `/set_model` so we keep a local copy.
3. **Inference client**: implement helper inside `VoiceService` that (a) ensures `/set_model` is called when config changes, (b) POSTs to `/` with prompt/text payload, and (c) streams the binary response chunk-by-chunk to existing callbacks. Axios streams cover both preview uploads (buffering) and realtime voice-call streaming (chunk forwarding).
4. **Admin UX**: add a dedicated import card that accepts metadata + files (using `FileFieldsInterceptor` on the backend). Voice tables show provider badges so admins know which flows are local vs DashScope.
5. **Configuration**: introduce `GPT_SOVITS_BASE_URL`, `GPT_SOVITS_STORAGE_ROOT`, and `GPT_SOVITS_DEFAULT_TEXT_LANGUAGE` env knobs with sane defaults; no DB-managed configs initially.

## Risks / Trade-offs
- **Large uploads**: checkpoint files can be hundreds of MB; raising upload limits and writing to disk may impact storage quotas. Mitigation: scope uploads to the new endpoint with explicit size caps and clear error messaging.
- **Model reload latency**: `/set_model` can take seconds. We cache the last loaded model per voiceId in-memory and only reload when paths change, but multi-instance deployments would need shared coordination (out of scope now).
- **Local path security**: storing absolute paths in DB requires sanitization. We restrict writes to the configured storage root and only accept known extensions.
- **Streaming reliability**: GPT-SoVITS HTTP streaming is not chunk-size bounded; we must guard against stalls/timeouts and bubble errors up to voice-call sessions.

## Migration Plan
1. Ship SQL migration to add columns + indexes.
2. Deploy code + run migration (or rely on auto-migrate in dev).
3. Configure env variables (`GPT_SOVITS_*`).
4. Import first GPT-SoVITS model via admin UI.
5. Verify preview + voice-call flows; roll back by deleting new voices if needed.

## Open Questions
- Do we need to expose per-voice config editing in this iteration (currently import-only)?
- Should GPT-SoVITS prompt audio also be published through UploadService for CDN delivery, or is on-disk storage sufficient?
