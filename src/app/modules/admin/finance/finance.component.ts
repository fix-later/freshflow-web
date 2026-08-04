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
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
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

    readonly sortedRows = computed(() => [...this.rows()].sort(byRisk));
    readonly totals = computed(() => creditTotals(this.rows()));

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

    openInvoices(): void {
        void this._router.navigate(['/admin/invoices']);
    }

    openInvoice(invoice: FinanceInvoiceRow): void {
        if (invoice.id) {
            void this._router.navigate(['/admin/invoices', invoice.id]);
        }
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
}
