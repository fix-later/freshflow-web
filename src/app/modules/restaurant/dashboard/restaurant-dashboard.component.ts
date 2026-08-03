import { DecimalPipe } from '@angular/common';
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { RestaurantCreditService } from '../credit/restaurant-credit.service';
import {
    CreditTransaction,
    RestaurantCreditBalance,
} from '../credit/restaurant-credit.types';
import { RestaurantScheduledOrdersService } from '../scheduled-orders/scheduled-orders.service';
import { RestaurantApprovalStatus } from '../scheduled-orders/scheduled-orders.types';
import { SetupChecklistComponent } from '../setup/setup-checklist.component';

/**
 * Restaurant overview — the landing section of the profile area.
 *
 * Layout follows the wallet pattern the reference boards converge on (Uvodo,
 * Mercury): a row of headline figures first, then the most recent ledger
 * activity beneath. Every figure comes from an endpoint the app already calls,
 * so this adds a view rather than a new data contract:
 *
 *  - credit limit / used / available — `GET /restaurants/{id}/credit`
 *  - recent movements               — `GET /restaurants/{id}/credit/transactions`
 *
 * Money is read-only here; acting on it belongs to the credit and invoice
 * sections, which this page links to.
 */
@Component({
    selector: 'restaurant-dashboard',
    templateUrl: './restaurant-dashboard.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        DecimalPipe,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        RouterLink,
        TranslocoModule,
        SetupChecklistComponent,
    ],
})
export class RestaurantDashboardComponent implements OnInit {
    private readonly _creditService = inject(RestaurantCreditService);
    private readonly _ordersService = inject(RestaurantScheduledOrdersService);

    readonly loading = signal(true);
    readonly balance = signal<RestaurantCreditBalance | null>(null);
    readonly transactions = signal<CreditTransaction[]>([]);
    readonly approval = signal<RestaurantApprovalStatus | null>(null);

    /**
     * A restaurant awaiting approval can browse but not order (BR-AUTH-1). The
     * overview says so up front rather than letting the buyer find out at
     * checkout.
     */
    readonly isPendingApproval = computed(() => {
        const status = (this.approval()?.status ?? '').toLowerCase();
        return status === 'pending' || status === 'pending_approval';
    });

    /** How much of the limit is committed, for the usage bar. */
    readonly usedRatio = computed(() => {
        const limit = this.balance()?.creditLimit ?? 0;
        const used = this.balance()?.currentBalance ?? 0;
        if (limit <= 0) {
            return 0;
        }
        return Math.min(100, Math.round((used / limit) * 100));
    });

    /** The five most recent movements — the overview stays a summary. */
    readonly recentTransactions = computed(() =>
        this.transactions().slice(0, 5)
    );

    async ngOnInit(): Promise<void> {
        this.loading.set(true);
        try {
            // Both calls are independent; a failure in one must not blank the
            // other, so they settle rather than race to a single rejection.
            const [balance, transactions, approval] = await Promise.allSettled([
                this._creditService.getBalance(),
                this._creditService.listTransactions(),
                this._ordersService.getApprovalStatus(),
            ]);

            if (balance.status === 'fulfilled') {
                this.balance.set(balance.value);
            }
            if (transactions.status === 'fulfilled') {
                this.transactions.set(transactions.value.transactions ?? []);
            }
            if (approval.status === 'fulfilled') {
                this.approval.set(approval.value);
            }
        } finally {
            this.loading.set(false);
        }
    }

    /** Ledger entries that reduce the balance read as credits, not charges. */
    isPayment(transaction: CreditTransaction): boolean {
        return (transaction.amount ?? 0) < 0;
    }
}
