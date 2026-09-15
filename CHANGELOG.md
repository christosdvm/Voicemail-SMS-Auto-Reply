# Changelog

## [Unreleased]

## [1.4.0] - 2026-09-15

### Added

- Ordered source modules under `src/` and a deterministic build that produces the
  deployable `Code.gs` bundle.
- A credential-free simulator for voicemail, missed-call, and duplicate scenarios.
- A public-safety scanner for secrets, private configuration, and voicemail media.
- A repository consistency check for local documentation links and JSON files.
- Configuration, operations, and architecture-decision documentation.
- A synthetic example of the required Apps Script properties.

### Changed

- Made the public configuration provider-neutral: generic webhook, UTC, no assumed
  country code, and internal notifications disabled by default.
- Reworked caller extraction to support excluded phone numbers and a configurable
  preference pattern instead of embedding provider-specific assumptions.
- Made the generic inbound preset clear provider-specific country normalization as
  well as sender and caller-selection rules.
- Replaced domain-specific operator messages and priority keywords with reusable
  English defaults.
- Expanded CI validation across Node.js 20, 22, and 24.
- Reframed the README, case study, and roadmap around explicit engineering decisions,
  operational boundaries, and a reusable communications policy engine.

### Security

- Added regression coverage for excluded service numbers so they cannot be mistaken
  for callers.
- Added a repository-wide safety check that fails when likely credentials, private
  Apps Script metadata, or voicemail media are committed.
- Provider endpoints now fail closed unless they use HTTPS, and stored provider
  message references are hashed.

## [1.3.1] - 2026-09-15

### Changed

- Refined the tagline to state directly that Gmail notifications trigger an SMS reply to the caller.
- Replaced the shorter diagram label with **SMS reply to the caller** for clearer standalone meaning.
- Updated the anonymized demo and package description to use the same caller-focused wording.

## [1.3.0] - 2026-09-15

### Changed

- Renamed the project from **Voicemail-to-SMS Automation** to **Voicemail SMS Auto-Reply** to make the outcome unambiguous.
- Rewrote the project summary and architecture labels to clarify that the automation replies to the original caller after a voicemail or missed-call notification.
- Added an explicit clarification that voicemail audio is not converted into the caller-facing SMS and transcripts never determine its content.
- Redesigned the anonymized demo so the final stage visibly shows the SMS auto-reply reaching the caller.
- Renamed the default Gmail label from `voicemail-to-sms` to `voicemail-sms-auto-reply`. Existing deployments can retain their previous label by keeping a custom `GMAIL_QUERY` Script Property.

## [1.2.0] - 2026-09-15

### Added

- Incorporated the latest application revision while keeping the public build provider-neutral and free of clinic-specific identifiers.
- Added a configurable `SMS_SEND_TIME_ZONE` property; the default remains `Europe/Athens`.
- Added regression coverage for diagnostic redaction and exact Modulus sender matching.

### Privacy-preserving changes

- Replaced private SMS wording, personal names, phone numbers, notification addresses, and sender IDs with configurable or synthetic examples.
- Kept transcription disabled by default in the public repository, even though a private deployment may opt in through Script Properties.

## [1.1.0] - 2026-09-09

### Added

- Configurable live-only SMS send window, defaulting to 09:00–21:00 Europe/Athens.
- Separate production activation, manual live-run, and one-shot owner live-test confirmations.
- Exact inbound sender allowlisting with a provider-neutral empty default and Modulus compatibility preset.
- Modulus endpoint and sender-ID validation plus configurable SMS segment limits and GSM extension-character counting.
- Pre-send caller reservations to suppress duplicate sends after ambiguous provider failures.
- Explicit state cleanup command, daily cleanup guard, bounded retention, diagnostic redaction, notification email validation, and transcript truncation.
- Additional offline tests for the new safety and privacy controls.

### Changed

- Internal notification failures are isolated from SMS processing and no longer turn an accepted SMS into a retry risk.
- Stored message state now uses a message-ID hash instead of the raw Gmail message ID.
- The public README and provider documentation now describe the latest activation and privacy workflow.

## [1.0.0] - 2026-09-09

### Added

- Provider-neutral Gmail subject patterns, queries, caller labels, and country-code configuration.
- E.164 extraction for international and local caller numbers.
- SMS adapters for Modulus, Twilio, Vonage, Telnyx, and generic JSON webhooks.
- Optional bearer-token authentication for generic SMS webhooks.
- Dry-run mode, explicit one-recipient live testing, cooldown deduplication, missed-call suppression, and uncertain-send protection.
- Privacy controls for transcription, transcript inclusion, masked notifications, hashed state, and state retention.
- Explicit Apps Script OAuth scopes and UTC manifest configuration.
- English README, architecture diagram, anonymized demo illustration, fixtures, offline tests, security guidance, and privacy notes.

### Compatibility

- Modulus remains available through `configureModulusEmailPreset()` and `testModulusSms()`.
- Modulus is an optional provider adapter, not a project dependency.
