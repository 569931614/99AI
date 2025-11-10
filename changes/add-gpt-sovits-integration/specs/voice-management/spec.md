## ADDED Requirements
### Requirement: GPT-SoVITS Voice Import
The platform SHALL let authenticated admins register GPT-SoVITS voices by uploading GPT/SOVITS checkpoints plus prompt metadata so they appear in the existing voice catalogue.

#### Scenario: Admin uploads checkpoints successfully
- **GIVEN** the admin provides name, text/prompt languages, checkpoint files, and a reference audio clip
- **WHEN** the request is submitted to `/voice/gpt-sovits/import`
- **THEN** the service stores the files under the configured GPT-SoVITS storage root, persists `provider = gpt-sovits` with the config payload, and the new voice appears in `/voice/list` with status `SUCCEEDED`.

#### Scenario: Upload validation fails
- **GIVEN** an admin omits one of the required files
- **WHEN** the import endpoint is called
- **THEN** the API responds with `400` explaining the missing artifact and no files/config are written.

### Requirement: GPT-SoVITS Synthesis
The platform SHALL synthesize speech via the configured GPT-SoVITS API whenever a voice entry marked `gpt-sovits` is used for previews or realtime calls.

#### Scenario: Preview generates audio URL
- **GIVEN** a GPT-SoVITS voice with stored model paths and prompt metadata
- **WHEN** `/voice/preview` is invoked with that `voice_id` and text
- **THEN** the service loads the proper model via `/set_model`, streams audio from the GPT-SoVITS server, uploads the result to storage, and returns `{ url, duration }` to the caller.

#### Scenario: Voice call streams GPT-SoVITS audio
- **GIVEN** a realtime voice session selects a GPT-SoVITS `voice_id`
- **WHEN** `ttsStream` is executed for conversation turns
- **THEN** the service forwards chunks from the GPT-SoVITS streaming response through the existing callbacks without blocking the session loop.
