import { AdminBatchItem, AdminOrderGroupRow } from '../admin.types';
import { CrudRow } from '../shared/resource-crud.types';

/**
 * What the people working a phiên chợ actually did, as one list of acts.
 *
 * Reading is split from rendering because the two sides come from different
 * places and neither is a screen concern: the market agents' work is already on
 * the batch the session dialog holds, while the hub's work is four hub-day
 * reads. Both end up as {@link SessionAction}, which is what the panel sorts,
 * filters and counts.
 */

/** Who did it. `session` is the batch's own milestones, which have no actor. */
export type SessionActor = 'market_agent' | 'hub_staff' | 'session';

export interface SessionAction {
    id: string;
    actor: SessionActor;
    /** The actor's user id, when the record carries one. */
    actorId: string | null;
    /** i18n suffix under `admin.orderGroups.marketSessions.activity.kind`. */
    kind: string;
    /** ISO timestamp, or `null` when the record kept none. */
    at: string | null;
    /** What it was done to — a product, an order line, a route. */
    subject: string | null;
    /** How much: "12 kg", "8 × 25.000 ₫". Already formatted for reading. */
    amount: string | null;
    /** Anything else worth a line: a condition, a status, a note. */
    detail: string | null;
}

function str(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text === '' ? null : text;
}

function num(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function rowsOf(row: Record<string, unknown>, key: string): CrudRow[] {
    const value = row[key];
    return Array.isArray(value) ? (value as CrudRow[]) : [];
}

/**
 * A record's id as something a person can read out loud — the same eight
 * characters the routing tab prints. Routes and order lines reach this screen
 * as bare GUIDs; printing one whole says nothing and fills the line.
 */
function shortId(value: string | null): string | null {
    return value ? `#${value.slice(0, 8).toUpperCase()}` : null;
}

/**
 * What arrived, named rather than counted: the first product on the delivery
 * and how many more rode with it. `HubInboundItemDto.ProductName` is optional,
 * so a shipment the API did not name falls back to its line count.
 */
function inboundSubject(items: readonly CrudRow[]): string | null {
    if (!items.length) {
        return null;
    }
    const first = str(items[0]['productName']);
    const rest = items.length - 1;
    if (!first) {
        return `${items.length}`;
    }
    return rest > 0 ? `${first} +${rest}` : first;
}

/** The calendar day an ISO timestamp falls on, for hub-day scoping. */
export function dayOf(value: string | null | undefined): string | null {
    const text = String(value ?? '').trim();
    return text ? text.slice(0, 10) : null;
}

/**
 * What the agents shopping this batch did: one act per line they bought, plus
 * the hand-off that ends their part of the session.
 *
 * Read straight off the batch — every field is already on
 * `ProcurementBatchItemDto` (`actualQuantity`, `actualUnitPrice`,
 * `purchasedAt`, `assignedAgentUserId`), so the agents' half of the timeline
 * costs no request at all. A line with no `purchasedAt` has not been bought
 * yet and is not an act; it shows up in the counts as outstanding instead.
 */
export function marketAgentActions(
    batch: AdminOrderGroupRow | null,
    money: (value: number) => string,
    quantity: (value: number) => string
): SessionAction[] {
    if (!batch) {
        return [];
    }
    const row = batch as Record<string, unknown>;
    const actions: SessionAction[] = rowsOf(row, 'items')
        .map((raw) => raw as AdminBatchItem)
        .filter((item) => !!str(item.purchasedAt))
        .map((item, index) => {
            const bought = num(item.actualQuantity);
            const price = num(item.actualUnitPrice);
            const reference = num(item.referenceUnitPrice);
            const ordered = num(item.totalQuantity);
            return {
                id: `purchase:${String(item.marketProductId ?? index)}`,
                actor: 'market_agent' as const,
                actorId: str(item.assignedAgentUserId),
                kind: 'purchased',
                at: str(item.purchasedAt),
                subject: str(item.productNameSnapshot),
                amount:
                    bought !== null && price !== null
                        ? `${quantity(bought)} × ${money(price)}`
                        : bought !== null
                          ? quantity(bought)
                          : null,
                // Only when it is news: a line bought short of what was ordered,
                // or above the price the order was quoted at.
                detail: [
                    bought !== null && ordered !== null && bought < ordered
                        ? `${quantity(bought)}/${quantity(ordered)}`
                        : null,
                    price !== null && reference !== null && price > reference
                        ? `${money(price)} ▲ ${money(reference)}`
                        : null,
                ]
                    .filter((part): part is string => !!part)
                    .join(' · '),
            };
        });

    const handedOffAt = str(row['handedOffAt']);
    if (handedOffAt) {
        actions.push({
            id: 'batch:handedOff',
            actor: 'market_agent',
            actorId: null,
            kind: 'handedOff',
            at: handedOffAt,
            subject: str(row['batchNumber']),
            amount: null,
            detail: null,
        });
    }
    return actions.map((action) => ({
        ...action,
        detail: action.detail || null,
    }));
}

/**
 * The batch's own milestones — manifested, completed, cancelled.
 *
 * Not anybody's handiwork on the floor, but the timeline is unreadable without
 * them: they are what the acts around them sit between.
 */
export function sessionMilestones(
    batch: AdminOrderGroupRow | null
): SessionAction[] {
    if (!batch) {
        return [];
    }
    const row = batch as Record<string, unknown>;
    const milestones: [string, string | null][] = [
        ['manifested', str(row['manifestedAt'])],
        ['completed', str(row['completedAt'])],
        ['cancelled', str(row['cancelledAt'])],
    ];
    return milestones
        .filter(([, at]) => !!at)
        .map(([kind, at]) => ({
            id: `batch:${kind}`,
            actor: 'session' as const,
            actorId: null,
            kind,
            at,
            subject: str(row['batchNumber']),
            amount: null,
            detail:
                kind === 'cancelled' ? str(row['cancellationReason']) : null,
        }));
}

/**
 * Receiving at the hub (`GET /hubs/{hubId}/inbound?date=`).
 *
 * Narrowed to the session's chợ where the record says which one it came from:
 * a hub receives from several markets on the same day, and `sourceMarketId` is
 * the only field that ties an arrival back to one of them. A row without it is
 * kept — dropping arrivals on a missing field would hide real work.
 */
export function hubInboundActions(
    rows: readonly CrudRow[],
    marketId: string | null,
    quantityKg: (value: number) => string
): SessionAction[] {
    return rows
        .filter((row) => {
            const source = str(row['sourceMarketId']);
            return !marketId || !source || source === marketId;
        })
        .map((row) => {
            const items = rowsOf(row, 'items');
            const total = num(row['totalQuantityKg']);
            const condition = str(row['conditionStatus']);
            return {
                id: `inbound:${String(row.id ?? row['inboundId'] ?? '')}`,
                actor: 'hub_staff' as const,
                actorId: str(row['recordedBy']) ?? str(row['hubStaffUserId']),
                kind: 'received',
                at: str(row['arrivedAt']) ?? str(row['createdAt']),
                subject: inboundSubject(items),
                amount: total !== null ? quantityKg(total) : null,
                // Only when it is news: the panel prints this line in amber,
                // and a plain `RECEIVED` next to "nhận hàng tại hub" says the
                // same thing twice while looking like a problem.
                detail:
                    condition && condition.toUpperCase() !== 'OK'
                        ? condition
                        : null,
            };
        });
}

/**
 * Sorting (`GET /hubs/{hubId}/sorting-progress?serviceDate=`).
 *
 * Only lines someone has actually sorted (`sortedAt`), and only those on the
 * session's own orders when the row names one — sorting is tracked per hub-day,
 * so a hub serving two chợ reports both.
 */
export function hubSortingActions(
    rows: readonly CrudRow[],
    orderIds: ReadonlySet<string>,
    quantityKg: (value: number) => string
): SessionAction[] {
    return rows
        .filter((row) => !!str(row['sortedAt']))
        .filter((row) => {
            const orderId = str(row['orderId']);
            return !orderIds.size || !orderId || orderIds.has(orderId);
        })
        .map((row, index) => {
            const sorted = num(row['sortedQuantityKg']);
            const required = num(row['requiredQuantityKg']);
            return {
                id: `sorted:${String(row.id ?? row['orderItemId'] ?? index)}`,
                actor: 'hub_staff' as const,
                actorId: str(row['sortedByUserId']),
                kind: 'sorted',
                at: str(row['sortedAt']),
                subject:
                    str(row['productName']) ?? shortId(str(row['orderItemId'])),
                amount: sorted !== null ? quantityKg(sorted) : null,
                detail:
                    sorted !== null && required !== null && sorted < required
                        ? `${quantityKg(sorted)}/${quantityKg(required)}`
                        : null,
            };
        });
}

/** Dispatch out of the hub (`GET /hubs/{hubId}/outbound?date=`). */
export function hubOutboundActions(
    rows: readonly CrudRow[],
    quantityKg: (value: number) => string
): SessionAction[] {
    return rows.map((row, index) => {
        const total = num(row['totalQuantityKg']);
        return {
            id: `outbound:${String(row.id ?? row['outboundId'] ?? index)}`,
            actor: 'hub_staff' as const,
            actorId: str(row['recordedBy']),
            kind: 'dispatched',
            at: str(row['dispatchedAt']) ?? str(row['createdAt']),
            subject: shortId(str(row['destinationRouteId'])),
            amount: total !== null ? quantityKg(total) : null,
            detail: null,
        };
    });
}

/**
 * Handing a route to its driver (`GET /hubs/{hubId}/handovers`).
 *
 * The endpoint takes no date, so the day is filtered here. Two acts can come
 * out of one record: the hub staff handing over, and the driver's own checkout
 * confirming it — the second is the driver's, and is left to the routing tab.
 */
export function hubHandoverActions(
    rows: readonly CrudRow[],
    serviceDate: string | null
): SessionAction[] {
    return rows
        .filter(
            (row) =>
                !serviceDate || dayOf(str(row['handedOverAt'])) === serviceDate
        )
        .map((row, index) => {
            const status = str(row['status']);
            return {
                id: `handover:${String(row.id ?? row['handoverId'] ?? index)}`,
                actor: 'hub_staff' as const,
                actorId: str(row['handedOverBy']),
                kind: 'handover',
                at: str(row['handedOverAt']),
                subject: shortId(str(row['deliveryRouteId'])),
                amount: null,
                // A route handed over and gone needs no further word; one still
                // sitting at the hub is the half worth flagging.
                detail:
                    status && status.toUpperCase() !== 'CHECKED_OUT'
                        ? status
                        : null,
            };
        });
}

/**
 * Chronological, earliest first — a session reads forwards. Acts with no
 * timestamp sink to the end rather than claiming the start of the day.
 */
export function byHappenedAt(
    left: SessionAction,
    right: SessionAction
): number {
    if (!left.at) {
        return right.at ? 1 : 0;
    }
    if (!right.at) {
        return -1;
    }
    return left.at.localeCompare(right.at);
}
