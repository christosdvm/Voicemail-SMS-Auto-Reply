# Privacy notes

Voicemail and caller numbers can be personal data. Audio and transcripts may contain sensitive information. Deploy this project only after reviewing the requirements that apply to your organization and jurisdiction.

## Data flow

1. Gmail receives a telephony notification and optional audio attachment.
2. Apps Script reads matching messages and extracts a normalized caller number.
3. The selected SMS adapter receives the destination and fixed acknowledgement text when dry-run is disabled.
4. Audio is sent to the configured transcription service only when both `TRANSCRIPTION_ENABLED=true` and `INTERNAL_NOTIFICATION_INCLUDE_TRANSCRIPT=true`.
5. Internal notifications show a masked number and include transcript text only when explicitly enabled.
6. Script Properties retain hashed message/phone keys, statuses, timestamps, and masked numbers. Expired state is purged automatically; the default retention is 35 days.

## Minimization defaults

- no notification email is selected automatically;
- no transcription by default;
- no transcript in internal email by default;
- no transcript in the client SMS;
- no raw phone number in operational state or internal notification display;
- diagnostic errors are sanitized to remove common API-key, email, and phone patterns;
- notifications require an explicit `NOTIFICATION_EMAIL` and transcript inclusion is separately opt-in;
- live SMS is constrained by a configurable IANA-time-zone send window and a configurable segment limit;
- no customer database is created by the script;
- fixed wording prevents an AI model from generating clinical advice.

You are still responsible for Gmail retention, access permissions, provider retention, transcription processor settings, and deletion requests.
