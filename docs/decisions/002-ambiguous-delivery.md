# ADR-002: Ambiguous delivery requires review

**Status:** Accepted

## Context

An SMS API timeout can happen before a provider receives a request or after it has accepted the message. Retrying automatically makes the second case a duplicate-message risk.

## Decision

Reserve the caller cooldown before live delivery. Only an explicit provider success becomes `sms_sent`; timeouts, malformed responses, and uncertain outcomes become `review_required` and are not retried automatically.

## Consequences

- Duplicate acknowledgements are less likely.
- Some genuine failures require a human check before resend.
- Provider delivery receipts would improve certainty but require a callback service outside Apps Script polling.
- The project describes this as “exactly-once enough,” not distributed exactly-once delivery.
