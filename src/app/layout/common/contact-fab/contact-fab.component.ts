import {
    ChangeDetectionStrategy,
    Component,
    input,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@jsverse/transloco';

interface ContactFabAction {
    id: string;
    labelKey: string;
    href: string;
    external: boolean;
    /** Brand image under `public/` (Zalo / Messenger). */
    image?: string;
    /** Fuse / Heroicons svgIcon id (Hotline). */
    matIcon?: string;
}

/**
 * Floating contact FAB (ref: support mascot + expand to Zalo / Messenger / Hotline).
 * Sits above the scroll-to-top control on the storefront enterprise layout.
 */
@Component({
    selector: 'contact-fab',
    templateUrl: './contact-fab.component.html',
    styleUrl: './contact-fab.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatIconModule, MatTooltipModule, TranslocoModule],
})
export class ContactFabComponent {
    /** Lift the cluster when the scroll-top control is visible. */
    readonly raised = input(false);

    readonly open = signal(false);

    readonly actions: readonly ContactFabAction[] = [
        {
            id: 'zalo',
            labelKey: 'contactFab.zalo',
            href: 'https://zalo.me/',
            image: 'zalo.webp',
            external: true,
        },
        {
            id: 'messenger',
            labelKey: 'contactFab.messenger',
            href: 'https://www.messenger.com/',
            image: 'messenger.svg',
            external: true,
        },
        {
            id: 'hotline',
            labelKey: 'contactFab.hotline',
            href: 'tel:+1900777525',
            matIcon: 'heroicons_outline:phone',
            external: false,
        },
    ];

    toggle(): void {
        this.open.update((value) => !value);
    }

    close(): void {
        this.open.set(false);
    }
}
