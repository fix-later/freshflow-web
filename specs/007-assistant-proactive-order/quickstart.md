# Quickstart: Trợ lý AI chào trước và chốt đơn nháp

## Run it

```bash
npm start                 # or: npm start -- --port 4300
```

Sign in as an **approved restaurant** — both halves are gated on that, the same
way the assistant launcher already is — and pick a chợ in the header.

## Verify Story 1 — the greeting

1. Load any storefront page (`/`, `/catalog`, a product page).
2. Within a moment a bubble rises beside the assistant launcher, bottom-right,
   naming the chợ you picked.
3. Press a starter → the chat opens with that question already asked.
4. Reload, dismiss the bubble with its close control → navigate to another
   storefront page → it does not come back.

Should **not** appear: signed out, signed in as anything but a restaurant, a
restaurant still awaiting approval, no chợ picked, or while the chat is open.

## Verify Story 2 — the draft card

1. Open the chat and ask for goods until the assistant reports it has built an
   order (e.g. _"đặt 20kg cải ngọt"_).
2. A draft card appears under the conversation with the line count and total —
   compare them with the cart; they are read from the order, not the reply.
3. Press its action → checkout opens with that order loaded.
4. Ask for more in the same conversation → the same card updates; a second card
   does not appear.

## Verify the gates still hold

-   The confirmation card (the assistant's two-phase confirm) still shows its own
    button, and while it is up the draft card is not.
-   Nothing but that button sends `confirmOrderId` — the draft card navigates, it
    does not place orders.

## Automated checks

```bash
npm run precheck          # lint → prettier → contrast → unit tests → prod build
```

New unit tests:

-   `assistant-nudge.spec.ts` — raise conditions, dismissal being permanent for the
    session, starter hand-off.
-   `quick-buy.draft.spec.ts` — the card appears on a draft id, updates rather than
    stacks, yields to a pending confirmation, and degrades when the order cannot be
    read.
