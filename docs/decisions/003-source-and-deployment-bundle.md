# ADR-003: Modular source with a generated deployment bundle

**Status:** Accepted

## Context

A single `Code.gs` file is easy to paste into Apps Script, but difficult to navigate and review as the workflow grows. Multiple source files improve ownership boundaries, while a build system with runtime dependencies would make the small-project installation path heavier.

## Decision

Keep ordered, dependency-free `.gs` modules under `src/`. A small Node script concatenates them into the root `Code.gs` deployment artifact. CI fails when the bundle and source differ.

## Consequences

- Reviewers can navigate configuration, processing, parsing, providers, policy, tracking, state, and utilities independently.
- Manual installation and `clasp` deployment still use one generated file.
- Source order remains explicit through numeric prefixes.
- Contributors must run `npm run build` after changing a module.
