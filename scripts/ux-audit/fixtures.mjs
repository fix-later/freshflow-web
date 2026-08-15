/**
 * API fixtures for the UX audit harness.
 *
 * Every scenario runs against stubs, never the real backend: the states the
 * audit exists to check — PENDING_APPROVAL, a batched order, a credit refusal,
 * a 500 on the list — cannot be produced on demand against a live API, and a
 * screenshot suite that depends on today's data is not a regression baseline.
 *
 * Shapes mirror what the app actually parses (`src/app/core/api/envelope.ts`):
 * the envelope is `{ success, data }`, list bodies put rows at `data.items`
 * with `data.totalCount`.
 */

/** `{ success, data }` — the envelope every endpoint answers with. */
export const envelope = (data) => ({ success: true, data });

/** A list body: rows at `data.items`, count at `data.totalCount`. */
export const list = (items, totalCount = items.length) =>
    envelope({ items, totalCount });

/**
 * A forged access token. Only `exp` is ever decoded (`AuthUtils.isTokenExpired`);
 * the signature is never verified client-side, and no request reaches a server
 * that would check it.
 */
export function forgeJwt(daysValid = 7) {
    const b64 = (obj) =>
        Buffer.from(JSON.stringify(obj))
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    const exp = Math.floor(Date.now() / 1000) + daysValid * 86400;
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'ux-audit', exp })}.sig`;
}

/** `GET /api/v1/profile/me` — role drives every guard and nav filter. */
export function profile(role) {
    return envelope({
        id: '00000000-0000-4000-8000-000000000001',
        email: `${role}@ux-audit.local`,
        role,
        fullName: role === 'admin' ? 'Quản trị viên' : 'Nhà hàng Bếp Việt',
        phone: '0900000000',
        avatarUrl: null,
    });
}

/**
 * `GET /api/v1/restaurants/me/approval-status`.
 *
 * The API's vocabulary is `pending` | `active` | `suspended`; the client maps it
 * through `toApprovalStatus` (`active` → approved, `suspended` → rejected).
 * Fixtures speak the API's words, not the client's.
 */
export const approvalStatus = (status) => envelope({ status });

/** One order row / detail body. `orderId` is the id the client normalises on. */
export function order({
    id = 'a1000000-0000-4000-8000-000000000001',
    status = 'confirmed',
    createdAt = '2026-08-11T08:30:00Z',
    scheduledFor = '2026-08-13T02:00:00Z',
    totalAmount = 2_450_000,
    items = defaultItems(),
} = {}) {
    return {
        orderId: id,
        status,
        createdAt,
        scheduledFor,
        totalAmount,
        subtotalAmount: totalAmount,
        deliveryFee: 0,
        vatAmount: 0,
        items,
    };
}

/**
 * Order lines. The detail page reads `productNameSnapshot` / `subtotal` — the
 * snapshot names BR-ORD-3 locks at confirmation, not the live catalogue ones —
 * so both spellings are sent, as the API does.
 */
export function defaultItems() {
    return [
        {
            orderItemId: 'b1000000-0000-4000-8000-000000000001',
            marketProductId: 'c1000000-0000-4000-8000-000000000001',
            productNameSnapshot: 'Cá lóc đồng',
            productName: 'Cá lóc đồng',
            quantity: 12,
            unitPrice: 120_000,
            subtotal: 1_440_000,
            totalPrice: 1_440_000,
            unit: 'kg',
            imageUrl: null,
        },
        {
            orderItemId: 'b1000000-0000-4000-8000-000000000002',
            marketProductId: 'c1000000-0000-4000-8000-000000000002',
            productNameSnapshot: 'Tôm sú loại 1',
            productName: 'Tôm sú loại 1',
            quantity: 5,
            unitPrice: 202_000,
            subtotal: 1_010_000,
            totalPrice: 1_010_000,
            unit: 'kg',
            imageUrl: null,
        },
    ];
}

/** `GET /api/v1/orders/ordering-window` — the server's view of BR-ORD-2. */
export const orderingWindow = ({
    isOpen = true,
    cutoffTime = '22:00',
    earliestServiceDate = '2026-08-13',
    deliveryWindowDays = 7,
} = {}) =>
    envelope({ isOpen, cutoffTime, earliestServiceDate, deliveryWindowDays });

/**
 * `GET /api/v1/orders/{id}/confirm-preview` — the server's verdict on the
 * approval / cutoff / credit gates before the confirm commits.
 */
export const confirmPreview = ({
    wouldSucceed = true,
    issues = [],
    remainingCreditAfter = 8_000_000,
    subtotalAmount = 2_450_000,
    deliveryFee = 50_000,
    vatAmount = 0,
    resolvedScheduledFor = null,
} = {}) =>
    envelope({
        wouldSucceed,
        issues,
        remainingCreditAfter,
        subtotalAmount,
        deliveryFee,
        vatAmount,
        totalAmount: subtotalAmount + deliveryFee + vatAmount,
        resolvedScheduledFor,
    });

/** `GET /api/v1/restaurants/me/delivery-addresses` — checkout ships to one. */
export const deliveryAddresses = () =>
    list([
        {
            id: 'd1000000-0000-4000-8000-000000000001',
            label: 'Bếp chính',
            addressLine: '12 Nguyễn Huệ, Quận 1',
            ward: 'Bến Nghé',
            district: 'Quận 1',
            city: 'TP. Hồ Chí Minh',
            isDefault: true,
            latitude: 10.7743,
            longitude: 106.7038,
        },
    ]);

/**
 * `GET /api/v1/markets` — the storefront blocks on a market choice, so an
 * empty list leaves every catalogue screenshot behind the picker's empty state.
 */
export const markets = () =>
    list([
        {
            id: 'e1000000-0000-4000-8000-000000000001',
            name: 'Chợ Bình Điền',
            address: 'Quận 8, TP. Hồ Chí Minh',
            isActive: true,
        },
        {
            id: 'e1000000-0000-4000-8000-000000000002',
            name: 'Chợ đầu mối Thủ Đức',
            address: 'TP. Thủ Đức, TP. Hồ Chí Minh',
            isActive: true,
        },
    ]);

export const categories = () =>
    list([
        { id: 'f1000000-0000-4000-8000-000000000001', name: 'Thủy hải sản' },
        { id: 'f1000000-0000-4000-8000-000000000002', name: 'Rau củ' },
    ]);

/**
 * `GET /api/v1/markets/{id}/products`. `availableQuantity: 0` is the
 * OUT_OF_STOCK listing BR-PRI-1 requires to stay visible rather than disappear.
 */
export const marketProducts = () =>
    list([
        {
            id: 'c1000000-0000-4000-8000-000000000001',
            marketProductId: 'c1000000-0000-4000-8000-000000000001',
            productId: 'p1000000-0000-4000-8000-000000000001',
            productName: 'Cá lóc đồng',
            category: 'Thủy hải sản',
            unit: 'kg',
            currentPrice: 120_000,
            availableQuantity: 240,
            currentQuantity: 240,
            updatedAt: '2026-08-12T01:10:00Z',
        },
        {
            id: 'c1000000-0000-4000-8000-000000000002',
            marketProductId: 'c1000000-0000-4000-8000-000000000002',
            productId: 'p1000000-0000-4000-8000-000000000002',
            productName: 'Tôm sú loại 1',
            category: 'Thủy hải sản',
            unit: 'kg',
            currentPrice: 202_000,
            availableQuantity: 0,
            currentQuantity: 0,
            updatedAt: '2026-08-12T01:12:00Z',
        },
        {
            id: 'c1000000-0000-4000-8000-000000000003',
            marketProductId: 'c1000000-0000-4000-8000-000000000003',
            productId: 'p1000000-0000-4000-8000-000000000003',
            productName: 'Cải ngọt',
            category: 'Rau củ',
            unit: 'kg',
            currentPrice: 18_500,
            availableQuantity: 1_200,
            currentQuantity: 1_200,
            updatedAt: '2026-08-12T01:14:00Z',
        },
    ]);

/**
 * The baseline stub table: `[pathRegex, responder]`, first match wins.
 * Scenario-specific entries are prepended by the runner, so a scenario only
 * declares the endpoint whose state it is actually testing.
 */
export function baseStubs({ role, approval }) {
    return [
        [/\/api\/v1\/profile\/me$/, () => ({ body: profile(role) })],
        [
            /\/api\/v1\/restaurants\/me\/approval-status$/,
            () => ({ body: approvalStatus(approval) }),
        ],
        [
            /\/api\/v1\/restaurants\/me\/delivery-addresses$/,
            () => ({ body: deliveryAddresses() }),
        ],
        [
            /\/api\/v1\/orders\/ordering-window$/,
            () => ({ body: orderingWindow() }),
        ],
        [
            /\/api\/v1\/orders\/[^/]+\/confirm-preview$/,
            () => ({ body: confirmPreview() }),
        ],
        [/\/api\/v1\/orders\/?$/, () => ({ body: list([]) })],
        [/\/api\/v1\/orders\/[^/]+$/, () => ({ body: envelope(order()) })],
        [
            /\/api\/v1\/markets\/[^/]+\/products$/,
            () => ({ body: marketProducts() }),
        ],
        [/\/api\/v1\/markets\/?$/, () => ({ body: markets() })],
        [/\/api\/v1\/categories\/?$/, () => ({ body: categories() })],
        [/\/api\/v1\/products\/?$/, () => ({ body: marketProducts() })],
    ];
}
