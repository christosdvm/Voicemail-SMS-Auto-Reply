# Roadmap

This roadmap communicates engineering direction for the public reference implementation. It is not a delivery commitment.

## Current: safe reference implementation

- [x] Gmail ingestion with configurable sender and subject rules
- [x] Voicemail and missed-call classification
- [x] Caller extraction and E.164 normalization
- [x] Modulus, Twilio, Vonage, Telnyx, and webhook SMS adapters
- [x] Message and caller-level deduplication
- [x] Dry-run, recipient lock, send window, and one-shot activation controls
- [x] Privacy-aware state retention and optional transcription
- [x] Offline tests and multi-version Node CI

## Next: developer experience

- [ ] Add table-driven provider contract tests
- [ ] Add a local notification and SMS-provider simulator
- [ ] Publish a redacted configuration schema and validation guide
- [ ] Add linting, formatting, coverage, and secret-scanning checks
- [ ] Add a reproducible `clasp` deployment workflow

## Later: modular v2 architecture

- [ ] Extract parsing, policy, and deduplication into a TypeScript core
- [ ] Keep Apps Script as one deployment target built from modular source
- [ ] Define typed inbound and outbound adapter interfaces
- [ ] Add durable queue and dead-letter interfaces for larger deployments
- [ ] Add structured, redacted telemetry and operational metrics
- [ ] Support provider idempotency keys where available

## Exploration

- [ ] Gmail push or generic webhook ingestion
- [ ] Consent and opt-out adapter hooks
- [ ] International number-policy modules
- [ ] A browser-based synthetic demo with no external credentials

## Contributing

Roadmap work should start as an issue describing the user problem, proposed behavior, privacy impact, and test plan. See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.
