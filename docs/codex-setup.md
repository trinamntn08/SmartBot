# SmartBot Codex setup

Open the SmartBot repository root in Codex. Project instructions, custom agents, and skills live in the checkout, using the same layout as SmartLingo. A Codex client that supports these features can discover them from this project when its trust settings allow. Start a fresh session if your current one still reflects the older checkout. [Project instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md) · [Agent configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents) · [Skill discovery](https://learn.chatgpt.com/docs/build-skills)

| File | Purpose |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | Product constraints, working instructions, and delegation boundaries. |
| [.codex/config.toml](../.codex/config.toml) | Caps concurrent subagent threads at three. Agent files inherit the active model and permissions. |
| `.codex/agents/` | Standalone TOML files for the project roles below. |
| `.agents/skills/` | Reusable workflows available in the project. |

## Roles and skills

| Role | Assign it |
| --- | --- |
| [`android-ui`](../.codex/agents/android-ui.toml) | Compose screens, navigation, accessibility, and the Glance launcher widget. |
| [`planner-data`](../.codex/agents/planner-data.toml) | Daily plan rules, Room persistence, progress, and backup. |
| [`integration-builder`](../.codex/agents/integration-builder.toml) | News, Calendar, and other external adapters with a defined provider contract. |
| [`vocabulary-author`](../.codex/agents/vocabulary-author.toml) | Original deck content for French B2/C1, English B2/C1, and Japanese A1. |
| [`change-reviewer`](../.codex/agents/change-reviewer.toml) | Independent review of completed changes. Review is read-only by instruction. |

- [`$smartbot-deliver-feature`](../.agents/skills/smartbot-deliver-feature/SKILL.md) supports an end-to-end change to the Android experience.
- [`$smartbot-review-change`](../.agents/skills/smartbot-review-change/SKILL.md) checks a diff and its validation evidence.

Example request: “Use `$smartbot-deliver-feature` to build the first Android slice. Delegate the Compose screens and planner implementation after agreeing on their shared states.” Give each agent the outcome, exclusive file paths, and expected checks. The primary agent owns shared types, Gradle files, integration, and final validation. If a client cannot select named roles, the primary agent can read the role and use its instructions directly or pass them to a supported worker for authorized delegation.

## Design skills

From the SmartBot repository root, run the setup with Python 3 and the Codex `skill-installer` helper available. It downloads the pinned upstream skill folders into this checkout. It keeps existing skill folders and leaves the user-wide Codex configuration alone. Reopen the project in Codex if the skills do not appear.

```sh
python scripts/install-design-skills.py
```

For a custom Codex installation, pass `--installer` with the path to `install-skill-from-github.py`. A fresh clone needs the setup command once. The downloaded files stay out of Git, and the script records their source revisions.

| Invoke in Codex | Use it for |
| --- | --- |
| `$design-taste-frontend` | Visual direction and responsive browser checks for the web interface. [Taste](https://github.com/Leonxlnx/taste-skill) |
| `$animate` | New interaction motion in the browser and in SmartBot's Android WebView. [Animate](https://github.com/emilkowalski/skills/tree/main/skills/animate) |
| `$review-animations` | Review motion timing, interruptions, and reduced-motion behavior. [Animation review](https://github.com/emilkowalski/skills/tree/main/skills/review-animations) |
| `$animate-expo` | Native React Native and Expo work if SmartBot adds that stack. [Expo motion](https://github.com/emilkowalski/skills/tree/main/skills/animate-expo) |
| `$impeccable audit` | Review accessibility, responsive layout, and UI quality. `$impeccable critique` focuses on usability and visual hierarchy. [Impeccable](https://github.com/pbakaus/impeccable) |

Apply the guidance to SmartBot's mobile-first layout and offline web app. Emil's web motion skill links to `pick-ui-library`, which the setup also installs for reference. Keep bundled example images and design tools out of the web assets. Taste's browser tools use Node and a local Chromium browser. Impeccable's launcher can fetch its platform engine on first use. The optional design hooks are separate from this setup.

## Session workflow

1. At the start of a session, read [current status](status.md) and the relevant product requirements. Before editing, building, or launching a preview, [check every remote branch](#check-every-remote-branch). Start from the fetched integration branch or the branch requested for the task. On a clean branch that is only behind its upstream, update with `git merge --ff-only '@{upstream}'`.
2. Give each parallel writing session a unique branch and a separate Git worktree or clone. Agree on file ownership, including shared documentation and contracts. Use the [implementation plan template](templates/implementation-plan.md) for dependent steps or multiple owners. Coordinate with the integration owner when sessions need to change the same file or land work on a shared branch.
3. For every completed step, run the relevant checks and record the outcome, checks and their results, and any blocker or next action in the task plan or relevant project doc. Update [current status](status.md) when a milestone or active handoff changes. Use a [decision record](templates/decision.md) for consequential architecture choices. Stage only the step's files and documentation, review `git diff --cached` and `git diff --cached --check`, then make one focused commit.
4. Push immediately. Use `git push -u <remote> <branch>` for a new branch and `git push <remote> <branch>` for later commits. Fetch again and run `git rev-list --left-right --count 'HEAD...@{upstream}'` to verify the branch is in sync. Both counts should be zero. If the upstream advanced, fetch and inspect the divergence, coordinate any conflicts, integrate both histories, and rerun the affected checks before retrying the push. Avoid force-pushing or discarding work from another session.
5. Carry on once the step is synchronized. If a remote, access, or a conflict blocks sync, preserve the commit locally and report its branch, commit ID, and the blocker. In cloud and local handoffs, include the pushed branch, commit ID, any pull request, what changed, and any pending checks. For builds and previews, include the branch and commit actually used.

### Check every remote branch

Run these checks from the checkout you intend to use. Repeat the live branch listing for each configured remote.

```powershell
git status --short --branch
git worktree list
git remote -v
git fetch --all
git ls-remote --heads origin
git for-each-ref --format='%(objectname) %(refname)' refs/remotes
git branch -r --no-merged HEAD
```

- Compare the live branch names and tips against your remote-tracking refs. Use the live list to distinguish active branches from aliases and refs for deleted branches. If the checkout fetches only selected branches, fetch the missing branch tips. For `origin`, run `git fetch origin 'refs/heads/*:refs/remotes/origin/*'` to fetch all heads, then repeat the branch check. If fetching fails, report which remote could not be checked.
- Review the branches with commits outside the intended checkout for work relevant to the task. For example, use `git log --oneline HEAD..origin/work` and `git diff --stat 'HEAD...origin/work'`. Check the cloud handoff and relevant open pull requests as well, including pull requests from a fork when expected work is missing from the repository's branches.
- For a named commit, run `git branch -r --contains <commit>` to locate it, then `git merge-base --is-ancestor <commit> HEAD` in the checkout you plan to use. Exit code 0 confirms it is included. If the change was squashed or cherry-picked, verify the equivalent changes in the checkout.
- Use the branch that contains the required work, or integrate the relevant changes within the requested scope. Keep unrelated branches separate. If expected cloud work cannot be located or accessed, report the missing branch, commit, or pull request when known and what the current checkout contains.
- Before a build or preview, confirm the source worktree with `git rev-parse --show-toplevel` and the commit with `git rev-parse HEAD`. If an existing preview server points to a different worktree, launch from the intended one and verify the requested feature before handing it off.

## Verification

- Check `git status --short --branch` and `git diff --check` during a review. Check untracked files directly since they are outside the ordinary diff until staged.
- Parse the TOML files and validate the skill frontmatter after configuration changes. To verify discovery in a supported client, open a fresh SmartBot session and check the project skill list. During authorized delegation, ask for a named role and check that the runtime selects it. A file-format check alone cannot establish client discovery or role selection.
- Run the web app and planner tests using the [README commands](../README.md#development). See the [first web slice](plans/first-web-slice.md#verification) for browser checks.
- After syncing and building a preview, launch it with `preview.cmd` or open the [preview refresh link](../README.md#browser-preview). Use the refresh link when handing off a preview so the browser opens the current web files.
