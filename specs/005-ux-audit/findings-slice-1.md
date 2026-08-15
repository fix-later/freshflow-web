# Slice 1 findings — M1 (auth / approval gate) + M5 (orders, checkout)

Run: 20 scenarios / 25 runs (desktop 1440×900, mobile 390×844), ~100s.
Harness: [`scripts/ux-audit`](../../scripts/ux-audit); method in [`README.md`](./README.md).

Every finding names the rule it breaks and the file to change. Severity is by business
consequence, not by how it looks.

---

## High — the UI contradicts a business rule

### F-01 · Cancel is offered on an order that is already batched

**Breaks** BR-ORD-4 (cancel only in `DRAFT` / `CONFIRMED` **before batching**), BR-PROC-1.
**Where** [`orders.types.ts:151`](../../src/app/modules/orders/orders.types.ts#L151) —
`ORDER_NOT_CANCELLABLE_STATUSES` is `{processing, in_transit, delivered}`. The same set is
duplicated at [`admin/orders/orders-list.component.ts:103`](../../src/app/modules/admin/orders/orders-list.component.ts#L103).
**Consequence** `batched`, `at_hub` and `ready_for_pickup` all still render "Hủy đơn hàng".
Once BR-PROC-1 has aggregated the order into a batch and manifest, that button either dies at
the server — a dead action the spec says to hide, not offer — or succeeds and leaves the batch
holding an order that no longer exists.
**Evidence** `M5-06`: status pill "Đã gộp phiên", cancel button present.

### F-02 · Cancelling does not require a reason

**Breaks** BR-ORD-4 ("a cancellation reason is required").
**Where** [`order-detail.component.ts:112`](../../src/app/modules/orders/pages/order-detail/order-detail.component.ts#L112)
— the `reason` control carries only `trimmedMaxLengthValidator(500)`; `cancelOrder(id, reason || undefined)`
then sends nothing at all.
**Evidence** `M5-08` probe: submitted empty, `PATCH /orders/{id}/cancel` left the browser, toast
"Đã hủy đơn hàng."
**Decide before fixing** BR-ORD-4 says required; `CancelOrderRequest.reason` in the OpenAPI
snapshot is optional (`maxLength: 500`). One of the two is wrong — this is a gap to resolve with
the backend, not a validator to add unilaterally.

### F-03 · A suspended restaurant is told nothing, anywhere

**Breaks** BR-AUTH-1, SCREEN_RULES §Required states · Permission ("approval-gated actions show
an inline explanation").
**Where** [`permissions.service.ts`](../../src/app/core/auth/permissions/permissions.service.ts)
— `isPendingApproval` is true only for `pending`, and
[`approval-banner.component.ts`](../../src/app/core/auth/components/approval-banner.component.ts)
renders on that alone. `toApprovalStatus` folds `suspended` → `rejected`, so `isApproved()` is
correctly false and ordering is blocked — silently.
**Consequence** A suspended account browses a normal-looking catalogue, adds to cart, and finds
out at the confirm attempt. The one state whose copy must _not_ promise ordering will resume is
the state with no copy at all.
**Evidence** `M1-04`: catalogue renders with no notice; compare `M1-02` (pending), which does.

### F-04 · Checkout bounces to the cart on reload, deep link or new tab

**Breaks** SCREEN_RULES §Required states · Loading — the screen decides before its data arrives.
**Where** [`checkout.component.ts:248`](../../src/app/modules/cart/checkout.component.ts#L248) —
`ngOnInit` reads `this.lines().length` synchronously, but the cart _is_ a server-side draft
fetched afterwards (`GET /orders?status=draft`, see
[`draft-order.service.ts`](../../src/app/layout/common/draft-order/draft-order.service.ts)).
**Consequence** Every reload of `/checkout`, every back-forward, every shared or bookmarked link
drops a buyer with a full cart back to `/cart`. Only click-through from the cart works.
**Evidence** `M5-14`: `/checkout` → `/cart` with a two-line draft stubbed and rendering fine on
the cart page one step later.

### F-05 · A pending restaurant reaches checkout with no gate copy

**Breaks** BR-AUTH-1, SCREEN_RULES §Required states · Permission.
**Where** `approval-banner` is placed on `/catalog` and the business-profile form only — not on
`/cart` or `/checkout`. `PermissionsService.canPlaceOrders()` exists and is **called from
nowhere** in the app.
**Consequence** The gate is written and not wired. A pending account completes address, date,
slot and notes, then is refused by the server preview.
**Evidence** `M5-13`.

---

## Medium — the state is handled, but not the way the spec asks

### F-06 · The order list shows a progress bar over an empty region

**Breaks** SCREEN_RULES §Required states · Loading ("skeletons for tables/cards, not spinners").
**Where** [`orders-list.component.html:2`](../../src/app/modules/orders/orders-list.component.html#L2).
**Also** the paginator renders during load with no rows above it, so the layout jumps when data
lands.
**Evidence** `M5-01` (response held 6s, captured at 2.5s).

### F-07 · The confirm CTA stays fully enabled while a blocker is displayed

**Breaks** SCREEN_RULES §Forms ("disable submit until valid"); BR-CRE-2 partially.
**Where** [`checkout.component.html:365`](../../src/app/modules/cart/checkout.component.html#L365).
**Consequence** The panel says "Chưa thể xác nhận đơn hàng này — Đơn này vượt quá hạn mức công nợ
còn lại" and directly under it "Đặt hàng" sits as a full-strength primary. The refusal message
itself is good and specific; the button contradicts it.
**Second half** `remainingCreditAfter` comes back on the preview (−1,250,000₫ in the fixture) and
is never shown. BR-CRE-2 wants the buyer to see the balance against the limit, not only a "no".
**Evidence** `M5-12`.

### F-08 · `aria-expanded` on a plain anchor — axe **critical**, 18 of 25 runs

**Where** [`storefront-nav-row.component.html:26`](../../src/app/layout/common/storefront-header/storefront-nav-row.component.html#L26)
— `<a [matMenuTriggerFor]="branchMenu">` with no `href` and no `role`. Material adds
`aria-haspopup="menu"` and `aria-expanded`, neither of which is allowed on a bare `<a>`.
**Consequence** Present on every storefront screen. Fix is `role="button"` + `tabindex="0"`, or
make it a `<button>`.

### F-09 · Header icon button with no accessible name — axe **critical**, mobile only

**Where** [`notifications.component.html:3`](../../src/app/layout/common/notifications/notifications.component.html#L3)
— `<button mat-icon-button>` with no `aria-label` and no text.

### F-10 · The out-of-stock product name fails AA — 3.52 : 1

**Relates to** BR-PRI-1 (a quantity-0 listing stays **visible**).
**Where** [`product-card.component.scss:449`](../../src/app/shared/product-card/product-card.component.scss#L449)
— `opacity: 0.55` on `.ff-product-card__name` for `--out` / `--inactive`, giving #838993 on
#ffffff at 16px bold. The comment says "stay readable but visibly dimmed"; at 3.52:1 it is the
second half only.
**Note** `npm run check:contrast` cannot see this — the failure is produced by a runtime opacity,
not by a token pair.

### F-11 · Empty-state hint fails AA — 4.31 : 1

**Where** [`orders-list.component.html:80`](../../src/app/modules/orders/orders-list.component.html#L80)
— `text-secondary` (#64748b) at 12px on the empty panel's #f2f4f6.

---

## Low — structure and hierarchy

### F-12 · The order detail page wears the list's title

Header reads "Lịch sử đơn hàng" with breadcrumb "Tài khoản › Lịch sử đơn hàng" while showing one
order; the order id sits below as a small mono line. SCREEN_RULES §Page archetypes wants a Detail
header. Evidence `M5-05`…`M5-09`.

### F-13 · Three co-equal actions, one of them destructive

"Đặt lại" / "Đặt định kỳ từ đơn này" / "Hủy đơn hàng" all render as identical outline buttons.
SCREEN_RULES §Layout rule 1 asks for one primary action per screen; a destructive action should
not read exactly like a reorder.

### F-14 · Cancel confirmation is inline, the spec asks for a dialog

SCREEN_RULES §Forms: destructive/irreversible actions require a confirmation dialog.

---

## What passed, and is worth not regressing

-   **Guards and redirects are correct.** Guest → `/sign-in` with `redirectURL` (`M1-01`);
    restaurant → `/admin` bounces to `/home` (`M1-05`); admin → `/orders` bounces to `/home`
    (`M1-06`, ownership scoping R⁺ held).
-   **Error states are real.** 403 (`M1-07`), 500 (`M5-03`) and 404 (`M5-09`) all resolve to an
    inline `role="alert"` with a retry, filters preserved — not a blank screen.
-   **The empty state is purposeful** and carries the right next step (`M5-02`), per SCREEN_RULES.
-   **BR-PRI-1 holds**: the quantity-0 listing stays in the grid with a "Hết hàng" badge and a
    disabled add-to-cart, rather than disappearing (`M1-04`) — see F-10 for its contrast.
-   **The credit refusal is specific**, naming the actual cause rather than a generic failure
    (`M5-12`).

## Checked and _not_ defects

Recorded so they are not re-reported next slice:

-   **Header appearing mid-page in full-page screenshots** — a Chromium full-page capture artifact
    with sticky chrome. The `-fold` viewport frame shows correct order; the harness now captures
    both for this reason.
-   **Blank product names / "–" line totals in an early run** — fixture error, not the app: order
    _detail_ reads `productNameSnapshot` and `subtotal` (the BR-ORD-3 snapshot fields), not the
    catalogue's `productName` / `totalPrice`. Fixtures now send both.
