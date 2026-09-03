import {
    ChangeDetectionStrategy,
    Component,
    inject,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { ApiLabelPipe } from 'app/core/i18n/api-label.pipe';
import { invoiceStatusPillClass } from 'app/shared/status-pills';
import { RestaurantInvoicesService } from '../restaurant-invoices.service';
import { InvoiceLine, InvoiceRow } from '../restaurant-invoices.types';

/** What the caller passes: an invoice id, or a row it already has. */
export interface InvoiceSheetData {
    invoiceId: string;
    /** Shown while the full invoice loads, so the sheet is never blank. */
    row?: InvoiceRow | null;
}

/**
 * A VAT invoice as the document it is, in a dialog.
 *
 * It used to be a page that reflected whatever fields came back — "BUYER TAX
 * CODE", "IS SANDBOX", "ERROR REASON" in raw English, in the order the JSON
 * happened to arrive. An invoice is a document a restaurant forwards to its
 * accountant: it has a shape, and the shape carries meaning. This lays it out
 * as one — issuer, buyer, lines, then the tax ladder — following the compact
 * printable invoice in the Fuse pages.
 *
 * A dialog rather than a route: reading an invoice is a glance from the list
 * or from the order it belongs to, and neither should lose its place.
 */
@Component({
    selector: 'invoice-sheet',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    templateUrl: './invoice-sheet.component.html',
    styleUrl: './invoice-sheet.component.scss',
    imports: [
        ApiLabelPipe,
        MatButtonModule,
        MatDialogModule,
        MatIconModule,
        MatProgressBarModule,
        TranslocoModule,
    ],
})
export class InvoiceSheetComponent {
    private readonly _service = inject(RestaurantInvoicesService);
    private readonly _transloco = inject(TranslocoService);
    private readonly _data = inject<InvoiceSheetData>(MAT_DIALOG_DATA);
    readonly dialogRef = inject(MatDialogRef<InvoiceSheetComponent>);

    readonly invoice = signal<InvoiceRow | null>(this._data.row ?? null);
    readonly loading = signal(true);
    readonly loadError = signal<string | null>(null);

    readonly statusPillClass = invoiceStatusPillClass;

    readonly downloadingPdf = signal(false);
    readonly exporting = signal(false);
    /**
     * Localized reason a document was refused — most often the 422 for an
     * invoice the provider issued, whose legal PDF this app may not re-render.
     */
    readonly downloadError = signal<string | null>(null);

    constructor() {
        this._service
            .getInvoice(this._data.invoiceId)
            .then((row) => {
                if (row) {
                    this.invoice.set(row);
                }
            })
            .catch(async (err) =>
                this.loadError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'restaurantInvoices.loadError'
                    )
                )
            )
            .finally(() => this.loading.set(false));
    }

    /** The invoice's own number, or its id while the provider has not issued one. */
    displayNumber(invoice: InvoiceRow): string {
        const serial = String(invoice.serial ?? '').trim();
        const number = String(invoice.number ?? '').trim();
        if (number) {
            return serial ? `${serial} · ${number}` : number;
        }
        return invoice.id.slice(0, 8);
    }

    lines(invoice: InvoiceRow | null): InvoiceLine[] {
        return Array.isArray(invoice?.lines) ? invoice.lines : [];
    }

    money(value: number | null | undefined): string {
        return `${Number(value ?? 0).toLocaleString(
            this._transloco.getActiveLang()
        )} ₫`;
    }

    /** Quantities are decimals on the wire; trailing zeros help nobody. */
    quantity(value: number | null | undefined): string {
        return Number(value ?? 0).toLocaleString(
            this._transloco.getActiveLang(),
            { maximumFractionDigits: 3 }
        );
    }

    date(value: string | null | undefined): string {
        if (!value) {
            return '—';
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? String(value)
            : date.toLocaleString(this._transloco.getActiveLang());
    }

    /** Empty fields read as a dash rather than vanishing from the document. */
    text(value: unknown): string {
        const text = String(value ?? '').trim();
        return text === '' ? '—' : text;
    }

    downloadPdf(): void {
        const invoice = this.invoice();
        if (!invoice || this.downloadingPdf()) {
            return;
        }
        this.downloadingPdf.set(true);
        this.downloadError.set(null);
        this._service
            .downloadInvoicePdf(invoice.id)
            .then((file) => this._save(file))
            .catch(async (err) => this._reportDownload(err))
            .finally(() => this.downloadingPdf.set(false));
    }

    exportXml(): void {
        const invoice = this.invoice();
        if (!invoice || this.exporting()) {
            return;
        }
        this.exporting.set(true);
        this.downloadError.set(null);
        this._service
            .exportInvoice(invoice.id)
            .then((file) => this._save(file))
            .catch(async (err) => this._reportDownload(err))
            .finally(() => this.exporting.set(false));
    }

    private _save({ blob, fileName }: { blob: Blob; fileName: string }): void {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    private async _reportDownload(err: unknown): Promise<void> {
        this.downloadError.set(
            await describeApiError(
                err,
                (key) => this._transloco.translate(key),
                'restaurantInvoices.downloadPdfError'
            )
        );
    }
}
