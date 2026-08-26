import { claimsApi } from 'contract';
import { RestaurantClaimsService } from './restaurant-claims.service';

describe('RestaurantClaimsService', () => {
    let service: RestaurantClaimsService;

    beforeEach(() => {
        service = new RestaurantClaimsService();
    });

    it('sends the optional proof image URL when filing a claim', async () => {
        const post = spyOn(
            claimsApi,
            'apiV1OrdersOrderIdClaimsPostRaw'
        ).and.resolveTo({
            raw: new Response(
                JSON.stringify({
                    data: { claimId: 'claim-1', proofImageUrl: 'proof-url' },
                })
            ),
        } as never);

        const claim = await service.fileClaim(
            'order-1',
            25000,
            'Damaged goods',
            'proof-url'
        );

        // `proofImageUrl` is part of `FileClaimRequest` now, so the generated
        // serialiser carries it instead of stripping it as an unknown field.
        expect(post).toHaveBeenCalledWith({
            orderId: 'order-1',
            fileClaimRequest: {
                amount: 25000,
                reason: 'Damaged goods',
                proofImageUrl: 'proof-url',
            },
        });
        expect(claim.proofImageUrl).toBe('proof-url');
    });

    it('uses the order-scoped signature endpoint before uploading proof', async () => {
        const signature = {
            signature: 'signed',
            timestamp: 123,
            apiKey: 'key',
            cloudName: 'cloud',
            folder: 'freshflow/order-claims',
        };
        const sign = spyOn(
            claimsApi,
            'apiV1OrdersOrderIdClaimsUploadSignaturePostRaw'
        ).and.resolveTo({
            raw: new Response(JSON.stringify({ data: signature })),
        } as never);
        const fetchSpy = spyOn(window, 'fetch').and.resolveTo(
            new Response(
                JSON.stringify({
                    secure_url: 'https://res.cloudinary.com/cloud/proof.jpg',
                }),
                { status: 200 }
            )
        );

        const url = await service.uploadClaimProof(
            'order-1',
            new File(['image'], 'proof.jpg', { type: 'image/jpeg' })
        );

        expect(sign).toHaveBeenCalledWith({ orderId: 'order-1' });
        expect(fetchSpy).toHaveBeenCalled();
        expect(url).toBe('https://res.cloudinary.com/cloud/proof.jpg');
    });
});
