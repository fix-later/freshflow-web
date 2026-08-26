import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { RestaurantScheduledOrdersService } from 'app/modules/restaurant/scheduled-orders/scheduled-orders.service';
import { OrdersListComponent } from './orders-list.component';

/** Minimal Transloco loader — no label in this file is under test. */
class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

interface HistoryQuery {
    status?: string;
    page?: number;
}

/**
 * Records the filter each read asked for. A tab that maps to one status must
 * still be narrowed by the *server* — a stub that just returned rows would pass
 * with the filtering done anywhere — while a grouped tab is read whole, one
 * status at a time, which is what {@link whole} records.
 */
class StubHistoryService {
    calls: HistoryQuery[] = [];
    whole: string[] = [];
    /** Rows answered per status by the grouped read. */
    rowsByStatus: Record<string, { orderId: string; createdAt: string }[]> = {};
    /** How many drafts the buyer is holding, as the server counts them. */
    draftTotal = 0;

    private _pending: ((value: {
        items: unknown[];
        total?: number;
    }) => void)[] = [];

    listHistory(
        options?: HistoryQuery
    ): Promise<{ items: unknown[]; total?: number }> {
        this.calls.push({ status: options?.status, page: options?.page });
        // The draft count "all" subtracts is not a read a test drives by hand:
        // it answers straight away, so `settle`'s indices go on meaning the
        // paged reads and nothing else.
        if (options?.status === 'draft') {
            return Promise.resolve({ items: [], total: this.draftTotal });
        }
        return new Promise((resolve) => this._pending.push(resolve));
    }

    listAllHistory(options: { status: string }): Promise<unknown[]> {
        this.whole.push(options.status);
        return Promise.resolve(this.rowsByStatus[options.status] ?? []);
    }

    /** Settles the nth paged read (0-based) with rows carrying `status`. */
    settle(index: number, status: string, count = 1): void {
        const rows = Array.from({ length: count }, (_, i) => ({
            orderId: `${status}-${i}`,
            status,
        }));
        this._pending[index]({ items: rows, total: count });
    }

    /** Settles the nth paged read (0-based) with the rows exactly as given. */
    settleRows(
        index: number,
        rows: { orderId: string; status: string }[],
        total: number
    ): void {
        this._pending[index]({ items: rows, total });
    }
}

function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function build(queryStatus?: string): {
    list: OrdersListComponent;
    history: StubHistoryService;
    router: Router;
} {
    const history = new StubHistoryService();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        imports: [OrdersListComponent],
        providers: [
            provideRouter([]),
            provideTransloco({
                config: { availableLangs: ['en'], defaultLang: 'en' },
                loader: StubTranslocoLoader,
            }),
            {
                provide: RestaurantScheduledOrdersService,
                useValue:
                    history as unknown as RestaurantScheduledOrdersService,
            },
        ],
    });
    // The tab a deep link opens on is read off the snapshot, so it is set here
    // rather than by navigating — no route in this test tree carries it.
    const route = TestBed.inject(ActivatedRoute);
    route.snapshot.queryParams = queryStatus ? { status: queryStatus } : {};

    const fixture = TestBed.createComponent(OrdersListComponent);
    fixture.componentInstance.ngOnInit();
    return {
        list: fixture.componentInstance,
        history,
        router: TestBed.inject(Router),
    };
}

/**
 * The buyer's list is indexed by stage, not by the eight statuses the order
 * moves through: `confirmed`, `batched` and `picked_up` are operations talking
 * to itself, and all three answer the buyer's only question the same way.
 */
describe('OrdersListComponent — status tabs', () => {
    it('offers the four stages a restaurant cares about, plus all', () => {
        const { list } = build();

        expect([...list.tabs]).toEqual([
            'all',
            'processing',
            'awaiting',
            'delivered',
            'cancelled',
        ]);
    });

    it('opens on every status and asks the server for no filter', () => {
        const { list, history } = build();

        expect(list.activeTab()).toBe('all');
        expect(history.calls).toEqual([{ status: undefined, page: 1 }]);
    });

    it('sends a single-status tab as the server filter', () => {
        const { list, history } = build();

        list.selectTab('delivered');

        expect(history.calls[1]).toEqual({ status: 'delivered', page: 1 });
        // Paged by the server: the archive tabs can be long.
        expect(history.whole).toEqual([]);
    });

    it('reads every status of a grouped tab and merges them newest first', async () => {
        const { list, history } = build();
        history.rowsByStatus = {
            confirmed: [{ orderId: 'c-1', createdAt: '2026-08-20T09:00:00Z' }],
            batched: [{ orderId: 'b-1', createdAt: '2026-08-22T09:00:00Z' }],
            picked_up: [{ orderId: 'p-1', createdAt: '2026-08-21T09:00:00Z' }],
        };

        list.selectTab('processing');
        await flush();

        // One read per status: the filter takes one, and page 2 of a group is
        // not composable from page 2 of each.
        expect(history.whole).toEqual(['confirmed', 'batched', 'picked_up']);
        expect(list.rows().map((row) => row.orderId)).toEqual([
            'b-1',
            'p-1',
            'c-1',
        ]);
        expect(list.totalCount()).toBe(3);
    });

    it('pages a grouped tab over the merged rows', async () => {
        const { list, history } = build();
        history.rowsByStatus = {
            at_hub: Array.from({ length: 15 }, (_, i) => ({
                orderId: `h-${i}`,
                createdAt: `2026-08-${10 + i}T09:00:00Z`,
            })),
            delivering: Array.from({ length: 10 }, (_, i) => ({
                orderId: `d-${i}`,
                createdAt: `2026-07-${10 + i}T09:00:00Z`,
            })),
        };

        list.selectTab('awaiting');
        await flush();
        expect(list.rows().length).toBe(20);
        expect(list.totalCount()).toBe(25);

        list.nextPage();
        await flush();
        expect(list.rows().length).toBe(5);
    });

    it('starts the new tab at its own first page', async () => {
        const { list, history } = build();
        // More than one page of them, so there is a second page to be on.
        history.settle(0, 'delivered', 25);
        await flush();
        list.nextPage();
        expect(list.page()).toBe(2);

        list.selectTab('cancelled');

        expect(list.page()).toBe(1);
        expect(history.calls.at(-1)).toEqual({ status: 'cancelled', page: 1 });
    });

    it('opens the tab a deep link names', () => {
        const { list, history } = build('cancelled');

        expect(list.activeTab()).toBe('cancelled');
        expect(history.calls).toEqual([{ status: 'cancelled', page: 1 }]);
    });

    /** A stale slug is not worth an empty screen — it lands on everything. */
    it('falls back to all for a status it does not have a tab for', () => {
        const { list } = build('not-a-status');

        expect(list.activeTab()).toBe('all');
    });

    /**
     * Links written before the grouping — in response statuses or in the API's
     * filter aliases — still open the tab that now contains that status.
     */
    it('opens a status or an alias on the tab that now holds it', () => {
        expect(build('batched').list.activeTab()).toBe('processing');
        expect(build('ready_for_pickup').list.activeTab()).toBe('processing');
        expect(build('at_hub').list.activeTab()).toBe('awaiting');
        expect(build('in_transit').list.activeTab()).toBe('awaiting');
    });

    it('writes the tab to the url, and drops the param on all', async () => {
        const { list, router } = build();

        list.selectTab('processing');
        await flush();
        expect(router.url).toContain('status=processing');

        list.selectTab('all');
        await flush();
        expect(router.url).not.toContain('status=');
    });

    /**
     * Two tabs one click apart, answered out of order. Without a guard the
     * slower first read repaints the tab the buyer is now looking at with rows
     * that belong to the one they left.
     */
    it('ignores a read the buyer has already tabbed away from', async () => {
        const { list, history } = build();

        list.selectTab('delivered');
        list.selectTab('cancelled');
        // The "delivered" read (index 1) comes back after the "cancelled" one.
        history.settle(2, 'cancelled');
        history.settle(1, 'delivered', 5);
        await flush();

        expect(list.activeTab()).toBe('cancelled');
        expect(list.rows().map((row) => row.status)).toEqual(['cancelled']);
        expect(list.loading()).toBeFalse();
    });

    /**
     * A draft is the buyer's cart, not an order they placed — one is left
     * behind per market session they browsed and abandoned. "All" sends no
     * status, so the server hands them back with everything else.
     */
    it('keeps the buyer own drafts out of the all tab', async () => {
        const { list, history } = build();
        history.draftTotal = 2;
        history.settleRows(
            0,
            [
                { orderId: 'd-0', status: 'draft' },
                { orderId: 'c-0', status: 'confirmed' },
                { orderId: 'v-0', status: 'delivered' },
            ],
            12
        );
        await flush();

        expect(list.rows().map((row) => row.orderId)).toEqual(['c-0', 'v-0']);
        // The pager counts what the tab renders: 12 rows less the 2 drafts.
        // Left at 12 it would offer a last page that comes back empty.
        expect(list.totalCount()).toBe(10);
        expect(history.calls).toContain({ status: 'draft', page: 1 });
    });

    /** Only "all" is unfiltered, so only "all" pays for the draft count. */
    it('leaves a single-status tab to the server filter alone', async () => {
        const { list, history } = build();

        list.selectTab('delivered');
        history.settle(1, 'delivered', 3);
        await flush();

        expect(list.rows().length).toBe(3);
        expect(list.totalCount()).toBe(3);
        expect(
            history.calls.some((call) => call.status === 'draft')
        ).toBeFalse();
    });
});
