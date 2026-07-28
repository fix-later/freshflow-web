import { Location } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * 404 — reached via the app-wide wildcard route (see `app.routes.ts`), so it
 * must render for guests and signed-in users alike. Same empty-state idiom as
 * the rest of the app (icon badge + heading + description + CTA — see
 * `cart.component.html`'s empty cart), not a one-off illustration.
 */
@Component({
    selector: 'error-404',
    templateUrl: './error-404.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatButtonModule, MatIconModule, RouterLink, TranslocoModule],
})
export class Error404Component {
    private readonly _location = inject(Location);

    goBack(): void {
        this._location.back();
    }
}
