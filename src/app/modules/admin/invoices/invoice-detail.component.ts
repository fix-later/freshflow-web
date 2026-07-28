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
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AdminService } from '../admin.service';
import { AdminInvoiceRow } from '../admin.types';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';

const DERIVED_ROW_KEYS = new Set(['id', 'items']);

/**
 * Admin ▸ Invoices ▸ Detail — read-only invoice overview, rendered generically
 * (the backend declares no response schema for `GET /invoices/{id}`).
 */
@Component({
    selector: 'admin-invoice-detail',
    templateUrl: './invoice-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
        MatIconModule,
        MatProgressBarModule,
        MatTooltipModule,
        TranslocoModule,
    ],
})
export class InvoiceDetailComponent implements OnInit {
    private readonly _admin = inject(AdminService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _transloco = inject(TranslocoService);

    readonly invoice = signal<AdminInvoiceRow | null>(null);
    readonly loading = signal(false);
    readonly notFound = signal(false);

    ngOnInit(): void {
        const id = this._route.snapshot.paramMap.get('invoiceId') ?? '';
        const passed = (history.state?.invoice ??
            null) as AdminInvoiceRow | null;
        if (passed && passed.id === id) {
            this.invoice.set(passed);
        } else if (id) {
            this._fetch(id);
        } else {
            this.notFound.set(true);
        }
    }

    goBack(): void {
        void this._router.navigate(['/admin/invoices']);
    }

    detailEntries(row: AdminInvoiceRow): { label: string; value: string }[] {
        return this._rawScalars(row)
            .filter(([key]) => !DERIVED_ROW_KEYS.has(key))
            .map(([key, value]) => ({
                label: this._humanize(key),
                value: this._displayValue(key, value),
            }));
    }

    itemsOf(row: AdminInvoiceRow | null): Record<string, unknown>[] {
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

    private _fetch(id: string): void {
        this.loading.set(true);
        this._admin
            .getInvoice(id)
            .then((row) => {
                this.invoice.set(row);
                this.notFound.set(!row);
            })
            .catch(() => this.notFound.set(true))
            .finally(() => this.loading.set(false));
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
