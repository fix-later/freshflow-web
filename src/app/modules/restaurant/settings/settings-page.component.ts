import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import {
    applyApiErrorToForm,
    clearServerErrors,
    fieldErrorKey,
    serverError,
} from 'app/core/api/form-errors';
import { passwordStrengthValidator } from 'app/core/api/validators';
import { AuthService } from 'app/core/auth/auth.service';
import {
    NotificationDevicesService,
    PushSupport,
} from 'app/layout/common/notifications/notification-devices.service';
import { NotificationsService } from 'app/layout/common/notifications/notifications.service';
import { AccountShellComponent } from 'app/modules/restaurant/account-shell/account-shell.component';
import { map } from 'rxjs';

/**
 * `/settings` — notification preferences, the only settings surface the
 * backend actually exposes (`Notification` + `NotificationDevice`).
 *
 * Laid out like Digg's and X's notification settings: a "General" group whose
 * first row is web push for this device, each row a label plus one line saying
 * what it does. There is no notification-preferences API (no per-type opt-in
 * endpoint exists), so only the two real controls are offered — nothing here
 * pretends to save a setting the server does not store.
 */
@Component({
    selector: 'settings-page',
    templateUrl: './settings-page.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex w-full min-w-0 flex-auto flex-col' },
    imports: [
        AccountShellComponent,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSlideToggleModule,
        MatSnackBarModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
})
export class SettingsPageComponent {
    private readonly _devices = inject(NotificationDevicesService);
    private readonly _notifications = inject(NotificationsService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    /** Why push is or isn't available in this browser — each renders its own row. */
    readonly pushSupport: PushSupport = this._devices.support();
    readonly isRegistered = this._devices.isRegistered;
    readonly busy = signal(false);
    /** Localized reason the last register/unregister call failed. */
    readonly error = signal<string | null>(null);

    // ── Security ─────────────────────────────────────────────────────────

    private readonly _auth = inject(AuthService);
    private readonly _formBuilder = inject(FormBuilder);

    readonly changingPassword = signal(false);
    readonly passwordError = signal<string | null>(null);

    /**
     * `ChangePasswordRequest`: `currentPassword` `minLength: 1`, `newPassword`
     * `minLength: 8`. The strength rules beyond the length are the backend's
     * (`^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$`), applied here too so a
     * weak password is refused at the field rather than as a 400.
     */
    readonly passwordForm = this._formBuilder.nonNullable.group({
        currentPassword: ['', [Validators.required]],
        newPassword: [
            '',
            [
                Validators.required,
                Validators.minLength(8),
                passwordStrengthValidator,
            ],
        ],
        confirmPassword: ['', [Validators.required]],
    });

    /** Template helpers for per-field messages. */
    readonly errorKey = fieldErrorKey;
    readonly serverMessage = serverError;

    /**
     * True when the two new-password boxes disagree. Checked here rather than
     * as a cross-field validator so each control keeps its own error state and
     * the message can sit under the box it belongs to.
     */
    readonly passwordMismatch = computed(() => {
        const { newPassword, confirmPassword } = this._passwordValue();
        return confirmPassword.length > 0 && newPassword !== confirmPassword;
    });

    private readonly _passwordValue = toSignal(
        this.passwordForm.valueChanges.pipe(
            map(() => this.passwordForm.getRawValue())
        ),
        { initialValue: this.passwordForm.getRawValue() }
    );

    changePassword(): void {
        if (
            this.passwordForm.invalid ||
            this.passwordMismatch() ||
            this.changingPassword()
        ) {
            this.passwordForm.markAllAsTouched();
            return;
        }
        const { currentPassword, newPassword } =
            this.passwordForm.getRawValue();
        this.changingPassword.set(true);
        this.passwordError.set(null);
        clearServerErrors(this.passwordForm);

        this._auth.changePassword(currentPassword, newPassword).subscribe({
            next: () => {
                this.changingPassword.set(false);
                this.passwordForm.reset();
                this._notify('settings.security.password.success');
            },
            error: async (err: unknown) => {
                this.changingPassword.set(false);
                await applyApiErrorToForm(this.passwordForm, err, (key) =>
                    this._transloco.translate(key)
                );
                this.passwordError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'settings.security.password.error'
                    )
                );
            },
        });
    }

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }

    /** Unread-only filter on the notification list (`is_read`). */
    readonly unreadOnly = this._notifications.unreadOnly;

    /**
     * The push toggle is only actionable when the browser can subscribe *and*
     * a push key is configured. Every other case renders as an explanation
     * rather than a disabled control with no stated reason.
     */
    canTogglePush(): boolean {
        return this.pushSupport === 'supported';
    }

    /** i18n key explaining the current {@link PushSupport} state. */
    pushStateKey(): string {
        switch (this.pushSupport) {
            case 'unsupported-browser':
                return 'settings.push.unsupported';
            case 'permission-denied':
                return 'settings.push.denied';
            case 'not-configured':
                return 'settings.push.notConfigured';
            default:
                return 'settings.push.hint';
        }
    }

    async togglePush(enabled: boolean): Promise<void> {
        if (this.busy() || !this.canTogglePush()) {
            return;
        }
        this.busy.set(true);
        this.error.set(null);
        try {
            if (enabled) {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    // The browser refused — nothing was sent to the backend.
                    this.error.set(
                        this._transloco.translate('settings.push.denied')
                    );
                    return;
                }
                // Reached only once a push key is configured; `support()`
                // reports `not-configured` until then, so this path cannot run
                // today — and it deliberately does not fabricate a token.
                throw new Error('PUSH_NOT_CONFIGURED');
            }
            await this._devices.unregister();
            this._toast('settings.push.unregistered');
        } catch (err) {
            this.error.set(
                await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'settings.push.error'
                )
            );
        } finally {
            this.busy.set(false);
        }
    }

    async toggleUnreadOnly(unreadOnly: boolean): Promise<void> {
        await this._notifications.setUnreadOnly(unreadOnly);
    }

    private _toast(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }
}
