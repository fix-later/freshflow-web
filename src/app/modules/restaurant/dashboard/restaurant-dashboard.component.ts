import { DatePipe, DecimalPipe } from '@angular/common';
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
 * Layout: approval/setup first when needed, then a credit hero (available as
 * the lead figure), usage meter, quick links, and recent ledger activity.
 * Data from existing credit + approval endpoints only.
 */
@Component({
    selector: 'restaurant-dashboard',
    templateUrl: './restaurant-dashboard.component.html',
    styleUrl: './restaurant-dashboard.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        DatePipe,
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
        // Live field is `outstandingBalance`; `currentBalance` is only an
        // alias, so reading it alone pinned the bar at empty.
        const snapshot = this.balance();
        const used =
            snapshot?.outstandingBalance ?? snapshot?.currentBalance ?? 0;
        if (limit <= 0) {
            return 0;
        }
        return Math.min(100, Math.round((used / limit) * 100));
    });

    /** The five most recent movements — the overview stays a summary. */
    readonly recentTransactions = computed(() =>
        this.transactions().slice(0, 5)
    );

    readonly shortcuts = [
        {
            id: 'credit',
            link: '/profile/credit',
            icon: 'heroicons_outline:banknotes',
            labelKey: 'restaurantCredit.title',
        },
        {
            id: 'invoices',
            link: '/profile/invoices',
            icon: 'heroicons_outline:receipt-percent',
            labelKey: 'restaurantProfile.tabs.invoices',
        },
        {
            id: 'scheduled',
            link: '/profile/scheduled',
            icon: 'heroicons_outline:arrow-path',
            labelKey: 'scheduledOrders.title',
        },
        {
            id: 'business',
            link: '/profile/business',
            icon: 'heroicons_outline:building-storefront',
            labelKey: 'restaurantProfile.profile.sectionTitle',
        },
    ] as const;

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
