import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { ApiLabelPipe } from 'app/core/i18n/api-label.pipe';
import { invoiceStatusPillClass } from 'app/shared/status-pills';
import { openInvoiceSheet } from './invoice-sheet/open-invoice-sheet';
import { RestaurantInvoicesService } from './restaurant-invoices.service';
import { InvoiceRow } from './restaurant-invoices.types';

const PAGE_SIZE = 10;

/**
 * "Hóa đơn" — the signed-in restaurant's own invoices.
 *
 * Says what Admin ▸ Nhà hàng ▸ Hóa đơn says about the same rows: the issuing
 * state in words rather than the API's own token, and both documents
 * downloadable from the list — the XML an accounting system reads, and the PDF
 * a person does.
 */
@Component({
    selector: 'restaurant-invoices-list',
    templateUrl: './invoices-list.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        ApiLabelPipe,
        MatButtonModule,
        MatIconModule,
        MatProgressBarModule,
        MatTooltipModule,
        TranslocoModule,
    ],
})
export class InvoicesListComponent implements OnInit {
    private readonly _service = inject(RestaurantInvoicesService);
    private readonly _dialog = inject(MatDialog);
    private readonly _transloco = inject(TranslocoService);

    readonly statusPillClass = invoiceStatusPillClass;

    readonly rows = signal<InvoiceRow[]>([]);
    readonly loading = signal(false);
    /** Localized reason the read failed (400 bad filter, 403, 5xx, offline). */
    readonly loadError = signal<string | null>(null);
    readonly totalCount = signal(0);
    readonly page = signal(1);

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.loadError.set(null);
        this._service
            .listInvoices({ page: this.page(), pageSize: PAGE_SIZE })
            .then(({ invoices, totalCount }) => {
                this.rows.set(invoices);
                this.totalCount.set(totalCount);
            })
            .catch(async (err) => {
                // An empty table after a failed read would read as "no
                // invoices"; name the reason and keep the retry available.
                this.rows.set([]);
                this.totalCount.set(0);
                this.loadError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'restaurantInvoices.loadError'
                    )
                );
            })
            .finally(() => this.loading.set(false));
    }

    hasNextPage(): boolean {
        return this.page() * PAGE_SIZE < this.totalCount();
    }

    nextPage(): void {
        if (!this.hasNextPage()) {
            return;
        }
        this.page.update((p) => p + 1);
        this.load();
    }

    previousPage(): void {
        if (this.page() <= 1) {
            return;
        }
        this.page.update((p) => p - 1);
        this.load();
    }

    /**
     * The invoice opens over the list. It is a document to glance at — the
     * number, what it was for, whether the provider issued it — and a page
     * navigation lost the place in a list that pages.
     */
    openInvoice(row: InvoiceRow): void {
        openInvoiceSheet(this._dialog, row.id, row);
    }

    /** Which row has a document in flight, so only that one's button waits. */
    readonly exportingId = signal<string | null>(null);
    readonly downloadingPdfId = signal<string | null>(null);
    /** Localized reason the last download was refused, kept above the list. */
    readonly downloadError = signal<string | null>(null);

    /** The e-invoice XML (`GET /invoices/{id}/export`). */
    exportInvoice(row: InvoiceRow): void {
        if (this.exportingId()) {
            return;
        }
        this.exportingId.set(row.id);
        this.downloadError.set(null);
        this._service
            .exportInvoice(row.id)
            .then((file) => this._save(file))
            .catch(async (err) => {
                this.downloadError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'restaurantInvoices.exportError'
                    )
                );
            })
            .finally(() => this.exportingId.set(null));
    }

    /**
     * The PDF (`GET /invoices/{id}/pdf`).
     *
     * The server renders sandbox invoices only; a provider-issued one answers
     * 422 `INVOICE_PDF_PROVIDER_REQUIRED`, and that exact reason is what shows.
     * The button stays enabled because whether an invoice is sandbox is not
     * something this row knows.
     */
    downloadPdf(row: InvoiceRow): void {
        if (this.downloadingPdfId()) {
            return;
        }
        this.downloadingPdfId.set(row.id);
        this.downloadError.set(null);
        this._service
            .downloadInvoicePdf(row.id)
            .then((file) => this._save(file))
            .catch(async (err) => {
                this.downloadError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'restaurantInvoices.downloadPdfError'
                    )
                );
            })
            .finally(() => this.downloadingPdfId.set(null));
    }

    private _save({ blob, fileName }: { blob: Blob; fileName: string }): void {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    formatDate(value: string | null | undefined): string {
        if (!value) {
            return '—';
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? '—'
            : date.toLocaleString(this._transloco.getActiveLang());
    }

    /**
     * The day alone, for the payment deadline. `dueAt` is a date the invoice is
     * owed by, and printing the instant it was derived from ("09:20:00
     * 13/9/2026") reads as an hour in the day that money has to arrive.
     */
    formatDay(value: string | null | undefined): string {
        if (!value) {
            return '—';
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? '—'
            : date.toLocaleDateString(this._transloco.getActiveLang());
    }

    formatAmount(value: number | null | undefined): string {
        if (value == null) {
            return '—';
        }
        return `${value.toLocaleString(this._transloco.getActiveLang())} ₫`;
    }
}
