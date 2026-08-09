import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    signal,
    viewChild,
    ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { FreshflowProcessComponent } from './sections/freshflow-process.component';
import { MarketHeroComponent } from './sections/market-hero.component';
import { MarketSpecialtiesComponent } from './sections/market-specialties.component';
import { MarketZonesComponent } from './sections/market-zones.component';
import { OrderCutoffComponent } from './sections/order-cutoff.component';
import { RecommendedBasketComponent } from './sections/recommended-basket.component';
import { TodayHighlightsComponent } from './sections/today-highlights.component';
import { TomorrowMenuComponent } from './sections/tomorrow-menu.component';

/**
 * The storefront landing: "Chợ hôm nay có gì?".
 *
 * A shell, not a page. Each of the nine sections resolves its own data, so this
 * component only orders them and mediates the single piece of cross-section
 * state: picking a kitchen type in section 6 selects the matching basket in
 * section 5. Routing that through here rather than letting the two sections
 * reach into each other keeps every section independently removable.
 *
 * The closing call to action is inline rather than a ninth component: it is a
 * headline and one button, and a file trio for that would be ceremony.
 *
 * Section order is the buyer's walk through a market and is specified in
 * `specs/004-storefront-landing/spec.md` (FR-001). Do not reorder without
 * updating it.
 */
@Component({
    selector: 'home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        FreshflowProcessComponent,
        MarketHeroComponent,
        MarketSpecialtiesComponent,
        MarketZonesComponent,
        OrderCutoffComponent,
        RecommendedBasketComponent,
        TodayHighlightsComponent,
        TomorrowMenuComponent,
        MatIconModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class HomeComponent {
    /** Which kitchen type the buyer picked in "Mai bán gì?", if any. */
    readonly selectedKindId = signal<string | null>(null);

    private readonly _basketSection =
        viewChild<ElementRef<HTMLElement>>('basketSection');

    /**
     * The basket section sits *above* the kitchen-type chips, so selecting a
     * kitchen has to carry the buyer back up to it. Without the scroll the
     * selection would appear to do nothing.
     */
    onKindSelected(kindId: string): void {
        this.selectedKindId.set(kindId);
        const el = this._basketSection()?.nativeElement;
        if (!el) {
            return;
        }
        const reduced = window.matchMedia?.(
            '(prefers-reduced-motion: reduce)'
        ).matches;
        el.scrollIntoView({
            behavior: reduced ? 'auto' : 'smooth',
            block: 'start',
        });
    }
}
