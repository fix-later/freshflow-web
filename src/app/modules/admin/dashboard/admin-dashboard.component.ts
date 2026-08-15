import {
    ChangeDetectionStrategy,
    Component,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { UserService } from 'app/core/user/user.service';
import { User } from 'app/core/user/user.types';
import { Subject, takeUntil } from 'rxjs';
import { AdminAnalyticsPanelComponent } from '../analytics/analytics-dashboard.component';
import { AuditLogsComponent } from '../audit-logs/audit-logs.component';
import { ClaimsListComponent } from '../claims/claims-list.component';
import { FinanceComponent } from '../finance/finance.component';
import {
    DASHBOARD_TABS,
    dashboardTabIndexOf,
    dashboardTabSlugOf,
} from './dashboard-tabs';

/**
 * Admin ▸ Dashboard (`/admin`) — the console's single reporting page.
 *
 * Four panels that were four separate destinations (analytics at `/admin`,
 * finance, claims, and the audit log, which had a screen but no way to reach
 * it) now sit behind one tab bar. They are read together, not navigated
 * between: each answers a different half of "how is the platform doing", and
 * splitting them across a nav branch meant three round trips through the menu
 * to assemble one picture.
 *
 * Only the open tab is rendered (`@if`, not a hidden-but-instantiated panel),
 * so opening the dashboard issues one panel's requests rather than all four
 * at once. Switching tabs mounts the next panel, which is what loads it.
 *
 * The tab travels as `?tab=`, so a panel is linkable and survives a reload —
 * and the retired `/admin/finance` · `/admin/claims` · `/admin/audit-logs`
 * paths redirect onto the matching tab rather than 404ing.
 */
@Component({
    selector: 'admin-dashboard',
    templateUrl: './admin-dashboard.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminAnalyticsPanelComponent,
        AuditLogsComponent,
        ClaimsListComponent,
        FinanceComponent,
        MatIconModule,
        MatTabsModule,
        TranslocoModule,
    ],
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _userService = inject(UserService);
    private readonly _unsubscribeAll = new Subject<void>();

    readonly tabs = DASHBOARD_TABS;
    readonly selectedTab = signal(0);
    readonly user = signal<User | null>(null);

    readonly displayName = computed(() => {
        const current = this.user();
        return current?.fullName || current?.name || current?.email || '';
    });

    /** Subtitle under the greeting — says what the open tab is showing. */
    readonly subtitleKey = computed(
        () => `${this.tabs[this.selectedTab()].label}Hint`
    );

    ngOnInit(): void {
        this._userService.user$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((user) => this.user.set(user));

        // The open tab travels as `?tab=`, which is also where the retired
        // `/admin/finance` · `/admin/claims` · `/admin/audit-logs` paths
        // redirect to. An unrecognised slug falls back to analytics.
        this.selectedTab.set(
            dashboardTabIndexOf(this._route.snapshot.queryParamMap.get('tab'))
        );
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    onTabChange(index: number): void {
        if (index === this.selectedTab()) {
            return;
        }
        this.selectedTab.set(index);

        // `replaceUrl` so moving across the tabs does not build a back-stack
        // the user has to unwind one tab at a time to leave the dashboard.
        void this._router.navigate([], {
            relativeTo: this._route,
            queryParams: { tab: dashboardTabSlugOf(index) },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
    }
}
