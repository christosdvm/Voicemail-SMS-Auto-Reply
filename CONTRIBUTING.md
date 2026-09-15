# Contributing

1. Do not add real phone numbers, email addresses, API keys, voicemail audio, transcripts, or customer names.
2. Use synthetic fixtures such as `+306900000001` and reserved example domains.
3. Edit the appropriate ordered module under `src/`; do not edit the generated `Code.gs` directly.
4. Run `npm run build` followed by `npm run validate` before opening a pull request.
5. Keep provider adapters isolated and return redacted results.
6. Preserve dry-run, recipient-lock, cooldown, and no-automatic-retry safeguards.
7. Add a synthetic regression case for every behavior change.
8. Update `CHANGELOG.md` and the relevant decision or operations note when behavior changes.
