import {
    ChangeDetectionStrategy,
    Component,
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
import { TodayHighlightsComponent } from './sections/today-highlights.component';

/**
 * The storefront landing: "Chợ hôm nay có gì?".
 *
 * A shell, not a page. Each section resolves its own data, so this component
 * only orders them — there is no cross-section state left to mediate since the
 * recommended-basket and "Mai bán gì?" sections were dropped.
 *
 * The closing call to action is inline rather than its own component: it is a
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
        TodayHighlightsComponent,
        MatIconModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class HomeComponent {}
