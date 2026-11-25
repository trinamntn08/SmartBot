# SmartBot agent instructions

## Project context

SmartBot is a personal, mobile-first web app that suggests an editable 15–30 minute daily plan. Start with the reading routine, then add news and three vocabulary decks. Read [current status](docs/status.md) and the relevant part of the [product plan](docs/product-plan.md) before changing behavior. The Android test APK bundles the web app. A native interface and launcher widget are follow-up options.

## Working practices

- Inspect relevant files and Git status before making changes. Preserve unrelated work.
- Before editing, building, or starting a preview, follow [Check every remote branch](docs/codex-setup.md#check-every-remote-branch). Fetch every configured remote, check its live branch tips, and inspect branches with commits outside the intended checkout for relevant cloud work. An up-to-date upstream only covers that branch.
- Check cloud handoffs and relevant open pull requests when continuing cloud work. Verify any requested commit is in the checkout used for the task, or verify the equivalent changes if they landed under a different commit. Use the branch or integrate the relevant changes within scope. Report any expected work that is still missing or unavailable before calling the result current.
- Keep changes focused, use existing conventions, and avoid adding dependencies or infrastructure without a clear need.
- Do not commit secrets, credentials, generated output, or machine-specific configuration.
- Run checks appropriate to the change. Report what was tested and any checks that could not be run.
- For each completed development step, update the task's tracking document with what changed, the checks and their results, and any remaining work. Use the existing task plan or `docs/status.md` and include the record in the same commit as the change.
- Push each completed step to GitHub immediately. When using a work branch, push it first, merge it into the latest `main`, and push `main`. Fetch again and confirm GitHub's `main` includes the change and its tracking record before calling the step complete. If publication is blocked, preserve the commit and report the blocker. [Git session workflow](docs/codex-setup.md#session-workflow)
- Before generating or refreshing a browser preview or building an Android preview APK, verify that a clean checkout matches live GitHub `main` and includes the requested work and its tracking record. Check the worktree used by any running preview server before reusing it. [Preview verification steps](docs/codex-setup.md#verify-main-before-generating-a-preview)
- Use a separate branch and worktree or clone for each parallel writing session. Coordinate overlapping edits before starting them. Preserve other sessions' changes and history. Destructive Git operations require explicit authorization.

## Implementation boundaries

- Keep plan selection in the planner, persistent state behind repositories, and third-party data behind provider adapters. Today and the widget use the same stored plan and actions.
- Preserve user edits, completion history, and local progress when time zones, sources, or preferences change. Keep the core routine usable offline and account connections optional.
- Use original or appropriately licensed vocabulary and news content. Keep credentials and personal progress out of repository files and logs.
- Use [free-to-read news sources](docs/product-plan.md#verify-news-sources) and verify the full article can be read without a subscription, an account, or consent to optional cookies.
- Update [status](docs/status.md) when a milestone or active handoff changes. Record lasting architecture decisions when they affect future work. Use the [implementation plan template](docs/templates/implementation-plan.md) for work with several dependent steps or owners.

## Subagents

- Use a role from `.codex/agents/` when delegation is requested or otherwise authorized and the work has independent parts. Keep small sequential changes with the primary agent.
- Give each writing agent exclusive paths, the verified base branch and commit, any relevant cloud handoff, the shared contract, and the checks expected. The primary agent owns shared contracts, dependency files, integration, and final validation.
- Use `change-reviewer` for an independent review when appropriate. It is read-only by instruction. See the [Codex setup guide](docs/codex-setup.md) for the roles and skills.

## Project-specific commands

Browser preview, planner tests, and Android APK build commands are in [README.md](README.md). Codex setup checks are in the [Codex setup guide](docs/codex-setup.md#verification).
