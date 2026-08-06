import { parseRouteSuggestions } from './route-suggestions';

describe('parseRouteSuggestions', () => {
    /**
     * The whole point of the endpoint: it names the hubs with goods waiting
     * that day. They were read from `markets`, a key `RouteSuggestionsDto`
     * does not have, so this list was always empty and the route origin came
     * from the plain hub list instead.
     */
    it('reads the hubs the day suggests, with their order counts', () => {
        const parsed = parseRouteSuggestions(
            {
                serviceDate: '2026-08-06',
                hubs: [
                    { id: 'hub-1', name: 'Hub Thủ Đức', orderCount: 7 },
                    { id: 'hub-2', name: 'Hub Bình Điền', orderCount: 2 },
                ],
                restaurants: [{ id: 'r1', name: 'Quán A', orderCount: 3 }],
            },
            '2026-01-01'
        );

        expect(parsed.serviceDate).toBe('2026-08-06');
        expect(parsed.hubs).toEqual([
            { id: 'hub-1', name: 'Hub Thủ Đức', orderCount: 7 },
            { id: 'hub-2', name: 'Hub Bình Điền', orderCount: 2 },
        ]);
        expect(parsed.restaurants.length).toBe(1);
    });

    it('still reads the old `markets` key, for an older API in front', () => {
        const parsed = parseRouteSuggestions(
            { markets: [{ id: 'hub-1', name: 'Hub', orderCount: 1 }] },
            '2026-08-06'
        );

        expect(parsed.hubs.map((h) => h.id)).toEqual(['hub-1']);
        // No serviceDate in the body — the caller's date stands in.
        expect(parsed.serviceDate).toBe('2026-08-06');
    });

    it('drops rows with no id rather than rendering half a hub', () => {
        const parsed = parseRouteSuggestions(
            {
                hubs: [{ name: 'nameless' }, { id: 'hub-1', name: 'Hub' }],
                restaurants: 'not-an-array',
            },
            '2026-08-06'
        );

        expect(parsed.hubs.map((h) => h.id)).toEqual(['hub-1']);
        expect(parsed.restaurants).toEqual([]);
    });

    it('defaults a missing order count to zero', () => {
        const parsed = parseRouteSuggestions(
            { hubs: [{ id: 'hub-1', name: 'Hub' }] },
            '2026-08-06'
        );

        expect(parsed.hubs[0].orderCount).toBe(0);
    });

    it('survives an empty or missing body', () => {
        expect(parseRouteSuggestions(null, '2026-08-06')).toEqual({
            serviceDate: '2026-08-06',
            hubs: [],
            restaurants: [],
        });
    });
});
