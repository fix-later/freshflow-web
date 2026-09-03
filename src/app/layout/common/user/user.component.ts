import { BooleanInput } from '@angular/cdk/coercion';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    computed,
    inject,
    Input,
    OnDestroy,
    OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { UserService } from 'app/core/user/user.service';
import { User } from 'app/core/user/user.types';
import {
    accountMenuItems,
    AccountShellNavItem,
} from 'app/modules/restaurant/account-area-nav';
import { RestaurantCreditService } from 'app/modules/restaurant/credit/restaurant-credit.service';
import { RestaurantCreditBalance } from 'app/modules/restaurant/credit/restaurant-credit.types';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'user',
    templateUrl: './user.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    exportAs: 'user',
    standalone: true,
    imports: [
        MatMenuModule,
        MatIconModule,
        MatTooltipModule,
        MatDividerModule,
        TranslocoModule,
        RouterLink,
    ],
})
export class UserComponent implements OnInit, OnDestroy {
    /* eslint-disable @typescript-eslint/naming-convention */
    static ngAcceptInputType_showAvatar: BooleanInput;
    /* eslint-enable @typescript-eslint/naming-convention */

    @Input() showAvatar: boolean = true;
    /** `null` once the session ends — the menu already reads it optionally. */
    user: User | null = null;

    private readonly _creditService = inject(RestaurantCreditService);
    private readonly _transloco = inject(TranslocoService);

    /** The credit snapshot, loaded when the menu opens. */
    readonly balance = signal<RestaurantCreditBalance | null>(null);
    readonly balanceLoading = signal(false);

    /** BR-AUTH-1 — approved restaurants (and non-restaurant roles set to approved). */
    get isApproved(): boolean {
        return this.user?.approvalStatus === 'approved';
    }

    /**
     * Credit is a restaurant concept. `GET /restaurants/{id}/credit` resolves
     * its id from the signed-in restaurant's profile, and no other role has one
     * to resolve — asking anyway would 404 on every menu open.
     */
    get showBalance(): boolean {
        return this.user?.role === 'restaurant';
    }

    /**
     * What the buyer can still spend — the figure this menu exists to surface.
     *
     * `availableCredit` is optional in a payload these types read defensively,
     * so it is derived when absent: the credit page already defines it as the
     * limit minus what is owed, and showing a dash beside the two figures that
     * give it away would be a worse answer than doing the subtraction.
     */
    readonly availableCredit = computed(() => {
        const snapshot = this.balance();
        if (!snapshot) {
            return null;
        }
        if (snapshot.availableCredit != null) {
            return snapshot.availableCredit;
        }
        const limit = snapshot.creditLimit;
        const owed = snapshot.outstandingBalance ?? snapshot.currentBalance;
        return limit != null && owed != null ? limit - owed : null;
    });

    /**
     * What the restaurant currently owes. The live field is
     * `outstandingBalance`; `currentBalance` is only a tolerated alias, so
     * reading it alone would report zero on every real response.
     */
    readonly outstanding = computed(() => {
        const snapshot = this.balance();
        return snapshot?.outstandingBalance ?? snapshot?.currentBalance ?? null;
    });

    /**
     * The shortcut destinations for this role, taken from the same source as
     * the account rail so the two can never disagree about what exists.
     */
    menuItems(): readonly AccountShellNavItem[] {
        return accountMenuItems(this.user?.role === 'restaurant');
    }

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _router: Router,
        private _userService: UserService
    ) {}

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Subscribe to user changes
        this._userService.user$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((user: User | null) => {
                this.user = user;

                // Mark for check
                this._changeDetectorRef.markForCheck();
            });
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void {
        // Unsubscribe from all subscriptions
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Loads the credit snapshot as the menu opens.
     *
     * On open rather than on init: this menu sits in the header of every page,
     * and a figure nobody has asked to see is not worth a request per
     * navigation. A previously loaded value stays on screen while the refresh
     * runs, so reopening the menu shows the last known balance instead of
     * blinking back to dashes.
     */
    async onMenuOpened(): Promise<void> {
        if (!this.showBalance || this.balanceLoading()) {
            return;
        }
        this.balanceLoading.set(true);
        try {
            this.balance.set(await this._creditService.getBalance());
        } catch {
            // A dropdown is the wrong place for an error banner: the figures
            // stay as em dashes and the credit page carries the real message.
        } finally {
            this.balanceLoading.set(false);
        }
    }

    /** Matches the credit page's formatting so the two cannot disagree. */
    formatAmount(value: number | null | undefined): string {
        if (value == null) {
            return '—';
        }
        return `${value.toLocaleString(this._transloco.getActiveLang())} ₫`;
    }

    /**
     * Sign out
     */
    signOut(): void {
        this._router.navigate(['/sign-out']);
    }
}
