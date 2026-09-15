# ADR-001: Deterministic caller-facing messages

**Status:** Accepted

## Context

Voicemail audio and transcripts are untrusted, potentially sensitive inputs. A generated or transcript-dependent reply would make content harder to review and could expose information the caller did not intend to receive by SMS.

## Decision

The caller receives only administrator-configured acknowledgement text. Transcription is an optional internal workflow and has no path into `buildClientSms_()`.

## Consequences

- Outbound content is predictable and can be approved before activation.
- Tests can prove that different transcripts produce identical caller messages.
- The workflow cannot answer caller questions or personalize content from voicemail.
- A future conversational agent belongs in a separate product with its own consent, safety, and audit model.
