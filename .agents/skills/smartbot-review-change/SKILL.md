---
name: smartbot-review-change
description: Review SmartBot web or Android code or configuration without editing it. Use for an independent review of a change, diff, or implementation handoff.
---

# Review a SmartBot change

1. Read `AGENTS.md` and inspect the diff and any new files. Use the product plan and assigned acceptance criteria to establish the intended behavior.
2. Trace when a user can edit, finish, repeat, or undo the changed action and how the app restores it. For plan or widget changes, check local date, stale deep links, and duplicate actions. For provider changes, check failure isolation, permissions, and retained data.
3. Run available checks that preserve the working tree. Report actionable findings with trigger, impact, and file and line. State any meaningful device, data migration, or provider behavior that remains unverified.

For News changes, use **Verify news sources** in `docs/product-plan.md`. Check the evidence from actual article links for access to the full text. Flag feeds that can surface gated articles and access checks that only tested the feed response.
