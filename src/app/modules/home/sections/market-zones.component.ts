import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    signal,
    untracked,
    ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { activeLang } from 'app/core/i18n/active-lang';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { CatalogService } from 'app/modules/catalog/catalog.service';
import { MarketZone } from '../storefront-landing.types';

/**
 * Section 3: "Đi một vòng quanh chợ".
 *
 * Categories rendered as **stalls** rather than as a taxonomy — each tile reads
 * "Sạp <tên>", so the buyer is picking a stall to walk up to, not filtering a
 * category tree. One round portrait per stall with its name and count beneath,
 * biggest aisle first, so the row reads the way a buyer walks a market.
 *
 * Artwork is the category's own `imageUrl` and nothing else. There used to be a
 * regex table mapping category names to emoji, which guessed wrong on anything
 * it had not been taught and was owned by no one — a category with no picture
 * falls back to its own initial ({@link zoneInitial}), which claims nothing
 * about what the aisle sells.
 *
 * Counts are real, and they count **this chợ's** listings
 * (`CatalogService.marketCategoryCounts()`) — what the buyer can actually put
 * in a basket today. They used to count the whole catalogue through
 * `GET /products`, which needs a session: a signed-out visitor got 401, every
 * count fell to zero, and this board — on the landing page of a deliberately
 * open storefront — said there were no aisles at all.
 */
@Component({
    selector: 'market-zones',
    templateUrl: './market-zones.component.html',
    styleUrls: ['./market-zones.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatIconModule, RouterLink, TranslocoModule],
})
export class MarketZonesComponent {
    private _catalog = inject(CatalogService);
    private _markets = inject(MarketSelectionService);

    private readonly _lang = activeLang();
    readonly isVi = computed(() => this._lang() === 'vi');

    private readonly _counts = signal<ReadonlyMap<string, number>>(new Map());

    /**
     * Root categories with something in them, biggest first. A child's products
     * count towards its parent, because the buyer picks the aisle, not the shelf.
     * An empty aisle is not worth walking into, so zero-count zones are dropped.
     */
    readonly zones = computed<MarketZone[]>(() => {
        const counts = this._counts();
        return this._catalog
            .categoryTree()
            .map((node) => {
                const own = counts.get(node.id) ?? 0;
                const fromChildren = node.children.reduce(
                    (sum, child) => sum + (counts.get(child.id) ?? 0),
                    0
                );
                return {
                    id: node.id,
                    name: node.name,
                    nameEn: node.nameEn,
                    imageUrl: node.imageUrl,
                    itemCount: own + fromChildren,
                };
            })
            .filter((zone) => zone.itemCount > 0)
            .sort((a, b) => b.itemCount - a.itemCount);
    });

    constructor() {
        this._catalog
            .getCategories()
            .pipe(takeUntilDestroyed())
            .subscribe(() => void this._loadCounts());

        // The board belongs to the chợ on screen, so switching market re-counts
        // rather than leaving the previous chợ's aisles up.
        effect(() => {
            this._markets.selectedId();
            void this._loadCounts();
        });
    }

    zoneLabel(zone: MarketZone): string {
        return this.isVi() ? zone.name : zone.nameEn;
    }

    /**
     * First letter of the aisle's own name, for a category the admin has not
     * given a picture yet. Upper-cased per the active locale so a Vietnamese
     * name keeps its diacritic ("Ớ", not "O").
     */
    zoneInitial(zone: MarketZone): string {
        return this.zoneLabel(zone)
            .trim()
            .charAt(0)
            .toLocaleUpperCase(this._lang());
    }

    private async _loadCounts(): Promise<void> {
        const marketId = untracked(() => this._markets.selectedId());
        if (!marketId) {
            // No chợ chosen yet: the picker is the next thing the visitor does,
            // and counting some other market's aisles would be a guess.
            this._counts.set(new Map());
            return;
        }
        this._counts.set(await this._catalog.marketCategoryCounts(marketId));
    }
}
