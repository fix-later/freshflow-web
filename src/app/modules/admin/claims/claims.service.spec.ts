import { claimsApi } from 'contract';
import { AdminService } from '../admin.service';
import { ClaimsService } from './claims.service';

describe('ClaimsService readable enrichment', () => {
    it('keeps the latest BE fields and resolves order, restaurant and actors', async () => {
        const admin = {
            listUsers: jasmine.createSpy().and.resolveTo([
                {
                    id: 'restaurant-user',
                    restaurantId: 'restaurant-1',
                    restaurantName: 'Bếp Xanh',
                    email: 'bepxanh@example.com',
                    phone: '0909000000',
                },
                {
                    id: 'reviewer-1',
                    fullName: 'Admin FreshFlow',
                    email: 'admin@freshflow.vn',
                },
            ]),
            getOrder: jasmine.createSpy().and.resolveTo({
                orderId: 'order-1',
                restaurantId: 'restaurant-1',
                status: 'delivered',
                totalAmount: 250000,
                items: [
                    {
                        orderItemId: 'item-1',
                        productNameSnapshot: 'Cà chua',
                        quantity: 3,
                        subtotal: 90000,
                    },
                ],
            }),
        } as unknown as AdminService;
        const service = new ClaimsService(admin);
        spyOn(claimsApi, 'apiV1ClaimsGetRaw').and.resolveTo({
            raw: new Response(
                JSON.stringify({
                    data: [
                        {
                            claimId: 'claim-1',
                            orderId: 'order-1',
                            restaurantId: 'restaurant-1',
                            amount: 50000,
                            reason: 'Thiếu hàng',
                            proofImageUrl: 'https://example.com/proof.jpg',
                            status: 'approved',
                            createdBy: 'restaurant-user',
                            createdAt: '2026-08-17T01:00:00Z',
                            reviewedBy: 'reviewer-1',
                            reviewedAt: '2026-08-17T02:00:00Z',
                            decisionNote: 'Đã xác nhận',
                            refundTransactionId: 'refund-1',
                            updatedAt: '2026-08-17T02:00:00Z',
                        },
                    ],
                    meta: { pageSize: 50, nextCursor: null },
                })
            ),
        } as never);

        const page = await service.listClaims();
        const claim = page.claims[0];

        expect(claim.proofImageUrl).toBe('https://example.com/proof.jpg');
        expect(claim.refundTransactionId).toBe('refund-1');
        expect(claim.updatedAt).toBe('2026-08-17T02:00:00Z');
        expect(claim.orderDetail?.items?.[0].productNameSnapshot).toBe(
            'Cà chua'
        );
        expect(claim.restaurant?.name).toBe('Bếp Xanh');
        expect(claim.filedBy?.email).toBe('bepxanh@example.com');
        expect(claim.reviewedByUser?.name).toBe('Admin FreshFlow');
    });
});
