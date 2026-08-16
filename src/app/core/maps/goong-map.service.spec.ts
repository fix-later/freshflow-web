import { environment } from 'environments/environment';
import { GoongMapService, decodeGoongPolyline } from './goong-map.service';

describe('decodeGoongPolyline', () => {
    it('converts a Goong encoded polyline to map longitude/latitude pairs', () => {
        expect(decodeGoongPolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
            [-120.2, 38.5],
            [-120.95, 40.7],
            [-126.453, 43.252],
        ]);
    });

    it('rejects an incomplete encoded point instead of drawing bad geometry', () => {
        expect(decodeGoongPolyline('_p~iF')).toEqual([]);
    });
});

describe('GoongMapService driving directions', () => {
    const mutableEnvironment = environment as { goongPlacesKey: string };
    const originalKey = mutableEnvironment.goongPlacesKey;

    afterEach(() => {
        mutableEnvironment.goongPlacesKey = originalKey;
    });

    it('requests the car path with Goong latitude/longitude ordering', async () => {
        mutableEnvironment.goongPlacesKey = 'test-key';
        const fetchSpy = spyOn(window, 'fetch').and.resolveTo(
            new Response(
                JSON.stringify({
                    routes: [
                        {
                            overview_polyline: {
                                points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
                            },
                        },
                    ],
                }),
                { status: 200 }
            )
        );

        const points = await new GoongMapService().drivingDirections(
            [106.7, 10.77],
            [106.8, 10.88]
        );

        expect(fetchSpy).toHaveBeenCalledOnceWith(
            'https://rsapi.goong.io/Direction?origin=10.77,106.7&destination=10.88,106.8&vehicle=car&api_key=test-key'
        );
        expect(points.length).toBe(3);
    });
});
