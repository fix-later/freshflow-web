import { inject, Injectable } from '@angular/core';
import { AuthUtils } from 'app/core/auth/auth.utils';
import { UserService } from 'app/core/user/user.service';
import {
    ApprovalStatus,
    toApprovalStatus,
    User,
} from 'app/core/user/user.types';
import {
    authApi,
    clearTokens,
    getAccessToken,
    getRefreshToken,
    restaurantProfileApi,
    setAccessToken,
    setTokens,
} from 'contract';
import { firstValueFrom, from, Observable, of, tap } from 'rxjs';

/** `data` of `POST /api/v1/auth/login` (and `/refresh`); untyped in the spec. */
interface AuthTokensData {
    accessToken: string;
    refreshToken?: string | null;
}

function unwrap<T>(body: unknown): T | undefined {
    if (body && typeof body === 'object' && 'data' in body) {
        return (body as { data?: T }).data;
    }
    return body as T;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private _authenticated = false;
    private _userService = inject(UserService);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    set accessToken(token: string) {
        setAccessToken(token);
    }

    get accessToken(): string {
        return getAccessToken() ?? '';
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /** Sign in with email **or** phone + password (BR-AUTH-2). */
    signIn(credentials: {
        identifier: string;
        password: string;
    }): Observable<User> {
        return from(this._signIn(credentials)).pipe(
            tap(() => (this._authenticated = true))
        );
    }

    /**
     * Self-register a restaurant (`POST /api/v1/auth/register`, UC-AUTH-11),
     * then mint and send the email verification code
     * (`POST /api/v1/auth/verify/request`). Register alone creates the account;
     * it does not send the code — without the second call the user only gets
     * mail after manually pressing "resend" on the confirmation screen.
     *
     * Account is usable after verify + Admin approval (BR-AUTH-1). `phone` and
     * `taxCode` are optional per the contract.
     */
    async signUp(user: {
        email: string;
        password: string;
        restaurantName: string;
        phone?: string;
        taxCode?: string;
    }): Promise<void> {
        await authApi.apiV1AuthRegisterPost({
            registerRestaurantRequest: {
                email: user.email,
                password: user.password,
                restaurantName: user.restaurantName,
                phone: user.phone,
                taxCode: user.taxCode?.trim() || undefined,
            },
        });

        // Best-effort: the account already exists. If this fails (mail outage,
        // rate limit), the confirmation page's resend still works.
        try {
            await authApi.apiV1AuthVerifyRequestPost({
                requestVerificationRequest: {
                    identifier: user.email,
                    channel: 'email',
                },
            });
        } catch {
            // Intentionally empty — see comment above.
        }
    }

    /** Request a password-reset link/code for an email or phone. */
    forgotPassword(identifier: string): Observable<void> {
        return from(
            authApi.apiV1AuthForgotPasswordPost({
                forgotPasswordRequest: { identifier },
            })
        );
    }

    /** Complete a password reset with the emailed token. */
    resetPassword(token: string, newPassword: string): Observable<void> {
        return from(
            authApi.apiV1AuthResetPasswordPost({
                resetPasswordRequest: { token, newPassword },
            })
        );
    }

    /** Change the signed-in user's password. */
    changePassword(
        currentPassword: string,
        newPassword: string
    ): Observable<void> {
        return from(
            authApi.apiV1AuthChangePasswordPost({
                changePasswordRequest: { currentPassword, newPassword },
            })
        );
    }

    /** Sign out: revoke the refresh token server-side, then clear local state. */
    signOut(): Observable<boolean> {
        return from(this._signOut());
    }

    /** Restore/validate the session for route guards. */
    check(): Observable<boolean> {
        if (this._authenticated) {
            return of(true);
        }
        if (!this.accessToken) {
            return of(false);
        }
        return from(this._restore(AuthUtils.isTokenExpired(this.accessToken)));
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    private async _signIn(credentials: {
        identifier: string;
        password: string;
    }): Promise<User> {
        const res = await authApi.apiV1AuthLoginPostRaw({
            loginRequest: {
                identifier: credentials.identifier,
                password: credentials.password,
            },
        });
        const data = unwrap<AuthTokensData>(await res.raw.json());
        if (!data?.accessToken) {
            throw new Error('Invalid login response');
        }
        setTokens(data.accessToken, data.refreshToken);
        await this._loadUser();
        return this._userService.current as User;
    }

    private async _signOut(): Promise<boolean> {
        const refreshToken = getRefreshToken();
        try {
            if (refreshToken) {
                await authApi.apiV1AuthLogoutPost({
                    logoutRequest: { refreshToken },
                });
            }
        } catch {
            // Best-effort revoke; sign out locally regardless.
        }
        clearTokens();
        this._authenticated = false;
        return true;
    }

    /** Refresh (if expired), then load the user profile; false on any failure. */
    private async _restore(expired: boolean): Promise<boolean> {
        try {
            if (expired && !(await this._refresh())) {
                clearTokens();
                return false;
            }
            await this._loadUser();
            this._authenticated = true;
            return true;
        } catch {
            clearTokens();
            this._authenticated = false;
            return false;
        }
    }

    private async _refresh(): Promise<boolean> {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
            return false;
        }
        try {
            const res = await authApi.apiV1AuthRefreshPostRaw({
                refreshRequest: { refreshToken },
            });
            const data = unwrap<AuthTokensData>(await res.raw.json());
            if (!data?.accessToken) {
                return false;
            }
            setTokens(data.accessToken, data.refreshToken ?? refreshToken);
            return true;
        } catch {
            return false;
        }
    }

    /** Load `/profile/me` and resolve the (restaurant) approval status. */
    private async _loadUser(): Promise<void> {
        const user = await firstValueFrom(this._userService.get());
        const approvalStatus: ApprovalStatus =
            user.role === 'restaurant'
                ? await this._fetchApprovalStatus()
                : 'approved';
        this._userService.patch({ approvalStatus });
    }

    private async _fetchApprovalStatus(): Promise<ApprovalStatus> {
        try {
            const res =
                await restaurantProfileApi.apiV1RestaurantsMeApprovalStatusGetRaw();
            const data = unwrap<{ status?: string }>(await res.raw.json());
            return toApprovalStatus(data?.status);
        } catch {
            return 'pending';
        }
    }
}
