import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

/**
 * The storefront footer — contact strip, newsletter, link columns,
 * app-download CTAs, and copyright.
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

    /** App-store CTAs under the link columns (links are placeholders until stores ship). */
    readonly appStores = [
        {
            id: 'app-store',
            name: 'App Store',
            eyebrow: 'Tải trên',
            label: 'Tải FreshFlow trên App Store',
            href: 'https://apps.apple.com',
            logo: 'app-store-icon.svg',
        },
        {
            id: 'google-play',
            name: 'Google Play',
            eyebrow: 'Tải trên',
            label: 'Tải FreshFlow trên Google Play',
            href: 'https://play.google.com/store',
            logo: 'google-play-icon.svg',
        },
    ];

    get currentYear(): number {
        return new Date().getFullYear();
    }
}
