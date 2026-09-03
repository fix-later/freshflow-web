# Feature Specification: Trợ lý AI chào trước và chốt đơn nháp

**Feature Branch**: `007-assistant-proactive-order` (spec only — no branch cut; the working tree carries unrelated in-progress work)

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "Trợ lý AI chủ động chào khi khách vừa vào storefront và đã chọn chợ (bong bóng gợi ý cạnh nút AI, bỏ qua được, chỉ hiện một lần mỗi phiên), và khi cuộc trò chuyện tạo được đơn nháp thì hiển thị thẻ đơn nháp trong khung chat để bấm sang trang thanh toán"

## Context

The storefront already ships an AI shopping assistant: a floating launcher in the
bottom-right corner and a chat panel behind it. Two things are missing, and both
are about the assistant meeting the buyer rather than waiting to be found:

1. It never speaks first. A restaurant that has just picked its chợ has to
   notice the launcher and decide, unprompted, that talking to it is worth a try.
2. When a conversation does produce an order, the buyer is told about it in prose
   only. The order the assistant assembled is a real draft the platform holds,
   but the chat offers no way to go and pay for it — the buyer has to leave the
   conversation and find the cart on their own.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Trợ lý chào khi vừa chọn chợ (Priority: P1)

An approved restaurant opens the storefront and picks (or already has) a chợ. A
short greeting bubble rises beside the assistant launcher, naming the chợ and
asking what the kitchen needs today, with two or three one-tap starters. Tapping
the bubble — or a starter — opens the chat with that question already asked.
Dismissing it puts the launcher back to how it always was.

**Why this priority**: It is the whole point of the request, and it is the half
that decides whether anyone uses the assistant at all. Shipped alone it already
delivers value: more buyers discover that the assistant can shop for them.

**Independent Test**: Sign in as an approved restaurant, choose a chợ, and load
any storefront page. The bubble appears once; tapping it opens the chat;
dismissing it hides it for the rest of the session.

**Acceptance Scenarios**:

1. **Given** an approved restaurant with a chợ selected, **When** they land on a
   storefront page and stay for a moment, **Then** a greeting bubble appears
   beside the assistant launcher naming that chợ.
2. **Given** the bubble is showing, **When** the buyer taps it, **Then** the chat
   panel opens and the bubble is gone.
3. **Given** the bubble is showing, **When** the buyer taps a suggested starter,
   **Then** the chat opens with that starter already sent as their first message.
4. **Given** the bubble is showing, **When** the buyer dismisses it, **Then** it
   does not reappear anywhere in the storefront for the rest of the browsing
   session.
5. **Given** no chợ has been chosen yet, **When** the buyer is on a storefront
   page, **Then** no bubble appears — the assistant shops one chợ's listings, so
   it has nothing to offer until one is picked.
6. **Given** a signed-out visitor or a restaurant still awaiting approval,
   **When** they browse the storefront, **Then** no bubble appears, matching the
   launcher's existing rule.

---

### User Story 2 - Đơn nháp hiện ngay trong khung chat (Priority: P1)

While chatting, the buyer asks for goods and the assistant assembles them into a
draft order. A card appears in the conversation naming that draft — what is in
it and what it comes to — with one action: go and pay for it. Taking that action
lands the buyer on checkout with the same order loaded.

**Why this priority**: Without it the conversation dead-ends. The draft exists on
the platform, and the buyer is left to go find it. It is independently testable
and shippable even if the greeting never ships.

**Independent Test**: In a conversation, ask for a product until the assistant
reports a draft; the card appears; pressing its action opens checkout showing the
same order.

**Acceptance Scenarios**:

1. **Given** an open conversation, **When** a turn produces a draft order, **Then**
   a draft card appears in the chat with the order's line count and total.
2. **Given** the draft card is showing, **When** the buyer presses its action,
   **Then** the checkout page opens with that same draft loaded, and the chat
   panel closes behind it.
3. **Given** a later turn adds more goods to the same draft, **When** the reply
   arrives, **Then** the card reflects the new contents rather than a second card
   appearing.
4. **Given** the assistant has prepared an order for confirmation (the existing
   two-phase confirm), **When** that card is on screen, **Then** the draft card
   does not compete with it — confirmation is the more advanced state and wins.
5. **Given** the draft the card names can no longer be loaded (cancelled,
   confirmed elsewhere, or gone), **When** the buyer presses the action, **Then**
   they are told plainly and the card stops offering the action.

---

### User Story 3 - Cuộc trò chuyện không mất khi tải lại trang (Priority: P1)

A buyer is mid-conversation — they have asked for goods, the assistant has
answered, an order is taking shape — and the page reloads: a refresh, a
navigation that reloads the app, a phone waking up. The conversation is still
there when they open the assistant again, and the next message continues it
rather than starting over.

**Why this priority**: The platform never lost the conversation — the server
stores it for half an hour and resumes it by session handle. Only the browser
forgot which handle it was holding, so a refresh threw away work the buyer had
already done and made them describe their order twice.

**Independent Test**: Say something to the assistant, reload the page, reopen the
panel — the exchange is still on screen and the next reply follows from it.

**Acceptance Scenarios**:

1. **Given** a conversation with at least one exchange, **When** the page is
   reloaded and the assistant is reopened, **Then** the same exchange is on
   screen.
2. **Given** that restored conversation, **When** the buyer sends the next
   message, **Then** the assistant answers in the context of what came before —
   it is the same conversation, not a new one that merely looks continuous.
3. **Given** a conversation that produced a draft order, **When** the page is
   reloaded, **Then** the draft card is shown again, with its figures re-read
   from the order rather than from anything stored.
4. **Given** a conversation older than the platform keeps (its server-side
   lifetime has passed), **When** the page is reloaded, **Then** the panel starts
   fresh rather than showing a history the assistant can no longer remember.
5. **Given** the buyer presses "start over", **When** the page is reloaded,
   **Then** nothing comes back — starting over means starting over.
6. **Given** the buyer signs out, **When** the next person uses that browser,
   **Then** none of the previous conversation is available to them.

---

### Edge Cases

-   **Chợ changes mid-session**: the bubble has already been shown, so it does not
    return; the conversation itself follows the new chợ, as it does today.
-   **Buyer is already chatting**: no bubble — it would be inviting someone into a
    room they are standing in.
-   **Small screens**: the bubble must not cover the launcher, the cart, or the
    page's own controls; on a narrow screen it sits above the launcher rather than
    beside it.
-   **The buyer never looks**: the bubble is not modal and never blocks anything;
    it stays until dismissed or until the chat is opened.
-   **Draft is empty**: a draft with no lines is not an offer to pay for — no card.
-   **Two tabs**: dismissing in one tab need not silence the other; the rule is per
    browsing session, and a duplicate in a second tab is acceptable.

## Requirements _(mandatory)_

### Functional Requirements

-   **FR-001**: The system MUST offer a proactive greeting beside the assistant
    launcher when, and only when, the viewer may use the assistant (an approved
    restaurant account) **and** a chợ is selected.
-   **FR-002**: The greeting MUST name the selected chợ, so it reads as an offer
    about today's market rather than generic chatter.
-   **FR-003**: The greeting MUST offer at least two one-tap starters that open the
    chat with that message already sent.
-   **FR-004**: The greeting MUST be dismissible, and once dismissed or acted on it
    MUST NOT appear again for the remainder of the browsing session.
-   **FR-005**: The greeting MUST NOT appear while the chat panel is open.
-   **FR-006**: The greeting MUST NOT block, cover or delay any other control on
    the page, and MUST be reachable and dismissable by keyboard.
-   **FR-007**: When a conversational turn reports a draft order, the system MUST
    show a draft card inside the conversation.
-   **FR-008**: The draft card MUST state what the draft holds — at least how many
    lines and what they come to — read from the order itself, never from the
    assistant's prose.
-   **FR-009**: The draft card MUST offer exactly one action: continue to checkout.
-   **FR-010**: Taking that action MUST open the checkout for that same draft, with
    the cart holding the draft's lines.
-   **FR-011**: Subsequent turns against the same draft MUST update the existing
    card rather than stack a new one.
-   **FR-012**: When an order awaiting the buyer's confirmation is on screen, the
    draft card MUST yield to it.
-   **FR-013**: If the draft cannot be read back, the card MUST say so and stop
    offering to continue, rather than sending the buyer to an empty checkout.
-   **FR-014**: All new wording MUST be available in Vietnamese and English.
-   **FR-015**: A conversation MUST survive a page reload — both what was said and
    the conversation's identity, so the next message continues it rather than
    starting a new one.
-   **FR-016**: A restored conversation MUST NOT outlive what the platform keeps on
    its side. Once the platform has forgotten the conversation, the panel MUST
    start fresh rather than display a history the assistant cannot remember.
-   **FR-017**: A restored draft MUST be re-read from the order, never rendered
    from stored figures.
-   **FR-018**: Starting over, and signing out, MUST leave nothing for a later
    visitor to this browser to find.

### Key Entities

-   **Greeting nudge**: a transient, per-session invitation attached to the
    assistant launcher. Holds the chợ it was raised for, its starters, and whether
    it has been shown or dismissed. Not persisted beyond the browsing session.
-   **Assistant draft order**: an order the assistant assembled and the platform
    already holds, identified by the conversation's reply. Not confirmed, not paid;
    the same kind of draft the cart works with.

## Success Criteria _(mandatory)_

### Measurable Outcomes

-   **SC-001**: An approved restaurant with a chợ selected sees the greeting within
    three seconds of the page settling, on every storefront page, once per session.
-   **SC-002**: From the greeting, a buyer reaches an open conversation with a
    question asked in one tap.
-   **SC-003**: From a draft the assistant built, a buyer reaches checkout for that
    order in one tap, without leaving the conversation to look for the cart.
-   **SC-004**: The greeting never appears for viewers who cannot use the assistant
    (signed out, not a restaurant, awaiting approval) or with no chợ selected — 0
    occurrences.
-   **SC-005**: Dismissing the greeting hides it for the rest of the session — 0
    reappearances across page navigations.

## Assumptions

-   The existing assistant endpoint already reports the draft order it built, and
    the existing launcher already knows who may use the assistant; both are reused
    rather than re-decided by this feature.
-   "Browsing session" means the current tab's lifetime. Nothing about the greeting
    is stored across a reload — a fresh visit may greet again. (Superseded in part
    by User Story 3: the _conversation_ now does survive a reload. The greeting
    deliberately does not, because greeting someone who has just refreshed the page
    they were already on is not an introduction.)
-   The starters are fixed, translated phrases, not generated: they must read well
    in both languages and must not promise capabilities the assistant lacks.
-   Checkout continues to work from the buyer's single open draft order, so
    "continue to checkout" means adopting that draft as the cart rather than
    introducing a second checkout path.
-   The greeting is storefront-only. Admin and operator consoles do not show the
    assistant and are out of scope.
