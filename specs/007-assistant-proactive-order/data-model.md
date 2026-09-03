# Data Model: Trợ lý AI chào trước và chốt đơn nháp

Phase 1. Nothing here is persisted and nothing new is stored on the server. These
are the view-level shapes the feature adds, and the existing records they read.

## New (client, in memory)

### NudgeState — held by `AssistantService`

| Field            | Type                     | Meaning                                                                                                           |
| ---------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `nudgeSpent`     | `signal<boolean>`        | The greeting has been shown-and-acted-on or dismissed. Once true it stays true for the tab.                       |
| `pendingStarter` | `signal<string \| null>` | A starter phrase the panel should send as the buyer's first message when it opens. One-shot: the panel drains it. |

**Derived (in the nudge component)** — the bubble shows only when _all_ hold:

1. the launcher is available (approved restaurant — the launcher's own rule),
2. a chợ is selected,
3. the chat panel is closed,
4. `nudgeSpent` is false.

**Transitions**: `open()` → chat opens, `nudgeSpent = true`.
`start(phrase)` → `pendingStarter = phrase`, chat opens, `nudgeSpent = true`.
`dismiss()` → `nudgeSpent = true`, chat stays closed.
There is no transition back: the greeting is offered once per tab.

### AssistantDraft — held by `QuickBuyComponent`

| Field        | Type             | Meaning                                                                           |
| ------------ | ---------------- | --------------------------------------------------------------------------------- |
| `id`         | `string`         | The draft order the assistant built (`draftOrderId` from the reply).              |
| `itemCount`  | `number`         | Lines on the order, read from the order.                                          |
| `total`      | `number \| null` | The order's total, read from the order. `null` when the order carries none.       |
| `unreadable` | `boolean`        | The order could not be read back; the card says so and offers no action (FR-013). |

**Validation**: an id with zero lines is not shown (edge case: empty draft).
The card is hidden entirely while a `pendingConfirmation` is on screen (FR-012).

## Existing records this feature reads

### Assistant reply (`POST /api/v1/assistant/chat` → `AssistantChatResponse`)

| Field                 | Used for                                                          |
| --------------------- | ----------------------------------------------------------------- |
| `reply`               | Unchanged — the message bubble.                                   |
| `draftOrderId`        | **Newly consumed.** Identifies the order the card describes.      |
| `pendingConfirmation` | Unchanged — the confirmation card, which outranks the draft card. |
| `sessionId`           | Unchanged.                                                        |

### Order (`GET /api/v1/orders/{id}` → `OrderRow`)

| Field                        | Used for               |
| ---------------------------- | ---------------------- |
| `itemCount` / `items.length` | The card's line count. |
| `totalAmount`                | The card's total.      |
| _(absent / 404)_             | Drives `unreadable`.   |

### Market selection (`MarketSelectionService`)

| Field            | Used for                                                                  |
| ---------------- | ------------------------------------------------------------------------- |
| `selected()`     | The chợ's name, so the greeting names the market it is offering (FR-002). |
| `hasSelection()` | Raise condition 2.                                                        |

## Relationships

```text
AssistantService ──raises──> Nudge ──opens──> QuickBuy panel
                                   └─starter─> first message

QuickBuy panel ──draftOrderId──> Order (read) ──> AssistantDraft card
                                                      │
                                                      └─adopt(id)─> DraftOrderService ──> /checkout
```

The cart is the single source of truth for what checkout shows, before and after
this feature. `adopt(orderId)` is the only new way into it, and it points at an
order id the server itself reported.
