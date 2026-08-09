import {
    ChangeDetectionStrategy,
    Component,
    inject,
    input,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { GuestGateService } from 'app/core/auth/guest-gate.service';

/**
 * What a guest sees where a signed-in user would see their own data.
 *
 * The storefront is open to guests, so `/cart`, `/wishlist` and the like are
 * reachable without an account. Rendering their ordinary empty state there is
 * a lie by omission — "your cart is empty" is not why the cart is empty — and
 * it gives the visitor no reason to register. This says the actual reason and
 * offers the two ways forward.
 *
 * Deliberately a panel rather than a route guard: a redirect would throw away
 * the URL the guest arrived on, and these pages are worth linking to.
 */
@Component({
    selector: 'sign-in-required',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatButtonModule, MatIconModule, RouterLink, TranslocoModule],
    template: `
        <div
            class="flex flex-col items-center justify-center px-4 py-16 text-center"
            *transloco="let t"
        >
            <div
                class="flex h-20 w-20 items-center justify-center rounded-full bg-primary-50"
            >
                <mat-icon
                    class="text-primary icon-size-10"
                    [svgIcon]="icon()"
                ></mat-icon>
            </div>

            <h2 class="mt-6 text-2xl font-bold tracking-tight">
                {{ t(titleKey()) }}
            </h2>
            <p class="text-secondary mt-2 max-w-md">
                {{ t(descriptionKey()) }}
            </p>

            <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                    mat-flat-button
                    color="primary"
                    type="button"
                    (click)="signIn()"
                >
                    {{ t('guest.signIn') }}
                </button>
                <a mat-stroked-button routerLink="/sign-up">
                    {{ t('guest.signUp') }}
                </a>
            </div>

            <!-- Registration is reviewed before an account can order (BR-AUTH-1),
                 so say that here rather than after the form is submitted. -->
            <p class="text-hint mt-4 max-w-md text-sm">
                {{ t('guest.approvalNote') }}
            </p>

            <a
                class="mt-6 font-medium text-primary hover:underline"
                routerLink="/catalog"
            >
                {{ t('guest.browseCatalog') }}
            </a>
        </div>
    `,
})
export class SignInRequiredComponent {
    private _guestGate = inject(GuestGateService);

    /** Heroicons name for the panel's mark — pass the one the page is about. */
    readonly icon = input('heroicons_outline:lock-closed');
    readonly titleKey = input('guest.required.title');
    readonly descriptionKey = input('guest.required.description');

    /**
     * Opens the header's quick sign-in popup, so the guest signs in without
     * losing the page. Falls back to `/sign-in` when no popup is mounted —
     * `GuestGateService` owns that decision.
     */
    signIn(): void {
        this._guestGate.requireAccount();
    }
}
