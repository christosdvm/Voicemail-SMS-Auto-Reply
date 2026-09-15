## Problem

What user or operational problem does this change address?

## Approach

Summarize the design and the trade-offs that matter during review.

## Verification

- [ ] `npm run validate`
- [ ] `npm run demo -- all`
- [ ] New or changed behavior has synthetic test coverage
- [ ] `Code.gs` was regenerated with `npm run build`
- [ ] Documentation and changelog were updated where needed

## Privacy and delivery safety

- [ ] No real caller data, credentials, audio, or transcripts were added
- [ ] Dry-run and recipient-lock behavior remains fail-closed
- [ ] Ambiguous provider outcomes cannot trigger an automatic retry
