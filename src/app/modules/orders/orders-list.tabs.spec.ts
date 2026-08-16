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
 * Records the filter each read asked for. The whole point of the tabs is that
 * the *server* narrows the list, so what was sent is the thing to assert — a
 * stub that just returns rows would pass with the filtering done anywhere.
 */
class StubHistoryService {
    calls: HistoryQuery[] = [];
    /** Resolvers, so a test can settle two reads out of order. */
    private _pending: ((value: {
        items: unknown[];
        total?: number;
    }) => void)[] = [];

    listHistory(
        options?: HistoryQuery
    ): Promise<{ items: unknown[]; total?: number }> {
        this.calls.push({ status: options?.status, page: options?.page });
        return new Promise((resolve) => this._pending.push(resolve));
    }

    /** Settles the nth read (0-based) with rows carrying `status`. */
    settle(index: number, status: string, count = 1): void {
        const rows = Array.from({ length: count }, (_, i) => ({
            orderId: `${status}-${i}`,
            status,
        }));
        this._pending[index]({ items: rows, total: count });
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

describe('OrdersListComponent — status tabs', () => {
    it('opens on every status and asks the server for no filter', () => {
        const { list, history } = build();

        expect(list.activeTab()).toBe('all');
        expect(history.calls).toEqual([{ status: undefined, page: 1 }]);
    });

    it('sends the picked status as the filter', () => {
        const { list, history } = build();

        list.selectTab('delivering');

        expect(history.calls[1]).toEqual({ status: 'delivering', page: 1 });
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

    /** The API's filter aliases still name a real tab. */
    it('opens an alias on the status it means', () => {
        expect(build('in_transit').list.activeTab()).toBe('delivering');
        expect(build('ready_for_pickup').list.activeTab()).toBe('picked_up');
    });

    it('writes the tab to the url, and drops the param on all', async () => {
        const { list, router } = build();

        list.selectTab('at_hub');
        await flush();
        expect(router.url).toContain('status=at_hub');

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
});
