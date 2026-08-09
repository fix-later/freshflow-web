import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { activeLang } from 'app/core/i18n/active-lang';
import { CatalogService } from 'app/modules/catalog/catalog.service';
import { MarketZone } from '../storefront-landing.types';

/**
 * Zone markers, matched against a category's name. Purely presentational: a
 * category with no match still renders, with the default basket marker, so a
 * new category never disappears from the aisle board.
 */
const ZONE_MARKERS: readonly (readonly [RegExp, string])[] = [
    [/rau|vegetable|greens/i, '🥬'],
    [/trái cây|trai cay|fruit/i, '🍉'],
    [/hải sản|hai san|seafood|cá|fish/i, '🐟'],
    [/thịt|thit|meat|pork|beef/i, '🥩'],
    [/gia vị|gia vi|spice|sauce/i, '🌶️'],
    [/trứng|trung|egg/i, '🥚'],
    [/gạo|gao|rice|grain/i, '🍚'],
    [/nấm|nam|mushroom/i, '🍄'],
    [/đồ uống|do uong|drink|beverage/i, '🥤'],
    [/khô|kho|dry|dried/i, '🫙'],
];

const DEFAULT_MARKER = '🧺';

/**
 * Section 3: "Đi một vòng quanh chợ".
 *
 * Categories rendered as areas of a market rather than as a taxonomy, so the
 * buyer feels they are choosing an aisle to walk into. Tiles vary in size,
 * biggest aisle first, which is both how a real market is laid out and how the
 * page avoids a repetitive card grid.
 *
 * Counts are real, from `CatalogService.categoryCounts()`, which costs no
 * request. They count the catalogue rather than this market's listings: the
 * listing endpoint reports no total. The label says so.
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
                    marker: markerFor(node.name, node.nameEn),
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
    }

    zoneLabel(zone: MarketZone): string {
        return this.isVi() ? zone.name : zone.nameEn;
    }

    private async _loadCounts(): Promise<void> {
        this._counts.set(await this._catalog.categoryCounts());
    }
}

function markerFor(name: string, nameEn: string): string {
    for (const [pattern, marker] of ZONE_MARKERS) {
        if (pattern.test(name) || pattern.test(nameEn)) {
            return marker;
        }
    }
    return DEFAULT_MARKER;
}
