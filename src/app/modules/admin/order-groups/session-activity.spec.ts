import { AdminOrderGroupRow } from '../admin.types';
import { CrudRow } from '../shared/resource-crud.types';
import {
    byHappenedAt,
    hubHandoverActions,
    hubInboundActions,
    hubOutboundActions,
    hubSortingActions,
    marketAgentActions,
    sessionMilestones,
} from './session-activity';

const money = (value: number) => `${value}₫`;
const quantity = (value: number) => String(value);
const kg = (value: number) => `${value} kg`;

const batch = {
    id: 'batch-1',
    batchNumber: 'HM-260822-1',
    manifestedAt: '2026-08-22T01:00:00Z',
    handedOffAt: '2026-08-22T05:00:00Z',
    completedAt: '2026-08-22T12:00:00Z',
    items: [
        {
            marketProductId: 'product-1',
            productNameSnapshot: 'Cà chua',
            totalQuantity: 10,
            referenceUnitPrice: 20000,
            actualQuantity: 10,
            actualUnitPrice: 20000,
            purchasedAt: '2026-08-22T02:00:00Z',
            assignedAgentUserId: 'agent-1',
        },
        {
            marketProductId: 'product-2',
            productNameSnapshot: 'Rau muống',
            totalQuantity: 8,
            referenceUnitPrice: 12000,
            actualQuantity: 5,
            actualUnitPrice: 15000,
            purchasedAt: '2026-08-22T03:00:00Z',
            assignedAgentUserId: 'agent-2',
        },
        {
            // Not bought yet — an outstanding line, not an act.
            marketProductId: 'product-3',
            productNameSnapshot: 'Cá thu',
            totalQuantity: 4,
            assignedAgentUserId: 'agent-1',
        },
    ],
} as unknown as AdminOrderGroupRow;

describe('session activity — the agents at the chợ', () => {
    it('records one act per line actually bought, naming who bought it', () => {
        const actions = marketAgentActions(batch, money, quantity);

        expect(actions.map((action) => action.kind)).toEqual([
            'purchased',
            'purchased',
            'handedOff',
        ]);
        expect(actions[0].actorId).toBe('agent-1');
        expect(actions[0].subject).toBe('Cà chua');
        expect(actions[0].amount).toBe('10 × 20000₫');
        // Bought in full at the quoted price: nothing to flag.
        expect(actions[0].detail).toBeNull();
    });

    it('flags a line bought short, or above the price it was quoted at', () => {
        const actions = marketAgentActions(batch, money, quantity);

        expect(actions[1].detail).toBe('5/8 · 15000₫ ▲ 12000₫');
    });

    it('reads nothing off a session that has no batch', () => {
        expect(marketAgentActions(null, money, quantity)).toEqual([]);
        expect(sessionMilestones(null)).toEqual([]);
    });

    it('keeps the batch milestones the acts sit between', () => {
        expect(sessionMilestones(batch).map((row) => row.kind)).toEqual([
            'manifested',
            'completed',
        ]);
    });
});

describe('session activity — the hub', () => {
    const inbound: CrudRow[] = [
        {
            id: 'inbound-1',
            sourceMarketId: 'market-1',
            recordedBy: 'staff-1',
            arrivedAt: '2026-08-22T06:00:00Z',
            totalQuantityKg: 120,
            conditionStatus: 'OK',
            items: [{ productName: 'Cà chua' }, { productName: 'Rau muống' }],
        },
        {
            id: 'inbound-2',
            sourceMarketId: 'market-9',
            recordedBy: 'staff-2',
            arrivedAt: '2026-08-22T06:30:00Z',
            totalQuantityKg: 80,
            items: [],
        },
        {
            // No source: kept, because dropping arrivals on a missing field
            // would hide real work at the hub.
            id: 'inbound-3',
            recordedBy: 'staff-1',
            arrivedAt: '2026-08-22T07:00:00Z',
            totalQuantityKg: 40,
            items: [],
        },
    ];

    it('keeps the arrivals from this session’s chợ, and the unattributed ones', () => {
        const actions = hubInboundActions(inbound, 'market-1', kg);

        expect(actions.map((action) => action.id)).toEqual([
            'inbound:inbound-1',
            'inbound:inbound-3',
        ]);
        expect(actions[0].actorId).toBe('staff-1');
        expect(actions[0].subject).toBe('Cà chua +1');
        expect(actions[0].amount).toBe('120 kg');
    });

    it('keeps every arrival when the session names no chợ', () => {
        expect(hubInboundActions(inbound, null, kg)).toHaveSize(3);
    });

    it('counts only lines someone sorted, on this session’s orders', () => {
        const rows: CrudRow[] = [
            {
                id: 'line-1',
                orderId: 'order-1',
                orderItemId: 'item-1',
                sortedByUserId: 'staff-1',
                sortedAt: '2026-08-22T08:00:00Z',
                sortedQuantityKg: 4,
                requiredQuantityKg: 6,
                status: 'partial',
            },
            {
                // Another session's order at the same hub-day.
                id: 'line-2',
                orderId: 'order-9',
                sortedByUserId: 'staff-1',
                sortedAt: '2026-08-22T08:10:00Z',
                sortedQuantityKg: 2,
            },
            {
                // Not sorted yet — outstanding work, not an act.
                id: 'line-3',
                orderId: 'order-1',
                sortedQuantityKg: 0,
            },
        ];

        const actions = hubSortingActions(rows, new Set(['order-1']), kg);

        expect(actions.map((action) => action.id)).toEqual(['sorted:line-1']);
        expect(actions[0].detail).toBe('4 kg/6 kg');
    });

    it('reads dispatch and hand-over as the hub’s own acts on the day', () => {
        const outbound = hubOutboundActions(
            [
                {
                    id: 'outbound-1',
                    recordedBy: 'staff-2',
                    dispatchedAt: '2026-08-22T09:00:00Z',
                    destinationRouteId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                    totalQuantityKg: 200,
                },
            ],
            kg
        );
        expect(outbound[0].actor).toBe('hub_staff');
        expect(outbound[0].subject).toBe('#AAAAAAAA');

        const handovers = hubHandoverActions(
            [
                {
                    id: 'handover-1',
                    handedOverBy: 'staff-2',
                    handedOverAt: '2026-08-22T09:30:00Z',
                    deliveryRouteId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                    status: 'CHECKED_OUT',
                },
                {
                    // The endpoint takes no date, so yesterday's run arrives too.
                    id: 'handover-2',
                    handedOverBy: 'staff-2',
                    handedOverAt: '2026-08-21T09:30:00Z',
                },
            ],
            '2026-08-22'
        );
        expect(handovers.map((action) => action.id)).toEqual([
            'handover:handover-1',
        ]);
    });
});

describe('session activity — order', () => {
    it('reads forwards, with undated acts last', () => {
        const actions = [
            { at: null },
            { at: '2026-08-22T06:00:00Z' },
            { at: '2026-08-22T02:00:00Z' },
        ].map((row, index) => ({
            id: String(index),
            actor: 'hub_staff' as const,
            actorId: null,
            kind: 'received',
            subject: null,
            amount: null,
            detail: null,
            ...row,
        }));

        expect([...actions].sort(byHappenedAt).map((row) => row.id)).toEqual([
            '2',
            '1',
            '0',
        ]);
    });
});
