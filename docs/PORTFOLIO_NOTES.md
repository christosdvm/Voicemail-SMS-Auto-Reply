# Portfolio notes

This document explains why this repository is part of a professional career-transition portfolio rather than only a utility script.

## The problem domain

Small professional practices often rely on telephone calls, voicemail, email notifications, and manual follow-up. That creates a narrow but meaningful automation opportunity: acknowledge callers quickly without creating unsafe, duplicate, or uncontrolled communication.

The repository uses that practical problem to demonstrate how a small workflow can be treated with production-style discipline.

## Product judgement demonstrated

- The external SMS is deterministic, not generated from private audio.
- Installation begins disabled and dry-run-first.
- Live sending requires explicit activation steps.
- Message and caller deduplication are treated as product requirements, not afterthoughts.
- Ambiguous provider outcomes are sent to manual review instead of being retried blindly.
- Modulus is supported as one provider path, but the system is not locked to one vendor.

## Engineering signals

- Ordered Apps Script source modules with a reproducible generated `Code.gs` bundle.
- Credential-free local demo using synthetic fixtures.
- Offline test harness for parser, policy, provider, privacy, signing, and validation behavior.
- CI validation for bundle drift, syntax, behavioral tests, repository checks, and public-safety checks.
- Security, privacy, operations, roadmap, contributing guidance, and architecture decision records.

## What this should communicate to reviewers

This project is intentionally modest in scope, but careful in execution. It shows the ability to take a real workflow, identify operational and privacy risks, define safety boundaries, build provider abstractions, document trade-offs, and ship a usable reference implementation.

That is the professional signal: not that the project is large, but that it is designed like a real product.