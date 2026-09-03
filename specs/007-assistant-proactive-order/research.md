# Research: Trợ lý AI chào trước và chốt đơn nháp

Phase 0. Every question below was settled before writing code; nothing in the
Technical Context is left as NEEDS CLARIFICATION.

## D1 — How proactive should the greeting be?

**Decision**: A dismissible bubble beside the existing launcher, raised once per
tab, with one-tap starters.

**Rationale**: It is the only option that both gets noticed and leaves the page
usable. The buyer is mid-task on a storefront — browsing a chợ's listings — and
the assistant is an offer, not an interruption.

**Alternatives considered**:

-   _Auto-open the chat panel._ Most proactive, and the one most likely to be
    closed on reflex: it covers the listings the buyer came for, and it has to be
    dismissed on every visit before they can shop.
-   _An invitation block inside the home page._ Least intrusive, but it is only on
    the home page — the moment the buyer is in the catalogue, where the assistant is
    most useful, it is gone.

**Chosen by the requester** when the two decisions were put to them.

## D2 — Where does the "shown once" flag live?

**Decision**: In `AssistantService`, in memory, for the tab's lifetime. Not
`localStorage`, not `sessionStorage`.

**Rationale**: The conversation itself is already in-memory — `AssistantService`
mints a session id per tab and a reload starts a fresh conversation. A greeting
that remembered across reloads while the conversation did not would be the odd
one out. Component-local state would not survive the launcher re-rendering as the
layout changes, which is the wrong granularity for "once per session".

**Alternatives considered**: `sessionStorage` — survives a reload within the tab.
Rejected as inconsistent with the conversation lifetime, and it makes the rule
harder to test than a signal.

## D3 — Where do the draft's figures come from?

**Decision**: Read the order back with `OrdersService.getOrder(draftOrderId)` and
show its own line count and total.

**Rationale**: FR-008. The reply is model prose; the order is a record. A card
that quoted the model could tell the buyer a total the order does not hold. One
GET per new draft id is a cheap price for a figure that is true.

**Alternatives considered**: Parse the figures out of the reply text — rejected
outright. Show the card with no figures — rejected: "an order is ready" with no
contents is not enough to decide on.

## D4 — How does the draft become the thing checkout shows?

**Decision**: Add `DraftOrderService.adopt(orderId)` — point the cart at that
exact draft and reload its lines — then navigate to `/checkout`.

**Rationale**: Checkout renders the cart, and the cart is backed by one open draft
order. The assistant's draft is an ordinary draft order for the same restaurant,
so the shortest honest path is to point the cart at it. `adopt` is three lines on
top of machinery that already exists (`_orderId` + `_reload()`).

**Alternatives considered**:

-   _Call the existing `restore()`._ It finds "the newest draft created in today's
    open session". Right answer by luck most of the time, wrong the moment the buyer
    already had a cart draft or the session-day check disagrees. A feature that
    works by coincidence is not built.
-   _Pass the order id to checkout as a route parameter._ Would fork checkout into
    two sources of truth — the cart, and a URL. Rejected.

## D5 — What do the starters say?

**Decision**: Fixed, translated phrases; no generated suggestions.

**Rationale**: A starter is a promise about what the assistant can do. Generated
ones would need a round trip before the bubble could even appear, and could
promise something the assistant cannot do. Fixed phrases can be checked in both
languages and reviewed like any other copy.

## D6 — Does the nudge interact with the confirm gate?

**Decision**: No. Nothing in this feature sets `confirmOrderId`.

**Rationale**: The two-phase gate (T4) is the reason nothing the model says can
place an order. The draft card's action navigates to checkout — where the buyer
confirms — and the confirmation card keeps its existing, separate button. The
draft card yields to the confirmation card when both could show (FR-012), so the
buyer is never offered two different ways to finish one order.

## D7 — Where does a conversation live across a reload? _(added with US3)_

**Decision**: The handle and the transcript go in `sessionStorage`, stamped with
the time they were written, and are restored only while that stamp is inside the
platform's own 30-minute conversation lifetime.

**Rationale**: The platform already stores conversations — Postgres, keyed by
session handle, owned by user id, 30-minute sliding TTL, last 20 turns
(`DbConversationStore`) — and resumes one when a request arrives carrying its
handle. Nothing was ever lost server-side; the browser simply minted a new handle
on every load. Keeping the handle is therefore the whole fix for continuity, and
the transcript is stored beside it only because the API exposes no way to read
the turns back.

Both sides are held to the same clock deliberately. Restoring a transcript the
server had already dropped would put words on screen the assistant cannot
remember saying — a history that lies about what the next message is answered
against.

`sessionStorage`, not `localStorage`: this is a tab's conversation, it names what
a restaurant is buying, and on a shared machine it has no business outliving the
tab it was typed in. It is cleared on sign-out and on "start over" too.

**Alternatives considered**:

-   _Add a read endpoint and restore the turns from the server._ The honest single
    source of truth, and it would carry a conversation between devices. Rejected
    for now: a backend change for something the browser can answer on its own, and
    what it would return is exactly what this browser already drew.
-   _`localStorage`._ Survives closing the tab. Rejected: a longer life than the
    server gives the conversation, and a shared terminal would keep one buyer's
    order talk for the next person.
