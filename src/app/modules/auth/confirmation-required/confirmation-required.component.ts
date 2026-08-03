import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FuseAlertComponent, FuseAlertType } from '@fuse/components/alert';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { apiErrorMessage } from 'app/core/api/envelope';
import { authApi } from 'contract';

/** The backend mints codes per channel; email is the only one the web app uses. */
const CHANNEL = 'email';

/**
 * Post-registration email verification (`POST /auth/verify`, with
 * `POST /auth/verify/request` to re-send). The address arrives as a query
 * param from sign-up; a visitor who lands here directly (a bookmarked link, a
 * reload after clearing state) can type it in.
 */
@Component({
    selector: 'auth-confirmation-required',
    templateUrl: './confirmation-required.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FuseAlertComponent,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        ReactiveFormsModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class AuthConfirmationRequiredComponent {
    private readonly _fb = inject(FormBuilder);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _transloco = inject(TranslocoService);

    readonly verifying = signal(false);
    readonly resending = signal(false);
    readonly verified = signal(false);
    readonly alert = signal<{ type: FuseAlertType; message: string } | null>(
        null
    );

    readonly form = this._fb.group({
        email: this._fb.nonNullable.control(
            this._route.snapshot.queryParamMap.get('email') ?? '',
            { validators: [Validators.required, Validators.email] }
        ),
        code: this._fb.nonNullable.control('', {
            validators: [Validators.required],
        }),
    });

    async verify(): Promise<void> {
        if (this.form.invalid || this.verifying()) {
            this.form.markAllAsTouched();
            return;
        }
        const { email, code } = this.form.getRawValue();
        this.verifying.set(true);
        this.alert.set(null);
        try {
            await authApi.apiV1AuthVerifyPost({
                verifyRequest: {
                    identifier: email.trim(),
                    channel: CHANNEL,
                    code: code.trim(),
                },
            });
            this.verified.set(true);
            this.alert.set({
                type: 'success',
                message: this._transloco.translate('auth.verify.success'),
            });
            // Give the success state a beat to register before leaving.
            setTimeout(() => void this._router.navigate(['/sign-in']), 1500);
        } catch (err) {
            this.alert.set({
                type: 'error',
                message:
                    (await apiErrorMessage(err)) ??
                    this._transloco.translate('auth.verify.error'),
            });
        } finally {
            this.verifying.set(false);
        }
    }

    /** Re-sends the code. Only the address is needed, not a valid code. */
    async resend(): Promise<void> {
        const email = this.form.controls.email;
        if (email.invalid || this.resending()) {
            email.markAsTouched();
            return;
        }
        this.resending.set(true);
        this.alert.set(null);
        try {
            await authApi.apiV1AuthVerifyRequestPost({
                requestVerificationRequest: {
                    identifier: email.value.trim(),
                    channel: CHANNEL,
                },
            });
            this.alert.set({
                type: 'success',
                message: this._transloco.translate('auth.verify.resent'),
            });
        } catch (err) {
            this.alert.set({
                type: 'error',
                message:
                    (await apiErrorMessage(err)) ??
                    this._transloco.translate('auth.verify.resendError'),
            });
        } finally {
            this.resending.set(false);
        }
    }
}
