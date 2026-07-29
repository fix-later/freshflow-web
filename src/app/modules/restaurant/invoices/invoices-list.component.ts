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
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { RestaurantInvoicesService } from './restaurant-invoices.service';
import { invoiceStatusPillClass } from './restaurant-invoices.status';
import { InvoiceRow } from './restaurant-invoices.types';

const PAGE_SIZE = 10;

/** "Hóa đơn" — the signed-in restaurant's own invoices. */
@Component({
    selector: 'restaurant-invoices-list',
    templateUrl: './invoices-list.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatButtonModule,
        MatIconModule,
        MatProgressBarModule,
        TranslocoModule,
    ],
})
export class InvoicesListComponent implements OnInit {
    private readonly _service = inject(RestaurantInvoicesService);
    private readonly _router = inject(Router);
    private readonly _transloco = inject(TranslocoService);

    readonly statusPillClass = invoiceStatusPillClass;

    readonly rows = signal<InvoiceRow[]>([]);
    readonly loading = signal(false);
    readonly loadError = signal(false);
    readonly totalCount = signal(0);
    readonly page = signal(1);

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.loadError.set(false);
        this._service
            .listInvoices({ page: this.page(), pageSize: PAGE_SIZE })
            .then(({ invoices, totalCount }) => {
                this.rows.set(invoices);
                this.totalCount.set(totalCount);
            })
            .catch(() => this.loadError.set(true))
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

    openInvoice(row: InvoiceRow): void {
        void this._router.navigate(['/invoices', row.id]);
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

    formatAmount(value: number | null | undefined): string {
        if (value == null) {
            return '—';
        }
        return `${value.toLocaleString(this._transloco.getActiveLang())} ₫`;
    }
}
