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
 * Zones needed before the board takes its bento shape.
 *
 * The first two tiles are double-height, which only tiles cleanly when enough
 * ordinary tiles follow to fill the column beside them. Below this count the
 * board stays a uniform grid rather than leaving a hole where a market with
 * three aisles cannot fill the pattern.
 */
const MIN_ZONES_FOR_BENTO = 6;

/**
 * Section 3: "Đi một vòng quanh chợ".
 *
 * Categories rendered as **stalls** rather than as a taxonomy — each tile reads
 * "Sạp <tên>", so the buyer is picking a stall to walk up to, not filtering a
 * category tree. Tiles vary in size, biggest aisle first, which is both how a
 * real market is laid out and how the page avoids a repetitive card grid.
 *
 * Artwork is the category's own `imageUrl` and nothing else. There used to be a
 * regex table mapping category names to emoji, which guessed wrong on anything
 * it had not been taught and was owned by no one — a category with no picture
 * now simply shows no picture.
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
                    itemCount: own + fromChildren,
                };
            })
            .filter((zone) => zone.itemCount > 0)
            .sort((a, b) => b.itemCount - a.itemCount);
    });

    /** See {@link MIN_ZONES_FOR_BENTO} — a short board stays uniform. */
    readonly isBento = computed(
        () => this.zones().length >= MIN_ZONES_FOR_BENTO
    );

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
