---
name: smartbot-deliver-feature
description: Implement a SmartBot Android feature or bug fix across the daily plan, activities, storage, widget, or history. Use for an end-to-end change to user behavior.
---

# Deliver a SmartBot feature

1. Read the root `AGENTS.md`, `docs/status.md`, and the relevant part of `docs/product-plan.md`. Find the normal entry point and define the smallest observable user outcome.
2. Trace any affected saved plan, activity progress, widget action, or provider data. Agree on one owner of common types and schemas before any authorized parallel work. Use `docs/templates/implementation-plan.md` when steps or owners have dependencies.
3. Exercise the feature through its usual route, including re-entry after app restart and the relevant offline, missing-data, or stale-widget state. When changing data, check that an older record and a repeated action still preserve the intended result.
4. Run available checks and record what was verified locally, on an Android device, or against an external service. Update setup or milestone docs when the change affects them.
