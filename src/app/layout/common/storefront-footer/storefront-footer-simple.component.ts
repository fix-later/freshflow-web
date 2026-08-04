import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Compact storefront footer for account / app routes (profile, orders,
 * settings, cart, …). Marketing pages keep the full `storefront-footer`.
 */
@Component({
    selector: 'storefront-footer-simple',
    templateUrl: './storefront-footer-simple.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [TranslocoModule],
})
export class StorefrontFooterSimpleComponent {
    get currentYear(): number {
        return new Date().getFullYear();
    }
}
