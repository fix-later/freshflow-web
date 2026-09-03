---
description: 'Task list for 007-assistant-proactive-order'
---

# Tasks: Trợ lý AI chào trước và chốt đơn nháp

**Input**: Design documents from `/specs/007-assistant-proactive-order/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Included. The constitution makes the unit-test + build gate a merge
requirement (IV), and both stories carry rules that are cheaper to hold with a
test than with a screenshot — "once per session" and "yields to the confirmation
card" in particular.

**Organization**: Grouped by user story. All three stories are P1 and
independent: any one can ship without the others. US3 was added after the first
two shipped, when a reload turned out to throw away a conversation the platform
had kept all along.

## Format: `[ID] [P?] [Story] Description`

-   **[P]**: Can run in parallel (different files, no dependency on incomplete work)
-   **[Story]**: [US1] greeting nudge · [US2] draft-order card
-   Paths are repository-relative (`freshflow-web/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Nothing to scaffold — the assistant, its launcher, the cart and the
checkout route all exist. This phase only pins down the words both stories need.

-   [x] T001 [P] Add `assistant.nudge.*` keys (title, lead, starter.restock, starter.browse, dismiss) to `public/i18n/vi.json` and `public/i18n/en.json`
-   [x] T002 [P] Add `assistant.draft.*` keys (title, summary, checkout, unreadable) to `public/i18n/vi.json` and `public/i18n/en.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The two seams both stories hang off. Must land before either story's
view work.

-   [x] T003 Extend `AssistantService` in `src/app/layout/common/quick-buy/assistant.service.ts` with `nudgeSpent`, `pendingStarter`, `openWith(starter?)`, `dismissNudge()` and `takeStarter()` per [contracts/assistant-ui.md](./contracts/assistant-ui.md)
-   [x] T004 [P] ~~Add `adopt(orderId)` to `draft-order.service.ts`~~ — **not needed**: the cart already has `adopt(orderId)` (checkout uses it when a date change forces a new draft). Reused as-is; the caller verifies via `settled()` + `orderId()`

**Checkpoint**: The service seams exist and compile; no visible change yet.

---

## Phase 3: User Story 1 — Trợ lý chào khi vừa chọn chợ (Priority: P1)

**Goal**: An approved restaurant with a chợ selected is greeted once per tab,
beside the launcher, and can enter the conversation in one tap.

**Independent test**: Sign in as an approved restaurant, pick a chợ, load a
storefront page — the bubble appears, a starter opens the chat with that question
asked, and dismissing it keeps it away for the rest of the session.

-   [x] T005 [US1] Create `src/app/layout/common/quick-buy/assistant-nudge.component.ts` — standalone, OnPush, computes the raise conditions (launcher available, chợ selected, chat closed, `nudgeSpent` false)
-   [x] T006 [US1] Create `src/app/layout/common/quick-buy/assistant-nudge.component.html` — chợ-named question, lead line, starter buttons, close control with `aria-label`
-   [x] T007 [US1] Create `src/app/layout/common/quick-buy/assistant-nudge.component.scss` — bubble with a tail pointing at the launcher; stacks above the launcher on narrow screens; never overlaps it (FR-006)
-   [x] T008 [US1] Render the nudge from `src/app/layout/common/quick-buy/assistant-fab.component.html`, carrying the existing `raised` offset so it clears the scroll-to-top control
-   [x] T009 [US1] Drain `takeStarter()` when the panel opens in `src/app/layout/common/quick-buy/quick-buy.component.ts` and send it through the same path a typed message takes
-   [x] T010 [P] [US1] Add `src/app/layout/common/quick-buy/assistant-nudge.spec.ts` — covers: hidden without a chợ, hidden for a non-restaurant/unapproved viewer, hidden while the chat is open, shown once, dismissal permanent for the session, starter hand-off

**Checkpoint**: Story 1 is independently demonstrable.

---

## Phase 4: User Story 2 — Đơn nháp hiện ngay trong khung chat (Priority: P1)

**Goal**: A conversation that builds an order ends in one tap to checkout.

**Independent test**: Ask for goods until the assistant reports a draft — the card
shows the order's own line count and total, and its action opens checkout with
that order loaded.

-   [x] T011 [US2] Hold the draft in `src/app/layout/common/quick-buy/quick-buy.component.ts`: on a turn reporting a new `draftOrderId`, read it with `OrdersService.getOrder` and keep `{ id, itemCount, total, unreadable }` (data-model.md)
-   [x] T012 [US2] Render the draft card in `src/app/layout/common/quick-buy/quick-buy.component.html` under the conversation, hidden while `pending()` is set (FR-012), with one action and the unreadable state (FR-013)
-   [x] T013 [US2] Style the card in `src/app/layout/common/quick-buy/quick-buy.component.scss` to match the existing confirmation receipt card
-   [x] T014 [US2] Wire the action in `quick-buy.component.ts`: `adopt(id)` → close the panel → `router.navigate(['/checkout'])`; on a failed adopt, mark the card unreadable rather than navigating
-   [x] T015 [P] [US2] Add `src/app/layout/common/quick-buy/quick-buy.draft.spec.ts` — covers: card appears on a draft id, updates instead of stacking, hidden while a confirmation is pending, unreadable when the order read fails, and that the action never sends `confirmOrderId`

**Checkpoint**: Story 2 is independently demonstrable.

---

## Phase 5: Polish & Cross-Cutting

-   [x] T016 Verify both flows in the running app per [quickstart.md](./quickstart.md), including the negative cases (signed out, unapproved, no chợ)
-   [x] T017 Run `npm run precheck` (lint → Prettier → contrast → unit tests → production build) and fix anything it reports

---

## Dependencies

```text
T001, T002 (words)          ─┐
T003 (assistant seam)       ─┼─> US1: T005 → T006 → T007 → T008 → T009, T010
T004 (cart adopt)           ─┴─> US2: T011 → T012 → T013 → T014, T015
                                  └─> T016 → T017
```

-   **US1 needs**: T001, T003
-   **US2 needs**: T002, T004
-   **US1 and US2 do not depend on each other** — either is a shippable increment.

## Parallel Opportunities

-   T001 ∥ T002 (different key groups, same two files — apply in one pass)
-   T003 ∥ T004 (different services)
-   T010 ∥ T015 (different spec files)
-   With two people: one takes US1 (T005–T010), the other US2 (T011–T015), after
    Phase 2 lands.

## Implementation Strategy

**MVP**: Phase 1 + 2 + Story 2 (T011–T015). The draft card is the half that
unblocks a conversation that already works today; the greeting is the half that
brings more buyers into it. Shipping Story 2 first means no buyer who reaches a
draft gets stranded.

**Then**: Story 1, which is pure discovery and safe to iterate on.

---

## Phase 6: User Story 3 — Cuộc trò chuyện không mất khi tải lại trang (Priority: P1)

**Goal**: A reload comes back to the same conversation, and the next message
continues it rather than starting over.

**Independent test**: Say something, reload, reopen the panel — the exchange is
still there and the next reply follows from it.

-   [x] T018 [US3] Persist the session handle, transcript and draft id in `src/app/layout/common/quick-buy/assistant.service.ts` (`sessionStorage`, stamped, TTL matched to the server's 30-minute conversation lifetime) with `restoredMessages()`, `restoredDraftOrderId()`, `persist()` and `forget()`
-   [x] T019 [US3] Seed `messages` from the restored transcript and write it back as it grows, in `src/app/layout/common/quick-buy/quick-buy.component.ts`
-   [x] T020 [US3] Re-read a restored draft on first open (not on every page load) and clear the stored copy on start-over and on sign-out
-   [x] T021 [P] [US3] Add `src/app/layout/common/quick-buy/assistant-session.spec.ts` — restore, TTL expiry, empty transcript, start-over, sign-out, corrupted copy

**Checkpoint**: A reload no longer costs the buyer their conversation.
