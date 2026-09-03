# Contracts: Trợ lý AI chào trước và chốt đơn nháp

No API is added or changed. This records the contracts the feature depends on and
the ones it introduces between parts of the client.

## 1. Backend contracts consumed (unchanged)

### `POST /api/v1/assistant/chat`

Already implemented (`AssistantController`), `[Authorize(Roles = "restaurant")]`,
rate-limited. Response fields this feature relies on:

| Field                 | Type             | Contract                                                                                                                                                         |
| --------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `draftOrderId`        | `string \| null` | The draft order the turn assembled, if any. **Newly consumed by the web.** The client treats it as an id only — every figure shown comes from reading the order. |
| `pendingConfirmation` | object \| null   | Unchanged. Outranks the draft card in the panel.                                                                                                                 |
| `reply`, `sessionId`  | string           | Unchanged.                                                                                                                                                       |

**Invariant preserved**: `confirmOrderId` is set by the confirmation button and by
nothing else. This feature never sets it — its action navigates to checkout.

### `GET /api/v1/orders/{orderId}`

Read once per new `draftOrderId` for the card's line count and total. A 404 or an
empty body puts the card in its unreadable state rather than sending the buyer to
checkout for an order that is not there.

## 2. Client contracts introduced

### `AssistantService` (extended)

```ts
/** The greeting has been offered and answered — never offer it again this tab. */
readonly nudgeSpent: Signal<boolean>;

/** A starter phrase the panel should send when it opens. One-shot. */
readonly pendingStarter: Signal<string | null>;

/** Opens the chat and, when given a phrase, asks it as the first message. */
openWith(starter?: string): void;

/** Closes the greeting without opening the chat. */
dismissNudge(): void;

/** Consumes `pendingStarter`, returning it once and clearing it. */
takeStarter(): string | null;
```

### `DraftOrderService.adopt` (existing — reused, not added)

```ts
/** Points the cart at a different draft and reads it back. Queued; returns void. */
adopt(orderId: string): void;
```

The cart already had exactly this, and checkout already calls it — a changed
delivery date forces a new draft, because `scheduledFor` is fixed at creation.
So the assistant reuses it rather than adding a second way to do the same thing.

**Precondition**: the caller holds an order id the server reported for this
restaurant. `adopt` does not create orders and does not confirm them.

**Postcondition**: the cart's `orderId` is that order and its lines are the
order's lines — the same state `restore()` leaves behind, so checkout, the cart
drawer and the cart page all read it without knowing where it came from.

**Reading the outcome**: `adopt` reports nothing, so the caller checks the way
the cart itself records it — `_reload` drops the order id when the order cannot
be read, so after `settled()`, `orderId() === the adopted id` means it held.

### Nudge → panel

The nudge never touches the panel's internals. It calls `openWith(starter)`; the
panel drains `takeStarter()` when it opens and sends the phrase as an ordinary
user turn. This keeps one path into the conversation — the same one the composer
uses — so a starter cannot bypass anything a typed message goes through.

## 3. Translation keys added

| Key                               | Purpose                                             |
| --------------------------------- | --------------------------------------------------- |
| `assistant.nudge.title`           | The greeting question, interpolating the chợ's name |
| `assistant.nudge.lead`            | One line saying what the assistant can do           |
| `assistant.nudge.starter.restock` | Starter: order today's usual goods                  |
| `assistant.nudge.starter.browse`  | Starter: what is fresh at this chợ today            |
| `assistant.nudge.dismiss`         | Close the greeting (aria-label + tooltip)           |
| `assistant.draft.title`           | Draft card heading                                  |
| `assistant.draft.summary`         | "{{count}} mặt hàng · {{total}}"                    |
| `assistant.draft.checkout`        | The card's single action                            |
| `assistant.draft.unreadable`      | The draft could not be opened                       |

All present in both `public/i18n/vi.json` and `public/i18n/en.json` (Constitution V).
