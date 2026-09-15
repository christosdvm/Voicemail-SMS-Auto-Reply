# Provider adapters

The runtime chooses an adapter using `SMS_PROVIDER`; the neutral public default is `webhook`. Credentials belong in Apps Script Script Properties and are intentionally absent from this repository.

## Modulus

Use `SMS_PROVIDER=modulus` with `MODULUS_API_KEY` and `SMS_SENDER_ID`. The adapter accepts only the approved HTTPS endpoint and validates the sender ID and SMS segment limit before sending. `configureModulusEmailPreset()` configures the known Modulus email subjects, caller label, exact sender allowlist, and number-selection preference. The preset does not select this outbound adapter. Both components are optional.

## Twilio

Use `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and either `TWILIO_FROM` or `TWILIO_MESSAGING_SERVICE_SID`. `TWILIO_API_URL` can override the default REST endpoint for a compatible deployment.

## Vonage

Use `VONAGE_API_KEY`, `VONAGE_API_SECRET`, and `VONAGE_FROM`. The adapter accepts the provider's success status and returns a redacted message identifier.

## Telnyx

Use `TELNYX_API_KEY` and `TELNYX_FROM`. `TELNYX_API_URL` is configurable for testing or compatible gateways.

## Generic JSON webhook

Use `SMS_PROVIDER=webhook`, `GENERIC_SMS_API_URL`, and optionally `GENERIC_SMS_API_OAUTH_TOKEN` or `GENERIC_SMS_API_KEY`. The JSON body is:

```json
{
  "to": "+447700900123",
  "text": "Fixed acknowledgement text",
  "senderId": "ExampleSender",
  "correlationId": "hashed-or-provider-safe-id"
}
```

All provider endpoints must use HTTPS. `GENERIC_SMS_API_OAUTH_TOKEN` is a
pre-provisioned bearer token; the script does not perform an OAuth token exchange for
an arbitrary webhook. Google account authorization is handled separately by Apps
Script during initialization.

The bearer token is sent in the `Authorization` header. Adapt the body in `sendSmsViaWebhook_()` if a gateway uses different field names.

All adapters share the same policy layer: dry-run, recipient lock, caller cooldown, send-window enforcement, message-length validation, and no automatic retry after an uncertain provider response.
