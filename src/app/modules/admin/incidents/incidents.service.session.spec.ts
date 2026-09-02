import { AdminService } from '../admin.service';
import { AdminOrderGroupRow } from '../admin.types';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { IncidentsService } from './incidents.service';

/** The session's batch as `GET /admin/order-groups/{batchId}` returns it. */
function sessionBatch(): AdminOrderGroupRow {
    return {
        id: 'batch-1',
        batchNumber: 'CHO-1708',
        marketName: 'Chợ Thủ Đức',
        items: [
            {
                marketProductId: 'product-1',
                productNameSnapshot: 'Cà chua',
            },
        ],
        members: [{ orderId: 'order-1', status: 'at_hub' }],
        exceptions: [
            {
                id: 'exception-1',
                marketProductId: 'product-1',
                type: 'Shortfall',
                reportedQuantity: 3,
                note: 'Sạp chỉ còn 3kg',
                reportedByUserId: 'agent-1',
                reportedAt: '2026-08-17T01:00:00Z',
            },
        ],
    };
}

function adminStub(): AdminService {
    return {
        listUsers: jasmine.createSpy().and.resolveTo([
            { id: 'agent-1', fullName: 'Nguyễn Văn Chợ' },
            { id: 'reviewer-1', fullName: 'Admin FreshFlow' },
        ]),
        getOrder: jasmine.createSpy().and.resolveTo({
            orderId: 'order-1',
            restaurantId: 'restaurant-1',
            restaurantName: 'Bếp Xanh',
            status: 'at_hub',
            items: [{ orderItemId: 'item-1', productNameSnapshot: 'Rau cải' }],
        }),
        // Never reached: a session reads its own batch, not every page of them.
        getOrderGroups: jasmine
            .createSpy()
            .and.rejectWith(
                new Error('the session panel must not scan the batch list')
            ),
    } as unknown as AdminService;
}

/**
 * Two discrepancies at the same hub: one on an order this session carried, one
 * on another session's order — the case the filter exists for.
 */
function logisticsStub(): LogisticsAdminService {
    return {
        listHubs: jasmine
            .createSpy()
            .and.resolveTo([{ id: 'hub-1', name: 'Hub Bình Điền' }]),
        getDiscrepancies: jasmine.createSpy().and.resolveTo([
            {
                id: 'discrepancy-1',
                orderId: 'order-1',
                orderItemId: 'item-1',
                conditionStatus: 'PARTIAL',
                affectedQuantity: 2,
                status: 'OPEN',
                createdAt: '2026-08-17T02:00:00Z',
            },
            {
                id: 'discrepancy-2',
                orderId: 'order-from-another-session',
                orderItemId: 'item-9',
                conditionStatus: 'DAMAGED',
                affectedQuantity: 5,
                status: 'OPEN',
                createdAt: '2026-08-17T02:30:00Z',
            },
        ]),
    } as unknown as LogisticsAdminService;
}

describe('IncidentsService — one phiên chợ', () => {
    it("reads the agents' exceptions off the batch the session already holds", async () => {
        const admin = adminStub();
        const service = new IncidentsService(admin, logisticsStub());

        const rows =
            await service.listSessionProcurementIncidents(sessionBatch());

        expect(rows).toHaveSize(1);
        expect(rows[0].source).toBe('procurement');
        expect(rows[0].type).toBe('Shortfall');
        expect(rows[0].subject).toBe('Cà chua');
        expect(rows[0].reporterName).toBe('Nguyễn Văn Chợ');
        expect(rows[0].place).toBe('CHO-1708 · Chợ Thủ Đức');
        expect(rows[0].link).toBe('/admin/order-groups/batch-1');
        // The lifecycle belongs to hub rows only.
        expect(rows[0].status).toBeNull();
    });

    it("keeps only the hub discrepancies on this session's own orders", async () => {
        const logistics = logisticsStub();
        const service = new IncidentsService(adminStub(), logistics);

        const rows = await service.listSessionHubIncidents(
            sessionBatch(),
            'hub-1'
        );

        expect(logistics.getDiscrepancies).toHaveBeenCalledOnceWith('hub-1');
        expect(rows).toHaveSize(1);
        expect(rows[0].id).toBe('discrepancy-1');
        expect(rows[0].source).toBe('hub');
        expect(rows[0].status).toBe('open');
        expect(rows[0].place).toBe('Hub Bình Điền');
        // Foreign keys are replaced with what a reader can act on.
        expect(rows[0].subject).toBe('Rau cải');
        expect(rows[0].context).toBe('Bếp Xanh · at_hub');
    });

    it('reports nothing from the hub until the session has a batch', async () => {
        const logistics = logisticsStub();
        const service = new IncidentsService(adminStub(), logistics);

        expect(await service.listSessionHubIncidents(null, 'hub-1')).toEqual(
            []
        );
        expect(await service.listSessionProcurementIncidents(null)).toEqual([]);
        // Without the session's orders there is nothing to filter by, so the
        // hub is never read rather than read in full.
        expect(logistics.getDiscrepancies).not.toHaveBeenCalled();
    });

    it('reads nothing from the hub when the session has no hub', async () => {
        const logistics = logisticsStub();
        const service = new IncidentsService(adminStub(), logistics);

        const rows = await service.listSessionHubIncidents(
            sessionBatch(),
            null
        );

        expect(rows).toEqual([]);
        expect(logistics.getDiscrepancies).not.toHaveBeenCalled();
    });

    it('merges both streams newest first', async () => {
        const service = new IncidentsService(adminStub(), logisticsStub());

        const rows = await service.listSessionIncidents(
            sessionBatch(),
            'hub-1'
        );

        expect(rows.map((row) => row.id)).toEqual([
            'discrepancy-1',
            'exception-1',
        ]);
    });
});
