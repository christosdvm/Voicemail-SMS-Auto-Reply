# Security

## Reporting

Please do not open a public issue containing credentials, phone numbers, voicemail audio, transcripts, or customer information. For a suspected vulnerability, contact the repository maintainer privately through the contact method configured on the GitHub profile.

## Deployment hardening

- Keep the repository public only after scanning its history for secrets and personal data.
- Store API keys, sender IDs, OAuth bearer tokens, notification addresses, and test numbers in Apps Script Script Properties.
- Keep `SMS_DRY_RUN=true` until a complete dry-run review is finished.
- Use `TEST_RECIPIENT_LOCK_ENABLED=true` and a synthetic or owner-controlled `TEST_PHONE` for live tests.
- Use `runOwnerVoicemailLiveTest()` for a one-shot test; it requires explicit confirmation, zero triggers, and restores DRY RUN.
- Activate production only through `activateProductionAutomation()` with the one-shot `PRODUCTION_ACTIVATION_CONFIRMATION=ENABLE` property.
- Keep the default live send window enabled; it allows SMS only from 09:00 through 21:00 Europe/Athens unless deliberately reconfigured with `SMS_SEND_TIME_ZONE`.
- Set `ALLOWED_SENDER_EMAILS` when the telephony provider has a stable sender address. The Modulus preset sets an exact `no-reply@modulus.gr` allowlist.
- Keep `MAX_SMS_SEGMENTS=1` unless multi-part billing and delivery have been explicitly reviewed.
- Restrict the call-tracking web app to the owner or an approved private audience.
- Do not expose the Apps Script web app as anonymous when it can access Gmail or call tracking.
- Use a dedicated Google account/project where possible and review Apps Script executions and OAuth grants.
- Rotate provider credentials after accidental exposure and remove the exposed value from repository history.
- Configure Gmail retention and access controls separately; this project does not delete source emails.

## Threat model notes

The code treats inbound email as untrusted input, optionally allowlists exact sender addresses, escapes notification HTML, masks phone numbers in notifications, sanitizes diagnostic errors, signs call actions with HMAC, validates call-tracking URLs, keeps tokens in URL fragments, and reserves a caller cooldown before a live provider request. It avoids automatic retry when provider delivery is uncertain. The system does not provide end-to-end encryption for Gmail, provider APIs, or internal email; use the security controls of those services.
