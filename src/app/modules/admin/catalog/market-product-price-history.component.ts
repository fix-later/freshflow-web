import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { CrudRow } from '../shared/resource-crud.types';
import {
    CatalogAdminService,
    PriceHistoryEntry,
} from './catalog-admin.service';

/** Windows the screen offers, in days. */
const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

/** One row of the change log, with the step from the previous record. */
interface HistoryRow extends PriceHistoryEntry {
    /** Change from the previous record; null on the first (nothing to compare). */
    delta: number | null;
}

/**
 * Admin ▸ Catalog ▸ Markets ▸ Pricing ▸ Price history.
 *
 * The recorded price/quantity changes for one market listing (UC-PRI-10).
 *
 * This lives in Admin, not on the storefront product page where it used to be
 * rendered: it is an operational record of what an agent set and when — part of
 * configuring a listing, not part of the offer a buyer is reading. The buyer's
 * page now shows the current price and how recently it was restated, which is
 * the part of this that bears on their decision.
 */
@Component({
    selector: 'admin-market-product-price-history',
    templateUrl: './market-product-price-history.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
        MatButtonToggleModule,
        MatIconModule,
        MatProgressBarModule,
        MatTooltipModule,
        NgApexchartsModule,
        TranslocoModule,
    ],
    styles: [
        `
            .price-history-grid {
                grid-template-columns: minmax(0, 1.2fr) 9rem 9rem 7rem;
            }
        `,
    ],
})
export class MarketProductPriceHistoryComponent implements OnInit {
    private readonly _catalog = inject(CatalogAdminService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _transloco = inject(TranslocoService);

    readonly marketId = this._route.snapshot.paramMap.get('marketId') ?? '';
    readonly productId = this._route.snapshot.paramMap.get('productId') ?? '';

    readonly marketName = signal('');
    readonly productName = signal('');
    readonly unit = signal('');

    readonly entries = signal<PriceHistoryEntry[]>([]);
    readonly loading = signal(false);
    /** Set when the read failed — distinguishes "broken" from "no changes yet". */
    readonly failed = signal(false);
    readonly range = signal<Range>(30);
    readonly ranges = RANGES;

    /**
     * Newest first for the log — the opposite of the chart, which reads left to
     * right through time. A change log is scanned from "what happened last".
     */
    readonly rows = computed<HistoryRow[]>(() =>
        this.entries()
            .map((entry, index, all) => ({
                ...entry,
                delta: index === 0 ? null : entry.price - all[index - 1].price,
            }))
            .reverse()
    );

    /**
     * Low, high, latest and the move across the window — the four figures that
     * say whether this listing's pricing is steady or drifting.
     *
     * Null below two records: a single point has no range and no change, and
     * rendering 0% for it would read as "held steady" rather than "not enough
     * history".
     */
    readonly stats = computed(() => {
        const points = this.entries();
        if (points.length < 2) {
            return null;
        }
        const prices = points.map((point) => point.price);
        const first = prices[0];
        const latest = prices[prices.length - 1];
        return {
            low: Math.min(...prices),
            high: Math.max(...prices),
            latest,
            changePct: first === 0 ? 0 : ((latest - first) / first) * 100,
        };
    });

    /**
     * Price over time — one series, so no legend: the card's own title names it.
     *
     * Quantity is deliberately **not** plotted here. It is a different measure
     * on a different scale, and pairing the two on a second y-axis lets any
     * chosen scaling imply a correlation that isn't in the data. It is in the
     * log table below instead.
     */
    readonly chart = computed<ApexOptions>(() => {
        const points = this.entries();
        return {
            chart: {
                animations: { enabled: true },
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                type: 'area',
                toolbar: { show: false },
                zoom: { enabled: false },
            },
            colors: ['#313F90'],
            dataLabels: { enabled: false },
            fill: { colors: ['#313F90'], opacity: 0.15 },
            grid: { borderColor: 'var(--fuse-border)' },
            // `stepline`, not a smoothed curve: a price holds at its value until
            // an agent changes it. Interpolating between records would draw a
            // gradual drift the market never actually quoted.
            markers: { size: 4, hover: { size: 6 } },
            series: [
                {
                    name: this._transloco.translate(
                        'admin.markets.priceHistory.price'
                    ),
                    data: points.map((point) => point.price),
                },
            ],
            stroke: { curve: 'stepline', width: 2 },
            tooltip: {
                followCursor: true,
                theme: 'dark',
                x: { show: true },
            },
            xaxis: {
                categories: points.map((point) =>
                    this.formatDate(point.recordedAt)
                ),
                axisBorder: { show: false },
                axisTicks: { color: 'var(--fuse-border)' },
                labels: {
                    rotate: 0,
                    hideOverlappingLabels: true,
                    style: { colors: 'var(--fuse-text-secondary)' },
                },
                tooltip: { enabled: false },
            },
            yaxis: {
                labels: {
                    offsetX: -12,
                    formatter: (value: number) => this.formatPrice(value),
                    style: { colors: 'var(--fuse-text-secondary)' },
                },
            },
        };
    });

    ngOnInit(): void {
        this._resolveNames();
        this.load();
    }

    goBack(): void {
        void this._router.navigate([
            '/admin/markets',
            this.marketId,
            'products',
        ]);
    }

    setRange(days: Range): void {
        if (days === this.range()) {
            return;
        }
        this.range.set(days);
        this.load();
    }

    load(): void {
        if (!this.marketId || !this.productId) {
            return;
        }
        this.loading.set(true);
        this.failed.set(false);
        this._catalog
            .getPriceHistory(this.marketId, this.productId, this.range())
            .then((entries) => this.entries.set(entries))
            .catch(() => {
                this.entries.set([]);
                this.failed.set(true);
            })
            .finally(() => this.loading.set(false));
    }

    formatPrice(price: number): string {
        return `${price.toLocaleString(this._transloco.getActiveLang())} ₫`;
    }

    /** Short date + time — several changes can land on one day. */
    formatDate(iso: string): string {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) {
            return '—';
        }
        return new Intl.DateTimeFormat(this._transloco.getActiveLang(), {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    }

    /**
     * Reads the names from the state the pricing grid passes, falling back to
     * a fetch so a deep link (or a reload) still shows what it is looking at
     * rather than two bare ids.
     */
    private _resolveNames(): void {
        const passed = (history.state?.priceHistoryContext ?? null) as {
            marketName?: string;
            productName?: string;
            unit?: string;
        } | null;
        if (passed?.productName) {
            this.marketName.set(passed.marketName ?? '');
            this.productName.set(passed.productName);
            this.unit.set(passed.unit ?? '');
            return;
        }

        void this._catalog
            .getMarket(this.marketId)
            .then((row: CrudRow | null) =>
                this.marketName.set(String(row?.['name'] ?? ''))
            )
            .catch(() => this.marketName.set(''));

        void this._catalog
            .getProduct(this.productId)
            .then((row: CrudRow | null) => {
                this.productName.set(String(row?.['name'] ?? ''));
                this.unit.set(
                    String(row?.['unitAbbreviation'] ?? row?.['unitName'] ?? '')
                );
            })
            .catch(() => this.productName.set(''));
    }
}
