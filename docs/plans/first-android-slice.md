# First Android implementation slice

Status: planned.

## Outcome

Open SmartBot, confirm a time budget, and see a suggested reading activity. Complete it and see the result in Today and Progress. Close and reopen the app in airplane mode and see the same plan, book position, and completion. This is the first end-to-end build for the [product plan](../product-plan.md).

## Steps

1. Check the installed Android SDK and JDK, then select compatible Gradle and Android Gradle Plugin versions. Choose the app ID and minimum supported Android version before creating the project. Add the Gradle wrapper and publish runnable commands in the root README.
2. Implement the first Compose navigation routes for setup, Today, reading, and Progress. Agree on states for missing book, pending activity, started reading, and completed reading.
3. Build one local planner activity with a 10-minute default reading session. Use an injected clock and save one plan for each local date. Add manual book title and optional page progress. Keep plan items and the reading session coherent when a completion is saved or undone.
4. Connect the routes to the local repository. Show an **Add a book** action when setup is incomplete. Add a device smoke test for setup, completion, history, and relaunch.

## Acceptance checks

- A user can install and launch a debug build, choose a budget, add a book, and complete a reading activity.
- Reopening Today on the same date shows the same plan and the last saved book position. After date rollover, the earlier session remains available in Progress.
- Repeated completion creates one history entry. Changing the routine budget applies to subsequent days and stays consistent with any explicit edit to the current day.
- Airplane mode does not prevent plan creation, reading, completion, or reviewing progress.
- Run the Gradle unit tests, lint, and a debug build. Record whether the smoke check used the pilot phone or an emulator. News, vocabulary, and the widget follow in later milestones.
