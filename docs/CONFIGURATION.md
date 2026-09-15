# Configuration reference

All runtime configuration belongs in Apps Script **Project Settings → Script Properties**. Values in this repository are synthetic examples, not production configuration.

Run `initializeWithoutSending()` before setting custom values. Initialization adds missing properties but does not overwrite existing ones, then forces automation off and dry run on.

Create the Gmail label referenced by `GMAIL_QUERY` (or replace the query with one
that matches your routing rules) before the first dry run. A label is not created by
the script because mailbox routing should remain an explicit operator decision.

## Inbound email

| Property | Safe default | Notes |
| --- | --- | --- |
| `GMAIL_QUERY` | `label:voicemail-sms-auto-reply ...` | Keep the query narrow. A dedicated Gmail label is easier to audit than a broad inbox search. |
| `VOICEMAIL_SUBJECT_PATTERN` | Common English and Greek voicemail terms | JavaScript regular expression, case-insensitive. |
| `MISSED_CALL_SUBJECT_PATTERN` | Common English and Greek missed-call terms | Replies and forwarded subjects are rejected. |
| `ALLOWED_SENDER_EMAILS` | empty | Optional exact allowlist separated by `|` or `,`. |
| `CALLER_NUMBER_LABELS` | Common caller labels | Ordered labels separated by `|`. |
| `DEFAULT_COUNTRY_CODE` | empty | One to three digits, without `+`. Required only for local-format numbers. |
| `EXCLUDED_PHONE_NUMBERS` | empty | Known destination or office numbers to reject, separated by `|` or `,`. |
| `CALLER_NUMBER_PREFERENCE_PATTERN` | empty | Optional regular expression applied to normalized E.164 candidates. |

Caller extraction uses this order:

1. A number following a configured body label.
2. Other candidates in the message body.
3. Attachment filenames.
4. The sender field.

Excluded numbers are removed before selection. When several candidates remain, the preference pattern is tried and then deterministic source order is used. The script does not guess which number is the caller.

## Delivery policy

| Property | Default | Purpose |
| --- | --- | --- |
| `SMS_DRY_RUN` | `true` | Evaluate and record decisions without provider delivery. |
| `AUTOMATION_ENABLED` | `false` | Master switch checked by the scheduled entry point. |
| `MISSED_CALLS_ENABLED` | `true` | Process missed-call notifications as well as voicemail. |
| `MISSED_CALL_DELAY_MINUTES` | `15` | Wait for a related voicemail before replying to a missed call. |
| `PHONE_REPLY_COOLDOWN_HOURS` | `24` | Suppress another acknowledgement to the same caller. |
| `SMS_SEND_WINDOW_ENABLED` | `true` | Restrict live delivery to a local time window. |
| `SMS_SEND_START_HOUR` | `9` | Inclusive local start hour. |
| `SMS_SEND_END_HOUR` | `21` | Exclusive local end hour. |
| `SMS_SEND_TIME_ZONE` | `Etc/UTC` | IANA time-zone identifier. Set this explicitly for production. |
| `MAX_SMS_SEGMENTS` | `1` | Block text that exceeds the reviewed SMS cost/length boundary. |
| `SMS_ENCODING` | `gsm` | `gsm` or `ucs2`. |
| `MAX_MESSAGES_PER_RUN` | `10` | Bounded work per trigger execution; maximum 20. |

## SMS adapters

Set `SMS_PROVIDER` to `webhook`, `twilio`, `vonage`, `telnyx`, or `modulus`.

| Adapter | Required properties |
| --- | --- |
| Generic webhook | `GENERIC_SMS_API_URL` |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM` or `TWILIO_MESSAGING_SERVICE_SID` |
| Vonage | `VONAGE_API_KEY`, `VONAGE_API_SECRET`, `VONAGE_FROM` |
| Telnyx | `TELNYX_API_KEY`, `TELNYX_FROM` |
| Modulus | `MODULUS_API_KEY`, `SMS_SENDER_ID` |

Optional endpoint overrides exist for compatible testing environments. Do not redirect provider credentials to an endpoint you do not control and trust. The Modulus adapter intentionally permits only its known HTTPS endpoint.

The generic webhook body is documented in [provider-adapters.md](provider-adapters.md).

## Internal workflow

| Property | Default | Purpose |
| --- | --- | --- |
| `SEND_INTERNAL_NOTIFICATION` | `false` | Send a redacted internal status email. |
| `NOTIFICATION_EMAIL` | empty | Explicit destination for internal email. |
| `TRANSCRIPTION_ENABLED` | `false` | Allow audio to leave Google for transcription. |
| `INTERNAL_NOTIFICATION_INCLUDE_TRANSCRIPT` | `false` | Include transcript text in internal email. |
| `OPENAI_TRANSCRIPTION_MODEL` | `gpt-transcribe` | Model used only when transcription is enabled. |
| `URGENCY_KEYWORDS` | Generic priority terms | Optional internal routing hint; never changes the caller SMS. |
| `CALL_TRACKING_ENABLED` | `false` | Enable signed private callback-status actions. |
| `CALL_TRACKING_WEB_APP_URL` | empty | Approved private Apps Script `/exec` URL. |

Transcription requires both `TRANSCRIPTION_ENABLED=true` and `INTERNAL_NOTIFICATION_INCLUDE_TRANSCRIPT=true`. The caller-facing SMS remains fixed either way.

## Testing and activation

| Property | Meaning |
| --- | --- |
| `TEST_RECIPIENT_LOCK_ENABLED` | When true, live SMS can reach only `TEST_PHONE`. |
| `TEST_PHONE` | Owner-controlled test recipient. Never commit it. |
| `LIVE_TEST_CONFIRMATION=YES` | One-shot confirmation consumed by the owner live-test function. |
| `MANUAL_LIVE_CONFIRMATION=YES` | One-shot confirmation consumed by a manual live run. |
| `PRODUCTION_ACTIVATION_CONFIRMATION=ENABLE` | One-shot confirmation consumed by production activation. |

Use [`config/example-script-properties.json`](../config/example-script-properties.json) as a review checklist, not as a file to commit after adding real values.

## Provider presets

`configureGenericEmailSource()` restores provider-neutral inbound defaults.

`configureModulusEmailPreset()` configures Modulus email subjects, its exact sender allowlist, Greek local-number normalization, and a Greek mobile-number preference. It does not select the outbound SMS provider or add credentials.
