import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * 500 — a static, directly reachable page (`/500`) for a server/runtime
 * failure. Not auto-triggered by every 5xx response (that's a separate,
 * bigger change to the global error/HTTP handling); this just gives the app
 * a branded page to show or link to when one is needed.
 */
@Component({
    selector: 'error-500',
    templateUrl: './error-500.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatButtonModule, MatIconModule, RouterLink, TranslocoModule],
})
export class Error500Component {
    reload(): void {
        window.location.reload();
    }
}
