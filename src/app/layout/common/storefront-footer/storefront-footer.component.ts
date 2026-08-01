import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

/**
 * The storefront footer — contact strip, newsletter, link columns, copyright.
 *
 * Extracted from the enterprise layout so a second storefront layout (the
 * catalog's) can present a different header while keeping this footer
 * byte-identical, rather than the 220 lines being copied and drifting apart.
 */
@Component({
    selector: 'storefront-footer',
    templateUrl: './storefront-footer.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatIconModule, RouterLink],
})
export class StorefrontFooterComponent {
    /** Support hotline, shown in the contact strip. */
    readonly hotline = {
        text: '+1 900 777525',
        href: 'tel:+1900777525',
    };

    get currentYear(): number {
        return new Date().getFullYear();
    }
}
