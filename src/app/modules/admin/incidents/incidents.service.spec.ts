import { AdminService } from '../admin.service';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { IncidentsService } from './incidents.service';

describe('IncidentsService GET report', () => {
    it('loads every procurement page and resolves product and reporter names', async () => {
        const getOrderGroups = jasmine
            .createSpy()
            .and.callFake((page: number) =>
                Promise.resolve({
                    groups:
                        page === 1
                            ? [
                                  {
                                      id: 'batch-1',
                                      batchNumber: 'CHO-1708',
                                      marketName: 'Chợ Thủ Đức',
                                      items: [
                                          {
                                              marketProductId: 'product-1',
                                              productNameSnapshot: 'Cà chua',
                                          },
                                      ],
                                      exceptions: [
                                          {
                                              id: 'exception-1',
                                              marketProductId: 'product-1',
                                              type: 'Unavailable',
                                              reportedQuantity: 4,
                                              reportedByUserId: 'agent-1',
                                              reportedAt:
                                                  '2026-08-17T01:00:00Z',
                                          },
                                      ],
                                  },
                              ]
                            : [
                                  {
                                      id: 'batch-2',
                                      batchNumber: 'CHO-1709',
                                      exceptions: [],
                                  },
                              ],
                    totalCount: 101,
                })
            );
        const admin = {
            getOrderGroups,
            listUsers: jasmine.createSpy().and.resolveTo([
                {
                    id: 'agent-1',
                    fullName: 'Nguyễn Văn Chợ',
                    email: 'agent@example.com',
                },
            ]),
        } as unknown as AdminService;
        const service = new IncidentsService(
            admin,
            {} as LogisticsAdminService
        );

        const rows = await service.listProcurementIncidents();

        expect(getOrderGroups.calls.allArgs()).toEqual([
            [1, 100],
            [2, 100],
        ]);
        expect(rows).toHaveSize(1);
        expect(rows[0].subject).toBe('Cà chua');
        expect(rows[0].reporterName).toBe('Nguyễn Văn Chợ');
        expect(rows[0].place).toBe('CHO-1708 · Chợ Thủ Đức');
        expect(rows[0].link).toBe('/admin/order-groups/batch-1');
    });

    it('loads hub discrepancies and replaces foreign keys with readable details', async () => {
        const admin = {
            listUsers: jasmine.createSpy().and.resolveTo([
                {
                    id: 'reviewer-1',
                    fullName: 'Admin FreshFlow',
                },
            ]),
            getOrder: jasmine.createSpy().and.resolveTo({
                orderId: 'order-1',
                restaurantId: 'restaurant-1',
                restaurantName: 'Bếp Xanh',
                status: 'at_hub',
                items: [
                    {
                        orderItemId: 'item-1',
                        productNameSnapshot: 'Rau cải',
                    },
                ],
            }),
        } as unknown as AdminService;
        const logistics = {
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
                    status: 'ACKNOWLEDGED',
                    acknowledgedBy: 'reviewer-1',
                    acknowledgedAt: '2026-08-17T03:00:00Z',
                    createdAt: '2026-08-17T02:00:00Z',
                },
            ]),
        } as unknown as LogisticsAdminService;
        const service = new IncidentsService(admin, logistics);

        const rows = await service.listHubIncidents();

        expect(logistics.getDiscrepancies).toHaveBeenCalledOnceWith('hub-1');
        expect(admin.getOrder).toHaveBeenCalledOnceWith('order-1');
        expect(rows).toHaveSize(1);
        expect(rows[0].subject).toBe('Rau cải');
        expect(rows[0].context).toBe('Bếp Xanh · at_hub');
        expect(rows[0].place).toBe('Hub Bình Điền');
        expect(rows[0].acknowledgedBy).toBe('Admin FreshFlow');
        expect(rows[0].status).toBe('acknowledged');
        expect(JSON.stringify(rows[0])).not.toContain('order-1');
        expect(JSON.stringify(rows[0])).not.toContain('item-1');
    });
});
