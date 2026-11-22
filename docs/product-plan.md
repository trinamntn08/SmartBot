# SmartAssistant product and development plan

SmartAssistant helps you decide what to do today for the personal goals you care about. It suggests an editable 15–30 minute plan that fits into your day. Start from your phone’s home screen, choose an article to read, pick up your current book, or learn five words in the language you want to practice. On a busy day, shorten the plan or skip an activity without losing your progress.

## First release

Build for your own Android phone first. The first release includes the daily plan, a home-screen widget that shows the whole default plan at a glance, three built-in activities, and a simple progress history. During onboarding, preselect the three activities and suggest 25 minutes. You can change the budget, turn individual activities on or off, and choose which language to practice. Your plan and progress live on your phone and work without a SmartAssistant account.

| Activity | Default | What you do |
| --- | --- | --- |
| Read news | 5 minutes | Pick one article from a shortlist and open it at the publisher. Mark it as read when you return. |
| Read a book | 10 minutes | Continue your current book, then save your page, percentage, or chapter. |
| Learn vocabulary | 10 minutes | Work through up to five new words in French B2/C1, English B2/C1, or Japanese A1. Switch between all three decks and keep separate progress in each. |

One day might look like 5 minutes of news, 10 minutes of reading, and 10 minutes of Japanese. The next day you might swap Japanese for French and keep the other activities. You can add a one-off item such as a walk, using only a title and an estimated duration. Ideas for later include a podcast episode, a journal prompt, and a watchlist item. These can reuse the same planning and progress behavior.

## What the app feels like

Use three main destinations: **Today**, **Activities**, and **Progress**. Settings are accessible from the app bar. The app opens on Today after setup.

| Screen | What you see and do |
| --- | --- |
| First run | Confirm your time budget and enabled activities, select a starting deck, and go straight to Today. Add a book or news preferences when you first open those activities. Offer a reminder and widget setup after you have seen a plan. |
| Today | See the planned time, completion count, and ordered activity cards. Start the next item in one tap. Use **Edit plan** to reorder, swap, change an estimate, or add an item, and **Shorten today** when time is tight. |
| Activities | Enable or pause activities, change defaults for future plans, choose a vocabulary deck, maintain your current book, and manage your news sources. |
| Activity details | See the chosen headlines, book progress, or vocabulary session. Provide a clear completion action and preserve saved progress when you leave. |
| Progress | Review a seven-day history and simple totals such as articles read, book sessions, and new words studied. Show skipped or unfinished items neutrally. |
| Settings | Change the daily budget, reminder time, and display preferences. Provide local export, restore, and data deletion controls. Add a connections area when the first account integration ships. |

### Today screen sketch

```text
Today                              Edit plan
25 min planned                      0 of 3 done

Next up
Read one news article                   5 min
[ Choose an article ]

Read your current book                 10 min
Learn 5 words · Japanese A1             10 min

[ Shorten today ]                 [ Add item ]

Today            Activities            Progress
```

Use large tap targets, readable text sizes, plain action labels, and text alongside color for states. Support dark mode, Android font scaling, and TalkBack. Give each activity one primary action and put occasional actions in its menu. Provide accessible move-up and move-down controls alongside any drag gesture. Give empty states an immediate action, such as **Add a book** or **Turn on an activity**.

### Android home-screen widget

The primary widget shows the date, completion count, and all three default activity rows with short labels and completion states. Tap a row to open that activity and tap the header to open Today. A smaller size shows the next activity and completion count. At larger sizes, use available space for extra rows and a remaining-item count when a custom plan exceeds capacity. Show a useful rest-day or all-done state. Test the default plan at normal and larger font sizes on your launcher and adjust the recommended widget size to fit it.

Render the widget from the same local plan as Today. Refresh it after edits and completions, and row links open the current plan when a launcher still shows an older day. Use background refresh for turnover and reconcile the date whenever the app or widget action runs. Android controls the timing of background updates. [Android Glance widget updates](https://developer.android.com/develop/ui/compose/glance/glance-app-widget)

## Daily planning rules

Capture these rules in a small planner that can be exercised with an injected clock and sample activities.

1. **Create today’s plan.** Generate the first plan for the local date on demand when Today or the widget needs it. Use enabled activities, their configured weekdays, default order, and time estimates. Save one plan per date so reopening the app shows the same choices.
2. **Fit the time available.** Start from the user’s budget. Add activities in configured priority order, using a smaller version where available when the normal version will not fit. Try later activities that fit the remaining time. If none fit, offer a smaller target or a rest day. If setup is needed, use an actionable card such as **Add a book** to launch setup for that activity.
3. **Keep edits predictable.** A manual reorder, swap, skip, removal, or budget change applies to today. Changes in Activities affect future plans. Offer an explicit action to apply a new default to today’s pending activities. An item-specific deck change applies to that item; a started vocabulary session keeps its original deck, cards, and progress. You can intentionally exceed the target and see the updated estimate.
4. **Shorten today.** Preview a smaller version of the remaining plan. Keep completed and started items and any item the user pinned. Reduce or drop flexible pending items until the selected remaining-time target is met, or show the time needed for the items being kept. For example, if news is done and you have ten minutes left, use the five-minute book and vocabulary versions. Apply the preview only after confirmation.
5. **Record outcomes.** Items can be pending, in progress, completed, or skipped. Start places the activity in progress. Finish and skip save the outcome explicitly. Offer undo for completion and skip, keeping any saved pages or vocabulary responses. Treat repeated Finish actions as the same completion.
6. **Start fresh tomorrow.** Unfinished items remain visible in their original day’s history. A recurring activity gets a new item when next due. A one-off task moves to another day only when requested. When the device time zone changes, use its local date for Today and preserve the original date and time zone on saved plans. If the date was already visited, reopen that plan.

The first planner uses rules you can understand and adjust. Future calendar availability can supply optional time windows without changing these rules for offline or unconnected days. Consider suggestions based on your habits only after the pilot shows where the existing rules fall short.

## Activity details

### News

- Present three to five recent headlines from sources you enable, where available. Show title, publisher, and publish date when supplied. Sort by freshness, deduplicate links, and favor a mix of enabled publishers when possible.
- Fetch from publisher RSS or Atom feeds whose terms permit the intended use. Keep the news provider replaceable so a licensed API can later supply the same headline records. A publisher such as The Guardian is a candidate to evaluate for the private pilot if it fits your preferences. [The Guardian’s RSS guidance](https://www.theguardian.com/help/feeds)
- Open articles at the publisher via an Android browser or Custom Tab. Save only permitted metadata, with a bounded cache and a visible last-updated time. Let you refresh without losing saved progress. If sources fail or the phone is offline, show available cached headlines with their age and offer a swap when the list is empty. Marking an article as read is a separate action from opening it.
- Start with configured source toggles, a shortlist, and manual completion. Topic filters, saved articles, and Android Share capture are follow-up options. A keyed API goes behind a server adapter if provider credentials must be kept secret. Confirm rights, coverage, limits, and cost before opting in. News API’s Developer tier is limited to development and testing, which matters even for an internal release. [News API terms](https://newsapi.org/terms)

### Books

- Add a title, optional author, and optional reading link or current position. Choose a current book. The daily card suggests picking up from your saved position and shows a time target you can change.
- Log a session with a page, percentage, or chapter in the same unit the book already uses. Allow completion with just minutes read. Support a book in paper, reader app, or audiobook; for an audiobook, you can use the chapter field initially.
- Keep elapsed reading optional in the first build. Add a timer or Google Books/Open Library metadata lookup only if manual entry or timing becomes a friction point. When a book is finished, offer to pick the next book while preserving its sessions.

### Languages

- Ship three offline starter decks and let you switch among them from Today or Activities: French B2/C1, English B2/C1, and Japanese A1. Tag French and English cards by level and start each deck with a mix of B2 and C1. A starter target of at least 35 new terms per deck supports a week of five-word sessions in any one deck. Keep progress and due reviews separate per deck.
- A card contains a word or phrase, a meaning in your chosen study language, and an example. French and English decks can focus on useful collocations and usage. Japanese cards can show kana, optional kanji, and optional reading help. Use original examples or appropriately licensed content.
- A standard session offers five new words if the deck has them. Reveal each meaning and rate whether you remembered it so the app can schedule a review. Offer due reviews as a separate action and show the counts for new and reviewed cards. A short session can use fewer words. When a deck runs low, show the available count and offer reviews or a deck switch. Save after each card so you can resume where you left off.
- Start with simple review intervals and adjustable targets after the pilot. Local user-created cards or a portable import format are options if the starter decks become too small. Add a SmartLingo link or API adapter only if it serves an actual need after the pilot.

## Architecture

### Android and web

Start with native Android using Kotlin, Jetpack Compose and Material 3 for screens, a single activity with navigation, and Jetpack Glance for the launcher widget. Use Room for structured local data, DataStore for lightweight preferences, and WorkManager for deferrable work such as refreshing feeds and reconciling the widget. Compose ViewModels read through repositories. Use an Android notification channel and request the system notification permission when the user enables reminders on supported versions. Start with one optional reminder around the chosen time, with timing subject to Android background scheduling and battery controls. [Android architecture recommendations](https://developer.android.com/topic/architecture/recommendations) · [Room](https://developer.android.com/training/data-storage/room) · [Android notification permission](https://developer.android.com/develop/ui/compose/notifications/notification-permission) · [Android alarm scheduling](https://developer.android.com/develop/background-work/services/alarms)

Begin with one Android Gradle app module and clearly separated Kotlin packages. Move the planner or a feature into its own Gradle module when it has a concrete need for reuse, independent builds, or stronger dependency boundaries. Pick the minimum Android version when the pilot phone is known.

A web companion makes sense when you want to manage plans or decks from a desktop. Give it Today, editing, vocabulary, and history views using a shared versioned data contract. Evaluate a responsive web app or installable PWA for that stage. The first synchronization slice can be routine settings and completions, with explicit conflict handling and local changes queued while offline. Keep the Android widget and launcher integration native. Share data contracts and planner test cases across platforms and evaluate sharing executable planner code once both clients have a use for it.

### Package boundaries

| Package | Owns |
| --- | --- |
| `planner` | Plan generation, time estimates, statuses, shortening, ordering, and daily rollover. Depends on small activity contracts and an injected clock. |
| `activities` | Activity registration, shared actions, and feature packages for news, books, vocabulary, and simple one-off items. Each feature owns its own configuration and completion details. |
| `data` | Room stores, queries, migrations, preferences, and repositories. Applies plan edits and completions transactionally and exposes observable local state. |
| `today`, `progress`, `settings` | Compose screens and ViewModels for plan execution, history, settings, and onboarding. |
| `widget` | Glance layouts and actions that use the same plan and completion use cases as the app. |
| `integrations` | Provider adapters as needed, including news feeds and optional future availability, link, or import adapters. Maps provider responses to app-owned records. |

### How to add an activity

An activity registers a stable type ID, label, configuration, scheduling inputs, default and optional short duration, and a route to start it. Its feature handles any activity-specific data. The planner consumes common candidates, the widget uses common labels and states, and history reads a common completion record. A simple new activity such as **Walk for 10 minutes** should require registration and a completion screen or reuse of the simple-item screen. A richer activity such as **Listen to a podcast** can add its own feed and episode progress while using the same Today and widget logic. Keep type IDs stable and store the earlier item label and duration with history so disabled or renamed activities remain readable.

### Local data and resilience

| Record | Main fields and behavior |
| --- | --- |
| Activity settings | Stable activity ID, type ID, enabled flag, weekdays, order, duration, and per-feature options. |
| Daily plan and item | Local date and creation time zone, user budget, ordered stable item IDs, duration, status, configuration snapshot, optional completed time, and user edits. Enforce one plan per date. |
| Read and study progress | Book title and position, reading session entries, vocabulary cards and deck membership, session responses, and review due dates. Keep them linked to the activity that produced them where applicable. |
| News cache | Provider item ID or canonical URL, publish date when available, publisher attribution, fetch time, and expiry. |
| Connection state | Add with the first account integration. Store provider status separately from plans, and keep credentials out of normal application records and exports. |

Use the persisted plan as the source of truth. Stage external fetches as inputs to local repositories so a failed fetch leaves the rest of the app usable. Save completion and its associated progress together when they represent one action. Track user edits independently of provider data so reloading a feed or losing a connection cannot overwrite them. Plan IDs and import format versions should survive a future move to sync.

Keep personal data on the phone for the first release. Provide a versioned export of routines, history, and user-created content. Restore should preview and apply the backup atomically, with a confirmation before replacing stored data. Exclude cached headlines and future account tokens from exports. Explain that an exported file may contain personal history. Decide explicitly which files are eligible for Android system backup. When account connections are added, disclose the data each one uses, protect credentials with platform-backed storage where applicable, and remove account tokens and provider-only cache on disconnect. [Android offline-first guidance](https://developer.android.com/topic/architecture/data-layer/offline-first)

## Integrations and release order

| Integration | First useful version | When to build it |
| --- | --- | --- |
| News feeds or API | Display a short list of attributed headlines and open the publisher. Swap the source adapter without changing Today. | Feed support in the Android release. Consider a paid or licensed API if feeds cannot supply your chosen languages or topics. |
| Google Calendar | Use read-only free/busy windows to suggest when a plan could fit. Keep the plan usable when access expires and show when availability was last checked. | After the pilot if finding time is the main difficulty. Test permissions and verification requirements for the intended audience before adding public onboarding. [Calendar free/busy](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query) · [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth) |
| Gmail | Capture a link or a user-selected snippet from an app that shares it, or add a manual email follow-up. Explore mailbox access if there is a clear repeated use case. | After the pilot. Confirm the actual Gmail share workflow on the phone first. Account-wide metadata and read-only scopes are restricted and can have additional verification and assessment requirements. [Android share targets](https://developer.android.com/develop/ui/compose/sharing/receive) · [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) |
| Netflix | Add a watchlist activity from a pasted title or link, open it externally, and mark it watched manually. Explore optional local CSV import only if viewing history is useful. | After the pilot. Start with the link workflow. Treat automatic account synchronization as a candidate only if a supported integration is available for this use. [Netflix viewing activity export](https://help.netflix.com/en/node/101917) |
| SmartLingo | Try opening an existing lesson on its website. Evaluate a deck or progress adapter if a supported interface becomes available for the phone. The sibling repo documents its current preview API as loopback-only. | Optional. The Android app’s local decks support the entire pilot independently. |
| Web companion | Review and edit the plan from a browser, using the same activity and progress concepts. | Start when you have a recurring desktop use case. Confirm the desired data to sync, authentication, and conflict rules before choosing a backend. |

A link, a data provider, and an account connector have different responsibilities. An activity can start with a link and add a provider later. Provider failures, revocations, and stale data surface in the affected activity with a usable fallback. Keep calendar changes, sending mail, and other actions that write to external accounts outside the first versions of their connectors pending a separate design for confirmation and recovery.

## Implementation milestones

| Milestone | Build | Completion check |
| --- | --- | --- |
| 1. Validate the daily flow | Sketch Today, Activities, a vocabulary session, and the widget in both sizes. Walk through a normal day, a 10-minute day, and a day with no news connection. Pick initial sources and confirm the pilot phone. | You can explain how to start, edit, and shorten today’s plan from the sketch. The default plan is legible in the target widget size. |
| 2. Build a first working slice | Initialize the Kotlin Android app, set up navigation and storage, and build one local activity from onboarding to completion and history. Add unit tests for dates, budgets, and duplicate actions. | A physical Android phone can start and finish a local activity in airplane mode, and progress survives app restart. |
| 3. Deliver the three activities | Add the shortlist, current book and reading log, and the three switchable vocabulary decks. Complete today-only editing, one-off items, shortening, and progress views. | You can plan, start, finish, and review all three activities. Each deck maintains its own state. A dead feed leaves the rest of the plan available. |
| 4. Deliver the widget and polish | Add both widget sizes, optional reminder, accessibility work, and local export/restore. Test refresh, tap routing, and the normal release build on your launcher. | The default three activities are visible at a glance in the main widget, taps open the expected items, and restore reproduces history. |
| 5. Run a seven-day personal pilot | Install a private APK on your phone and test that an app update preserves data. Use it through a normal week and record interruptions or steps that felt slow. Review completion, edits, switches, and widget use using local history and short notes. | You can identify what saved time, what made the plan harder to use, and which enhancement is worth doing next. |
| 6. Expand one use case at a time | Choose calendar availability, richer news sources, a desktop companion, or another activity based on the pilot. | The chosen addition demonstrates its benefit while the daily plan still works with that addition disabled or unavailable. |

## Testing and pilot measures

- **Planner tests.** Verify priorities and shortened variants respect the budget, manual changes persist, weekday and rest-day settings work, and switching dates across midnight, daylight saving, or travel reuses the correct saved plan. Test that consecutive opens and duplicate taps produce one plan and one completion.
- **Storage and activities.** Test persistence after process death, database migrations once a schema ships, interrupted vocabulary sessions, deck isolation, book position changes, mixed or invalid backup files, and restoration from a valid export. Test a feed timeout, malformed or duplicate entries, unavailable articles, and offline startup with and without cache.
- **UI and device checks.** Test onboarding, finishing and undoing an activity, editing while in a session, widget layout and day changes, deep links from stale widgets, notification permission denial, large text, dark mode, and TalkBack. Run local unit tests, lint, and instrumented tests before releasing the pilot build. Record exact commands in the README when the project is initialized.
- **Pilot measures.** Target a usable plan within a minute of first launch. On the next day, aim to see the plan and start an activity in one tap after opening Today or by tapping its widget row. As a starting measure of usefulness, look for at least one completed activity on five of seven pilot days and ask whether the plan saved decision time. Review frequent edits and skips as feedback about defaults. Keep these observations local.

## Decisions to settle during the design and pilot

1. What Android phone, Android version, and launcher will you use for the pilot?
2. Which languages, topics, and publishers should the shortlist cover? Should it lean toward local news, international news, or a mix?
3. What language should appear on the definition side of the vocabulary cards? Do you want Japanese reading help shown by default?
4. What book or audiobook will you start with, and do pages, minutes, or chapters feel easiest to record?
5. Do you want a morning reminder, and should weekends have different activities or a smaller budget?
6. Should 15–30 minutes be your default every day or vary by weekday?
7. Would you prefer a quiet weekly summary, a streak, or activity totals only?
8. After a week of use, which repeated problem would justify the first extension: finding free time, managing the plan on desktop, handling email follow-ups, or something else?
