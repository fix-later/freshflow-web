import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Shared brand panel for the auth pages (sign-in / sign-up): the dark
 * FreshFlow surface with logo, tagline and decorative leaves. Colors are the
 * splash-screen brand values (see public/styles/splash-screen.css) — the
 * brand-dark surface has no theme token yet.
 *
 * Host fills its padded parent; the template paints full-bleed with rounded
 * corners so the panel sits inset on the top / left / bottom edges.
 */
@Component({
    selector: 'auth-brand-panel',
    templateUrl: './auth-brand-panel.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: {
        class: 'relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem]',
    },
    imports: [TranslocoModule],
})
export class AuthBrandPanelComponent {
    readonly year = new Date().getFullYear();
}
