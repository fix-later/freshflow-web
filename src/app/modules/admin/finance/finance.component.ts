import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
    input,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import {
    CHART_COLORS,
    CHART_STATUS_COLORS,
    ChartPoint,
    barChart,
    donutChart,
    radialChart,
} from '../shared/chart-theme';
import { FinanceAdminService } from './finance-admin.service';
import {
    FinanceInvoiceRow,
    RestaurantCreditRow,
    byRisk,
    creditRisk,
    creditTotals,
    creditUtilisation,
} from './finance.types';

/** Invoices shown alongside the portfolio — enough to spot a backlog. */
const INVOICE_PREVIEW_SIZE = 10;

/** Restaurants named in the debtors chart — past this the bars are unreadable. */
const TOP_DEBTORS = 8;

/**
 * Operations ▸ Finance (`/admin/finance`).
 *
 * Everything the backend exposes about money is scoped to one restaurant, so
 * answering "how much are we owed, and by whom" meant opening each restaurant
 * in turn. This is that question asked once: portfolio totals, a table ordered
 * by how close each restaurant is to its limit (BR-CRE-2), and the invoices
 * still waiting to be issued.
 *
 * Read-only by design — setting a limit or recording a payment stays on the
 * restaurant's own page, where the full ledger is in view. Rows link there.
 */
@Component({
    selector: 'admin-finance',
    templateUrl: './finance.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
        MatIconModule,
        MatProgressBarModule,
        MatSlideToggleModule,
        MatTooltipModule,
        NgApexchartsModule,
        TranslocoModule,
    ],
    styles: [
        `
            .finance-grid {
                /* restaurant | limit | outstanding | available | usage | detail */
                grid-template-columns:
                    minmax(0, 1.6fr) minmax(0, 0.9fr) minmax(0, 0.9fr)
                    minmax(0, 0.9fr) minmax(0, 1.1fr) 3.5rem;
            }
        `,
    ],
})
export class FinanceComponent implements OnInit {
    private readonly _finance = inject(FinanceAdminService);
    private readonly _router = inject(Router);
    private readonly _transloco = inject(TranslocoService);

    readonly rows = signal<RestaurantCreditRow[]>([]);
    readonly invoices = signal<FinanceInvoiceRow[]>([]);
    readonly invoiceTotal = signal(0);
    readonly loading = signal(false);
    /** Localized reason the portfolio read failed — drives the retry state. */
    readonly loadError = signal<string | null>(null);
    /** Invoices fail separately; the portfolio is still worth showing. */
    readonly invoiceError = signal<string | null>(null);

    /** Hide restaurants that cannot order yet — they have no debt to chase. */
    readonly approvedOnly = signal(true);

    readonly risk = creditRisk;
    readonly utilisation = creditUtilisation;

    /**
     * True when the dashboard's tab bar already names this section — the panel
     * then drops its own page title and its full-viewport positioning, and
     * scrolls with the dashboard instead of inside itself.
     */
    readonly embedded = input(false);

    readonly sortedRows = computed(() => [...this.rows()].sort(byRisk));
    readonly totals = computed(() => creditTotals(this.rows()));

    // ---- Charts -----------------------------------------------------------
    //
    // The table below answers "who owes what"; these answer "how exposed are
    // we", which is the question the table's first screenful cannot show once
    // the portfolio is more than a dozen restaurants long.

    /**
     * How the portfolio splits across the risk bands. Fixed semantic colours:
     * red is at-limit (ordering already blocked) and must not land on "ok"
     * because the palette happened to rotate that way.
     */
    readonly riskChart = computed<ApexOptions>(() => {
        const totals = this.totals();
        const ok =
            this.rows().length -
            totals.atLimit -
            totals.nearLimit -
            totals.unavailable;
        const points: ChartPoint[] = [
            { label: this._t('admin.finance.risk.ok'), value: Math.max(ok, 0) },
            {
                label: this._t('admin.finance.risk.nearLimit'),
                value: totals.nearLimit,
            },
            {
                label: this._t('admin.finance.risk.atLimit'),
                value: totals.atLimit,
            },
            {
                label: this._t('admin.finance.risk.unavailable'),
                value: totals.unavailable,
            },
        ].filter((point) => point.value > 0);

        return donutChart(points, {
            colors: [
                CHART_STATUS_COLORS.good,
                CHART_STATUS_COLORS.warn,
                CHART_STATUS_COLORS.bad,
                CHART_STATUS_COLORS.neutral,
            ],
            format: (value) => this._number(value),
        });
    });

    /** Share of the granted limit currently drawn down, across the portfolio. */
    readonly utilisationChart = computed<ApexOptions>(() => {
        const percent = this.portfolioUsage() ?? 0;
        const color =
            percent >= 100
                ? CHART_STATUS_COLORS.bad
                : percent >= 80
                  ? CHART_STATUS_COLORS.warn
                  : CHART_COLORS[0];
        return radialChart(
            percent,
            this._t('admin.finance.charts.utilisation'),
            color
        );
    });

    /**
     * The largest debts, biggest first. Horizontal because restaurant names
     * do not fit under a vertical axis.
     */
    readonly debtorsChart = computed<ApexOptions>(() =>
        barChart(
            [...this.rows()]
                .filter((row) => (row.outstanding ?? 0) > 0)
                .sort((a, b) => (b.outstanding ?? 0) - (a.outstanding ?? 0))
                .slice(0, TOP_DEBTORS)
                .map((row) => ({
                    label: row.name || row.email || row.id,
                    value: row.outstanding ?? 0,
                })),
            {
                name: this._t('admin.finance.totals.outstanding'),
                horizontal: true,
                format: (value) => this.formatAmount(value),
                colors: [CHART_STATUS_COLORS.bad],
                height: 340,
            }
        )
    );

    /** The invoice backlog by status — what is issued versus still waiting. */
    readonly invoiceStatusChart = computed<ApexOptions>(() => {
        const byStatus = new Map<string, number>();
        for (const invoice of this.invoices()) {
            const status =
                String(invoice.status ?? '').toLowerCase() || 'unknown';
            byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
        }
        return donutChart(
            [...byStatus].map(([status, value]) => ({
                label: this._t(this.invoiceStatusKey(status)),
                value,
            })),
            { format: (value) => this._number(value) }
        );
    });

    /** Whole-portfolio utilisation as a percent, or `null` with no limits set. */
    readonly portfolioUsage = computed<number | null>(() => {
        const { limit, outstanding } = this.totals();
        if (limit <= 0) {
            return outstanding > 0 ? 100 : null;
        }
        return (outstanding / limit) * 100;
    });

    /** True once there is a portfolio worth charting. */
    readonly hasPortfolio = computed(() => this.rows().length > 0);

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.loadError.set(null);
        void this._finance
            .creditPortfolio(this.approvedOnly())
            .then((rows) => this.rows.set(rows))
            .catch(async (err) => {
                this.rows.set([]);
                this.loadError.set(
                    await this._describe(err, 'admin.finance.loadError')
                );
            })
            .finally(() => this.loading.set(false));

        this.invoiceError.set(null);
        void this._finance
            .listInvoices({ pageSize: INVOICE_PREVIEW_SIZE })
            .then(({ rows, total }) => {
                this.invoices.set(rows);
                this.invoiceTotal.set(total);
            })
            .catch(async (err) => {
                this.invoices.set([]);
                this.invoiceTotal.set(0);
                this.invoiceError.set(
                    await this._describe(err, 'admin.finance.invoicesError')
                );
            });
    }

    onApprovedOnlyChange(value: boolean): void {
        this.approvedOnly.set(value);
        this.load();
    }

    /** Utilisation as a whole percent, or `null` when it cannot be known. */
    usagePercent(row: RestaurantCreditRow): number | null {
        const used = this.utilisation(row);
        return used == null ? null : Math.round(used * 100);
    }

    /** Bar colour follows the risk band, so the table scans without reading. */
    usageBarClass(row: RestaurantCreditRow): string {
        switch (this.risk(row)) {
            case 'atLimit':
                return 'bg-red-500';
            case 'nearLimit':
                return 'bg-amber-500';
            default:
                return 'bg-primary';
        }
    }

    openRestaurant(row: RestaurantCreditRow): void {
        // The restaurant page is keyed by the owning **user**, not the
        // restaurant id the credit endpoints use.
        void this._router.navigate(['/admin/restaurants', row.userId]);
    }

    /** i18n key for an invoice status, falling back when unrecognised. */
    invoiceStatusKey(status: string | null | undefined): string {
        const normalized = String(status ?? '')
            .trim()
            .toLowerCase();
        return normalized
            ? `admin.finance.invoiceStatus.${normalized}`
            : 'admin.finance.invoiceStatus.unknown';
    }

    invoiceStatusPillClass(status: string | null | undefined): string {
        switch (String(status ?? '').toLowerCase()) {
            case 'issued':
                return 'admin-pill admin-pill-success';
            case 'cancelled':
                return 'admin-pill admin-pill-danger';
            case 'pendingissuance':
                return 'admin-pill admin-pill-warning';
            default:
                return 'admin-pill admin-pill-neutral';
        }
    }

    formatAmount(value: number | null | undefined): string {
        if (value == null) {
            return '—';
        }
        return `${value.toLocaleString(this._transloco.getActiveLang())} ₫`;
    }

    formatDate(value: string | null | undefined): string {
        if (!value) {
            return '—';
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? '—'
            : date.toLocaleDateString(this._transloco.getActiveLang());
    }

    private _describe(err: unknown, fallbackKey: string): Promise<string> {
        return describeApiError(
            err,
            (key) => this._transloco.translate(key),
            fallbackKey
        );
    }

    private _t(key: string): string {
        return this._transloco.translate(key);
    }

    private _number(value: number): string {
        return value.toLocaleString(this._transloco.getActiveLang());
    }
}
