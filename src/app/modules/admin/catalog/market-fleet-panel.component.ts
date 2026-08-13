import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { AdminService } from '../admin.service';
import { AdminUserRow } from '../admin.types';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';

/** How many rows to pull for the driver roster. */
const DRIVER_PAGE_SIZE = 200;

/**
 * The driver tab shared by the market create and detail pages.
 *
 * The roster is platform-wide and the panel says so: a driver is eligible
 * across hubs, and nothing in the backend ties one to a chợ. Listing them here
 * still answers the question the tab asks — which tài xế exist to serve this
 * chợ — without pretending they belong to it. Read-only for the same reason:
 * there is no assignment to make.
 *
 * Fetches on init, and the host only creates it when its tab is open, so an
 * unopened tab costs nothing.
 */
@Component({
    selector: 'admin-market-fleet-panel',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    host: { class: 'flex flex-auto flex-col' },
    imports: [AdminLoadingStateComponent, TranslocoModule],
    template: `
        <div class="flex flex-col gap-4 p-6 md:p-8" *transloco="let t">
            <div class="text-secondary text-sm">
                {{ t('admin.markets.editPage.fleet.shared') }}
            </div>
            @if (loading()) {
                <admin-loading-state />
            } @else if (drivers().length === 0) {
                <div class="text-secondary">{{ t('admin.crud.empty') }}</div>
            } @else {
                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    @for (driver of drivers(); track driver.id) {
                        <div
                            class="bg-card flex flex-col gap-1 rounded-2xl p-4 shadow"
                        >
                            <div class="truncate font-semibold">
                                {{ driver.email || driver.id }}
                            </div>
                            <div class="text-secondary text-sm">
                                {{ driver.phone || '—' }}
                            </div>
                        </div>
                    }
                </div>
            }
        </div>
    `,
})
export class MarketFleetPanelComponent implements OnInit {
    private readonly _admin = inject(AdminService);

    readonly drivers = signal<AdminUserRow[]>([]);
    readonly loading = signal(false);

    ngOnInit(): void {
        void this._load();
    }

    private async _load(): Promise<void> {
        this.loading.set(true);
        try {
            const page = await this._admin
                .getUsers({ role: 'driver', pageSize: DRIVER_PAGE_SIZE })
                .catch(() => ({ users: [] as AdminUserRow[], totalCount: 0 }));
            this.drivers.set(page.users);
        } finally {
            this.loading.set(false);
        }
    }
}
