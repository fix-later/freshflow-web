import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AdminService } from '../admin.service';
import { AdminInvoiceRow } from '../admin.types';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import {
    ADMIN_DEFAULT_PAGE_SIZE,
    toApiPage,
    toPageIndex,
} from '../shared/admin-pagination';
import { CoalescedTask } from '../shared/coalesced-task';

/** Pill class for an invoice status — same lifecycle-coloring idiom used elsewhere. */
function invoiceStatusPillClass(status: string | null | undefined): string {
    switch (String(status ?? '').toLowerCase()) {
        case 'paid':
        case 'settled':
            return 'admin-pill admin-pill-success';
        case 'overdue':
        case 'cancelled':
        case 'void':
            return 'admin-pill admin-pill-danger';
        case 'pending':
        case 'issued':
            return 'admin-pill admin-pill-warning';
        case 'draft':
            return 'admin-pill admin-pill-info';
        default:
            return 'admin-pill admin-pill-neutral';
    }
}

/**
 * Admin ▸ Invoices — read-only financial oversight, extending the credit
 * management the admin console already has full control over (M6 Credit).
 */
@Component({
    selector: 'admin-invoices-list',
    templateUrl: './invoices-list.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatProgressBarModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
    styles: [
        `
            .invoices-grid {
                grid-template-columns:
                    minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.8fr)
                    minmax(0, 0.9fr) minmax(0, 0.9fr) 5rem;
            }
        `,
    ],
})
export class InvoicesListComponent implements OnInit {
    private readonly _admin = inject(AdminService);
    private readonly _router = inject(Router);
    private readonly _transloco = inject(TranslocoService);

    readonly statusPillClass = invoiceStatusPillClass;

    readonly invoices = signal<AdminInvoiceRow[]>([]);
    readonly totalCount = signal(0);
    readonly pageIndex = signal(0);
    readonly pageSize = signal(ADMIN_DEFAULT_PAGE_SIZE);
    readonly loading = signal(false);

    readonly restaurantId = new FormControl('', { nonNullable: true });
    readonly status = new FormControl('', { nonNullable: true });

    ngOnInit(): void {
        this._load();
        this.restaurantId.valueChanges.subscribe(() => {
            this.pageIndex.set(0);
            this._load();
        });
        this.status.valueChanges.subscribe(() => {
            this.pageIndex.set(0);
            this._load();
        });
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex.set(event.pageIndex);
        this.pageSize.set(event.pageSize);
        this._load();
    }

    openDetail(row: AdminInvoiceRow): void {
        this._router.navigate(['/admin/invoices', row.id], {
            state: { invoice: row },
        });
    }

    trackById(index: number, row: AdminInvoiceRow): string {
        return row.id || String(index);
    }

    formatDate(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '';
        }
        const date = new Date(String(value));
        return Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleString(this._transloco.getActiveLang());
    }

    money(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        const amount = Number(value);
        return Number.isNaN(amount)
            ? String(value)
            : `${amount.toLocaleString(this._transloco.getActiveLang())} ₫`;
    }

    private _load(): void {
        this._loadTask.trigger();
    }

    private readonly _loadTask = new CoalescedTask(async () => {
        this.loading.set(true);
        try {
            const result = await this._admin.getInvoices({
                restaurantId: this.restaurantId.value.trim() || undefined,
                status: this.status.value.trim() || undefined,
                page: toApiPage(this.pageIndex()),
                pageSize: this.pageSize(),
            });
            this.invoices.set(result.invoices);
            this.totalCount.set(result.totalCount);
            if (result.page) {
                this.pageIndex.set(toPageIndex(result.page));
            }
            if (result.pageSize) {
                this.pageSize.set(result.pageSize);
            }
        } catch {
            this.invoices.set([]);
            this.totalCount.set(0);
        } finally {
            this.loading.set(false);
        }
    });
}
