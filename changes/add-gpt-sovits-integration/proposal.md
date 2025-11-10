# Change Proposal: add-gpt-sovits-integration

## Why
- Current voice management only targets DashScope/CosyVoice voices and cannot use GPT-SoVITS-V2 for text-to-speech despite requests for locally trained voices.
- Admins need a way to upload their GPT-SoVITS checkpoints (GPT + SoVITS weights plus prompt audio metadata) so that they can be selected like any other voice.
- Real-time agents (voice calls, previews, open APIs) must be able to synthesize speech with the uploaded voices without manual intervention.

## What Changes
- Add a `gpt-sovits` provider type to the voice domain, including persistence for provider-specific configuration, uploaded artifacts, and lifecycle (create, list, delete).
- Introduce backend integration with a configurable GPT-SoVITS-V2 inference API (HTTP streaming) so previews, voice calls, and open APIs can request speech using the stored config.
- Extend 99AI admin voice management pages with a "GPT-SoVITS model import" workflow (form + uploads + progress) and surface provider information in lists/actions.

## Impact
- **Data**: `voice` table gains provider/config columns plus a migration; large model files stored on the application host under a configurable root.
- **APIs**: new authenticated endpoints for GPT-SoVITS imports; existing preview/detail/list endpoints become provider-aware.
- **Frontend**: new UI card + API clients for uploading GPT-SoVITS assets and highlighting provider in voice grids.
- **Operations**: requires configuring `GPT_SOVITS_BASE_URL` (+ optional storage overrides). Existing DashScope flows remain unchanged.

## Acceptance Criteria
- Admin can upload GPT (*.ckpt) + SoVITS (*.pth) + reference audio, provide prompt/text metadata, and see the resulting voice row marked as `gpt-sovits`.
- Calling `/voice/preview` (via admin UI test dialog) and realtime voice services with that voice returns synthesized audio from the configured GPT-SoVITS server.
- Voice delete/list/detail flows work for both providers, and migrations succeed on clean databases.
