# Roadmap

The project is moving toward a small, reusable communications policy engine—not a chatbot and not a bulk-messaging platform.

The north star is simple: a new event source or SMS provider should plug in without weakening the delivery and privacy guarantees already tested here.

## Shipped foundation

- [x] Generic Gmail event rules with an optional Modulus preset
- [x] Voicemail and missed-call classification
- [x] E.164 normalization, excluded-number policy, and configurable caller preference
- [x] Modulus, Twilio, Vonage, Telnyx, and generic webhook adapters
- [x] Message/caller deduplication and pre-send reservations
- [x] Dry run, recipient lock, send window, and one-shot activation controls
- [x] Optional transcription isolated from the caller-facing SMS
- [x] Modular Apps Script source with a reproducible single-file bundle
- [x] Credential-free synthetic workflow demo
- [x] CI checks for behavior, bundle drift, syntax, and common secret/private-media patterns

## Next: make adapter behavior explicit

### Provider contract suite

Build table-driven tests that run the same acceptance, rejection, malformed-response, and redaction cases against every SMS adapter. This is the shortest path to safer community-contributed providers. Tracked in [#2](https://github.com/christosdvm/Voicemail-SMS-Auto-Reply/issues/2).

### Redacted event schema

Define stable operational events for `classified`, `blocked`, `deferred`, `accepted`, and `review_required`. Exportable fields must exclude raw numbers, message IDs, transcripts, and credentials. Tracked in [#4](https://github.com/christosdvm/Voicemail-SMS-Auto-Reply/issues/4).

### Reproducible clasp deployment

Document development, staging, and production property boundaries and add a validation-first deployment command without committing project IDs or OAuth state. Tracked in [#5](https://github.com/christosdvm/Voicemail-SMS-Auto-Reply/issues/5).

## Then: separate policy from platform

- [ ] Extract parsing, normalization, decision policy, and adapter contracts into a typed TypeScript core.
- [ ] Keep Apps Script as the zero-infrastructure deployment target generated from that core.
- [ ] Define an inbound event-source interface for Gmail polling, Gmail push, and generic webhooks.
- [ ] Add consent and opt-out hooks before delivery.
- [ ] Add country-specific number-policy modules instead of embedding national assumptions.

The typed-core work is tracked in [#1](https://github.com/christosdvm/Voicemail-SMS-Auto-Reply/issues/1).

## Scale boundary

Durable queues, dead-letter handling, delivery-receipt callbacks, provider idempotency keys, and operational metrics belong in a service deployment rather than being simulated inside Apps Script. The current repository should remain a clear reference implementation while those capabilities are designed behind interfaces.

## Contributing

A roadmap proposal should begin with an issue that states the user problem, failure modes, privacy impact, and synthetic test plan. See [CONTRIBUTING.md](CONTRIBUTING.md).
