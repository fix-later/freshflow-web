import {
    ChangeDetectionStrategy,
    Component,
    inject,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import {
    NotificationDevicesService,
    PushSupport,
} from 'app/layout/common/notifications/notification-devices.service';
import { NotificationsService } from 'app/layout/common/notifications/notifications.service';
import { AccountShellComponent } from 'app/modules/restaurant/account-shell/account-shell.component';

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
        MatIconModule,
        MatSlideToggleModule,
        MatSnackBarModule,
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
