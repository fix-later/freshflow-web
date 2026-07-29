import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { RestaurantInvoicesService } from '../../restaurant-invoices.service';
import { invoiceStatusPillClass } from '../../restaurant-invoices.status';
import { InvoiceRow } from '../../restaurant-invoices.types';

const DERIVED_ROW_KEYS = new Set(['id', 'items']);

/**
 * Read-only invoice detail, rendered generically (the backend declares no
 * response schema for `GET /invoices/{id}`) — mirrors the admin invoice
 * detail's field-reflection approach.
 */
@Component({
    selector: 'restaurant-invoice-detail',
    templateUrl: './invoice-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatButtonModule,
        MatIconModule,
        MatProgressBarModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class InvoiceDetailComponent implements OnInit {
    private readonly _service = inject(RestaurantInvoicesService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _transloco = inject(TranslocoService);

    readonly invoice = signal<InvoiceRow | null>(null);
    readonly loading = signal(false);
    readonly notFound = signal(false);
    readonly statusPillClass = invoiceStatusPillClass;

    ngOnInit(): void {
        const id = this._route.snapshot.paramMap.get('invoiceId') ?? '';
        if (!id) {
            this.notFound.set(true);
            return;
        }
        this.loading.set(true);
        this._service
            .getInvoice(id)
            .then((row) => {
                this.invoice.set(row);
                this.notFound.set(!row);
            })
            .catch(() => this.notFound.set(true))
            .finally(() => this.loading.set(false));
    }

    detailEntries(row: InvoiceRow): { label: string; value: string }[] {
        return this._rawScalars(row)
            .filter(([key]) => !DERIVED_ROW_KEYS.has(key))
            .map(([key, value]) => ({
                label: this._humanize(key),
                value: this._displayValue(key, value),
            }));
    }

    itemsOf(row: InvoiceRow | null): Record<string, unknown>[] {
        const items = row?.['items'];
        return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
    }

    itemEntries(
        item: Record<string, unknown>
    ): { label: string; value: string }[] {
        return this._rawScalars(item).map(([key, value]) => ({
            label: this._humanize(key),
            value: this._displayValue(key, value),
        }));
    }

    private _rawScalars(obj: unknown): [string, unknown][] {
        if (!obj || typeof obj !== 'object') {
            return [];
        }
        return Object.entries(obj as Record<string, unknown>).filter(
            ([, v]) =>
                v === null ||
                v === undefined ||
                ['string', 'number', 'boolean'].includes(typeof v)
        );
    }

    private _humanize(key: string): string {
        const spaced = key
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .replace(/\bId\b/gi, 'ID')
            .trim();
        return spaced.charAt(0).toUpperCase() + spaced.slice(1);
    }

    private _displayValue(key: string, value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        if (typeof value === 'boolean') {
            return value ? '✓' : '✗';
        }
        if (
            typeof value === 'number' &&
            /(amount|price|total|subtotal)/i.test(key)
        ) {
            return `${value.toLocaleString(this._transloco.getActiveLang())} ₫`;
        }
        if (typeof value === 'string' && /(At|Date)$/.test(key)) {
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) {
                return date.toLocaleString(this._transloco.getActiveLang());
            }
        }
        return String(value);
    }
}
