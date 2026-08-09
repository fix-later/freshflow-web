import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import {
    Market,
    MarketSelectionService,
} from 'app/core/market/market-selection.service';
import { MarketStrength } from '../storefront-landing.types';

/**
 * Section 4: "Mỗi chợ một thế mạnh".
 *
 * The markets a buyer can shop from, with what each is known for.
 *
 * The speciality line is the market's own `description`, written by whoever
 * administers the market record. There is no speciality field in the system,
 * and pairing "Thủ Đức" with "rau củ" in the front end would be inventing
 * business logic, so a market with no description simply shows no speciality.
 * That is the honest failure mode. See the Gap Register in the plan.
 */
@Component({
    selector: 'market-specialties',
    templateUrl: './market-specialties.component.html',
    styleUrls: ['./market-specialties.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatIconModule, TranslocoModule],
})
export class MarketSpecialtiesComponent {
    private _markets = inject(MarketSelectionService);
    private _router = inject(Router);

    readonly loading = this._markets.loading;

    /**
     * The `Market` rides along on each row so `explore` can hand it straight to
     * `select()` without looking it up again by id.
     */
    readonly strengths = computed<(MarketStrength & { market: Market })[]>(
        () => {
            const selectedId = this._markets.selectedId();
            return this._markets.markets().map((market) => ({
                id: market.id,
                name: market.name,
                address: market.address ?? '',
                imageUrl: market.imageUrl ?? '',
                specialty: market.description ?? '',
                isSelected: market.id === selectedId,
                market,
            }));
        }
    );

    constructor() {
        void this._markets.ensureLoaded();
    }

    /**
     * Choosing a market re-scopes every market-dependent section on this page,
     * then carries the buyer into that market's catalogue. Selecting without
     * navigating would leave them looking at a page that silently changed.
     */
    explore(market: Market): void {
        this._markets.select(market);
        void this._router.navigate(['/catalog']);
    }
}
