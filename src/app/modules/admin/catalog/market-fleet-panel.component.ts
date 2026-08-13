import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    inject,
    input,
    signal,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { AdminService } from '../admin.service';
import { AdminUserRow } from '../admin.types';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { CrudRow } from '../shared/resource-crud.types';

/** How many rows to pull for the driver roster. */
const DRIVER_PAGE_SIZE = 200;

interface FleetCard {
    id: string;
    title: string;
    detail: string;
}

/**
 * The vehicle / driver tab shared by the market create and detail pages.
 *
 * Both lists are platform-wide and the panel says so: a `Vehicle` carries
 * neither a market nor a hub, and drivers are eligible across hubs, so there is
 * nothing to filter by. Rendering them here still answers the question the tab
 * asks — which xe and which tài xế exist to serve this chợ — without pretending
 * the rows belong to it.
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
            } @else if (cards().length === 0) {
                <div class="text-secondary">{{ t('admin.crud.empty') }}</div>
            } @else {
                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    @for (card of cards(); track card.id) {
                        <div
                            class="bg-card flex flex-col gap-1 rounded-2xl p-4 shadow"
                        >
                            <div class="truncate text-lg font-semibold">
                                {{ card.title }}
                            </div>
                            <div class="text-secondary text-sm">
                                {{ card.detail }}
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
    private readonly _logistics = inject(LogisticsAdminService);

    readonly kind = input.required<'vehicles' | 'drivers'>();

    readonly cards = signal<FleetCard[]>([]);
    readonly loading = signal(false);

    ngOnInit(): void {
        void this._load();
    }

    private async _load(): Promise<void> {
        this.loading.set(true);
        try {
            this.cards.set(
                this.kind() === 'vehicles'
                    ? this._toVehicleCards(
                          await this._logistics.listVehicles().catch(() => [])
                      )
                    : this._toDriverCards(
                          await this._admin
                              .getUsers({
                                  role: 'driver',
                                  pageSize: DRIVER_PAGE_SIZE,
                              })
                              .then((page) => page.users)
                              .catch(() => [])
                      )
            );
        } finally {
            this.loading.set(false);
        }
    }

    private _toVehicleCards(rows: CrudRow[]): FleetCard[] {
        return rows.map((row) => {
            const type = String(row['vehicleType'] ?? '');
            const capacity = row['capacityKg'];
            return {
                id: row.id,
                title: String(row['plateNumber'] ?? '') || row.id,
                detail:
                    [type, capacity ? `${capacity} kg` : '']
                        .filter(Boolean)
                        .join(' · ') || '—',
            };
        });
    }

    private _toDriverCards(rows: AdminUserRow[]): FleetCard[] {
        return rows.map((row) => ({
            id: row.id,
            title: row.email || row.id,
            detail: row.phone || '—',
        }));
    }
}
