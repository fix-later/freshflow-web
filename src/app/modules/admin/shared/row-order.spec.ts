import { newestActiveFirst } from './row-order';
import { TableSort } from './table-sort';

describe('newestActiveFirst', () => {
    it('puts live rows before retired ones, newest first inside each', () => {
        const rows = [
            { id: 'old-live', createdAt: '2026-01-01T00:00:00Z' },
            {
                id: 'new-off',
                createdAt: '2026-08-01T00:00:00Z',
                isActive: false,
            },
            { id: 'new-live', createdAt: '2026-08-10T00:00:00Z' },
            {
                id: 'old-off',
                createdAt: '2026-02-01T00:00:00Z',
                isActive: false,
            },
        ];

        expect(newestActiveFirst(rows).map((row) => row.id)).toEqual([
            'new-live',
            'old-live',
            'new-off',
            'old-off',
        ]);
    });

    it('reads a soft delete as retired', () => {
        const rows = [
            {
                id: 'deleted',
                createdAt: '2026-08-10T00:00:00Z',
                deletedAt: '2026-08-11T00:00:00Z',
            },
            { id: 'live', createdAt: '2026-01-01T00:00:00Z' },
        ];

        expect(newestActiveFirst(rows).map((row) => row.id)).toEqual([
            'live',
            'deleted',
        ]);
    });

    /**
     * Not every list carries `createdAt` — an invoice is dated by `issuedAt`, a
     * batch by `batchDate`, a statement by the period it covers.
     */
    it('falls back through the other date fields', () => {
        const rows = [
            { id: 'batch', batchDate: '2026-08-01' },
            { id: 'invoice', issuedAt: '2026-08-09T00:00:00Z' },
            { id: 'statement', periodStart: '2026-08-05T00:00:00Z' },
        ];

        expect(newestActiveFirst(rows).map((row) => row.id)).toEqual([
            'invoice',
            'statement',
            'batch',
        ]);
    });

    it('sinks undated rows below dated ones, in the order given', () => {
        const rows = [
            { id: 'undated-1' },
            { id: 'dated', createdAt: '2026-01-01T00:00:00Z' },
            { id: 'undated-2' },
        ];

        expect(newestActiveFirst(rows).map((row) => row.id)).toEqual([
            'dated',
            'undated-1',
            'undated-2',
        ]);
    });

    it('leaves the source array alone', () => {
        const rows = [
            { id: 'a', createdAt: '2026-01-01T00:00:00Z' },
            { id: 'b', createdAt: '2026-08-01T00:00:00Z' },
        ];

        newestActiveFirst(rows);

        expect(rows.map((row) => row.id)).toEqual(['a', 'b']);
    });
});

describe('TableSort', () => {
    it('orders by newest and live until a column is chosen', () => {
        const sort = new TableSort<{ id: string; createdAt: string }>();
        const rows = [
            { id: 'old', createdAt: '2026-01-01T00:00:00Z' },
            { id: 'new', createdAt: '2026-08-01T00:00:00Z' },
        ];
        const byId = (row: { id: string }): string => row.id;

        expect(sort.apply(rows, byId).map((row) => row.id)).toEqual([
            'new',
            'old',
        ]);

        // A chosen column wins over the default.
        sort.toggle('id');
        expect(sort.apply(rows, byId).map((row) => row.id)).toEqual([
            'new',
            'old',
        ]);
        sort.toggle('id');
        expect(sort.apply(rows, byId).map((row) => row.id)).toEqual([
            'old',
            'new',
        ]);

        // …and the third click hands it back to the default.
        sort.toggle('id');
        expect(sort.key()).toBeNull();
        expect(sort.apply(rows, byId).map((row) => row.id)).toEqual([
            'new',
            'old',
        ]);
    });
});
