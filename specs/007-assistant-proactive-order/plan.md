# Implementation Plan: Trợ lý AI chào trước và chốt đơn nháp

**Branch**: `dev` (no feature branch cut — see Deviations) | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-assistant-proactive-order/spec.md`

## Summary

Two additions to the assistant that already ships, both on the web client only:

1. **A greeting nudge.** A dismissible bubble beside the existing launcher,
   raised once per tab when an approved restaurant has a chợ selected. It names
   the chợ and offers one-tap starters that open the chat with the question
   already asked.
2. **A draft-order card.** `POST /api/v1/assistant/chat` already returns
   `draftOrderId`, and the panel throws it away today. The panel will read that
   order back, show what it holds, and offer one action: adopt it as the cart
   and open checkout.

No backend work. No new endpoints. The draft the assistant builds is an ordinary
draft order, so checkout needs no second path — the cart is pointed at it.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Angular 22 standalone + signals

**Primary Dependencies**: Angular Material 22, Transloco, existing
`AssistantService` (`POST /api/v1/assistant/chat`), `DraftOrderService`,
`OrdersService`, `MarketSelectionService`, `PermissionsService`

**Storage**: None persisted. The nudge's shown/dismissed flag lives in memory for
the tab's lifetime, matching the conversation itself, which is also in-memory.

**Testing**: Jasmine + Karma unit tests beside the components they cover

**Target Platform**: Storefront (enterprise layout) — desktop and mobile web

**Project Type**: Web client (this repo). Backend unchanged.

**Performance Goals**: The nudge must not delay first paint; it is raised after
the page settles and renders no network call of its own. The draft card costs one
`GET /orders/{id}` per turn that reports a new draft id.

**Constraints**: Bilingual (vi/en) — no hardcoded strings. Nudge must never cover
the launcher, the cart or page controls, and must be keyboard-reachable and
dismissible. Nothing may set `confirmOrderId` (the two-phase confirm gate stands
untouched).

**Scale/Scope**: Two view components, one service method, one cart method, ~10
translation keys.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle                         | Verdict | How                                                                                                                      |
| --------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| I. Angular-first, signal-driven   | PASS    | Standalone components, `signal`/`computed`/`effect`; no NgModule; the nudge lives in the layout, which is already loaded |
| II. Real-time by default          | N/A     | Nothing here is pushed; the draft card refreshes on the turn that changes it                                             |
| III. Type safety (non-negotiable) | PASS    | Draft facts read from the typed order row; no `any`; `draftOrderId` already typed on `AssistantReply`                    |
| IV. Test before merge             | PASS    | Unit tests for the nudge's raise/dismiss rules and the card's state; whole change goes through `npm run precheck`        |
| V. Bilingual UX                   | PASS    | Every new string is a Transloco key in vi + en                                                                           |
| VI. Performance budget            | PASS    | No new dependency; two small components; one extra GET per new draft                                                     |
| Domain: credit/debt, not prepaid  | PASS    | "Continue to checkout" opens the existing credit checkout; no payment path is introduced                                 |
| Domain: approval gate             | PASS    | The nudge reuses the launcher's own gate (`restaurant` + approved)                                                       |

No violations — Complexity Tracking is omitted.

## Project Structure

### Documentation (this feature)

```text
specs/007-assistant-proactive-order/
├── spec.md
├── plan.md              # This file
├── research.md          # Decisions taken before building
├── data-model.md        # View-level entities
├── quickstart.md        # How to run and verify
├── contracts/
│   └── assistant-ui.md  # Fields consumed, and the UI contract between parts
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/app/layout/common/quick-buy/
├── assistant-fab.component.{ts,html,scss}     # launcher — hosts the nudge
├── assistant-nudge.component.{ts,html,scss}   # NEW: the greeting bubble
├── assistant-nudge.spec.ts                    # NEW: raise / dismiss rules
├── assistant.service.ts                       # + nudge state, + starter hand-off
├── quick-buy.component.{ts,html,scss}         # + draft card
└── quick-buy.draft.spec.ts                    # NEW: draft card state

src/app/layout/common/draft-order/
└── draft-order.service.ts                     # unchanged — its adopt() is reused

public/i18n/{vi,en}.json                       # + assistant.nudge.*, assistant.draft.*
```

**Structure Decision**: Everything lands in the existing
`layout/common/quick-buy` feature folder, beside the assistant it extends, plus
one method on the cart service that owns draft adoption. No new routes and no new
module: the launcher is already mounted by the storefront layout, so the nudge
reaches every storefront page by living inside it.

## Approach

### Story 1 — the greeting nudge

-   `AssistantService` gains the nudge's state: whether it may be raised, and a
    `dismiss()` that closes it for the tab. Kept on the service, not the component,
    because the launcher unmounts and remounts as the layout re-renders and the
    rule is "once per session", not "once per mount".
-   `AssistantNudgeComponent` renders the bubble: the chợ's name, the question, the
    starters, and a close control. It is rendered by `AssistantFabComponent`, which
    already knows the corner and the `raised` offset when the scroll-to-top control
    shares it.
-   Raise conditions, all required: the launcher is available (approved
    restaurant), a chợ is selected, the chat is closed, and the nudge has not been
    shown or dismissed this session. Opening the chat or dismissing sets the flag.
-   A starter opens the chat and sends its text as the buyer's first message —
    `AssistantService` carries a one-shot `pendingStarter` the panel drains when it
    opens, so the nudge never has to reach into the panel.

### Story 2 — the draft-order card

-   `_turn()` already stores `pendingConfirmation`; it also gets `draftOrderId`.
    When that id is new, the panel reads the order (`OrdersService.getOrder`) and
    keeps `{ id, itemCount, total }` — the figures come from the order, never from
    the reply text (FR-008).
-   The card renders under the conversation, beneath the confirmation card and
    hidden while one is up (FR-012).
-   Its single action calls `DraftOrderService.adopt(orderId)` — which already
    existed for checkout's own date-change path — and deliberately not
    `restore()`, which finds "the newest draft in today's session" and would only
    work by luck. Then it closes the panel and routes to `/checkout`.
-   A draft that cannot be read back leaves the card in a "không mở được" state
    with the action gone (FR-013).

## Deviations

| Deviation                                              | Why                                                                                                                                                                               |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No feature branch (`speckit.git.feature` hook skipped) | The working tree holds unrelated in-progress UI work; a branch switch would carry all of it onto the feature branch. The spec-first requirement (spec exists before code) is met. |
