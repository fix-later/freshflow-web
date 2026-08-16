import { rawApi } from 'contract';
import { RestaurantClaimsService } from './restaurant-claims.service';

describe('RestaurantClaimsService', () => {
    let service: RestaurantClaimsService;

    beforeEach(() => {
        service = new RestaurantClaimsService();
    });

    it('sends the optional proof image URL when filing a claim', async () => {
        const send = spyOn(rawApi, 'send').and.resolveTo(
            new Response(
                JSON.stringify({
                    data: { claimId: 'claim-1', proofImageUrl: 'proof-url' },
                })
            )
        );

        const claim = await service.fileClaim(
            'order/with spaces',
            25000,
            'Damaged goods',
            'proof-url'
        );

        expect(send).toHaveBeenCalledWith(
            '/api/v1/orders/order%2Fwith%20spaces/claims',
            'POST',
            {
                amount: 25000,
                reason: 'Damaged goods',
                proofImageUrl: 'proof-url',
            }
        );
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
        const send = spyOn(rawApi, 'send').and.resolveTo(
            new Response(JSON.stringify({ data: signature }))
        );
        const fetchSpy = spyOn(window, 'fetch').and.resolveTo(
            new Response(
                JSON.stringify({
                    secure_url: 'https://res.cloudinary.com/cloud/proof.jpg',
                }),
                { status: 200 }
            )
        );

        const url = await service.uploadClaimProof(
            'order/1',
            new File(['image'], 'proof.jpg', { type: 'image/jpeg' })
        );

        expect(send).toHaveBeenCalledWith(
            '/api/v1/orders/order%2F1/claims/upload-signature',
            'POST'
        );
        expect(fetchSpy).toHaveBeenCalled();
        expect(url).toBe('https://res.cloudinary.com/cloud/proof.jpg');
    });
});
