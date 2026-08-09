import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { QuickSignInService } from 'app/layout/common/quick-sign-in/quick-sign-in.service';

/**
 * The single place the storefront asks "does this need an account?".
 *
 * The storefront is browsable by guests (`OptionalAuthGuard`), so every control
 * that acts on an account — favourite, add to cart, order — is reachable
 * without one. Left alone those calls just 401 and the button appears to do
 * nothing, which reads as a broken page rather than as a reason to sign up.
 *
 * This turns that into an invitation: the control stays visible and clickable
 * (hiding it would also hide the reason to register), and a guest who uses it
 * gets the header's quick sign-in popup instead of silence.
 *
 * It governs the **UI only**. The server is still authoritative — every gated
 * call would be refused anyway (BR-AUTH-4), and this must never be the sole
 * thing standing between a guest and an action.
 */
@Injectable({ providedIn: 'root' })
export class GuestGateService {
    private _permissions = inject(PermissionsService);
    private _quickSignIn = inject(QuickSignInService);
    private _router = inject(Router);

    /** True when there is an account to act as. */
    isSignedIn(): boolean {
        return this._permissions.isSignedIn();
    }

    /**
     * Gate an account-bound action.
     *
     * Returns `true` when the caller may proceed. For a guest it opens the
     * quick sign-in popup and returns `false`, so the call site reads as a
     * plain guard:
     *
     * ```ts
     * addToCart(product) {
     *     if (!this.gate.requireAccount()) { return; }
     *     …
     * }
     * ```
     *
     * When no popup is mounted (`QuickSignInService.open()` reports that), it
     * falls back to the sign-in page carrying `redirectURL`, so the guest lands
     * back where they were instead of on the generic home.
     */
    requireAccount(): boolean {
        if (this.isSignedIn()) {
            return true;
        }
        if (!this._quickSignIn.open()) {
            void this._router.navigate(['/sign-in'], {
                queryParams: { redirectURL: this._router.url },
            });
        }
        return false;
    }
}
