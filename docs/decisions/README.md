# Architecture decisions

These records capture decisions that are easy to lose when looking only at the final code.

| Record | Decision |
| --- | --- |
| [ADR-001](001-deterministic-caller-message.md) | Keep caller-facing SMS deterministic. |
| [ADR-002](002-ambiguous-delivery.md) | Treat ambiguous delivery as manual review, not retry. |
| [ADR-003](003-source-and-deployment-bundle.md) | Develop in modules and publish a reproducible single-file bundle. |

The records describe trade-offs, not universal rules. A queue-backed service or a different risk model may reasonably make different decisions.
