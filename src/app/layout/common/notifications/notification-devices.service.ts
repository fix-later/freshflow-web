import { Injectable, computed, signal } from '@angular/core';
import { notificationDeviceApi } from 'contract';

/** Storage key for this browser's stable device id (see {@link deviceId}). */
const DEVICE_ID_KEY = 'ff.notification.deviceId';
/** Storage key for the push token last registered from this browser. */
const DEVICE_TOKEN_KEY = 'ff.notification.deviceToken';

/**
 * Whether this browser can receive web push at all, and why not when it can't.
 * Each value renders as its own message — a browser that cannot subscribe must
 * say so rather than showing a toggle that silently does nothing.
 */
export type PushSupport =
    | 'supported'
    | 'unsupported-browser'
    | 'permission-denied'
    | 'not-configured';

/**
 * Registers this browser as a push target
 * (`POST` / `DELETE /api/v1/notifications/devices`).
 *
 * `RegisterNotificationDeviceRequest` takes `token`, `platform` and `deviceId`,
 * all nullable strings — the backend keeps no other device metadata, so that is
 * exactly what is sent. The token comes from the browser's own `PushManager`
 * subscription; the app does not mint one.
 *
 * **Web push needs a VAPID public key and a service worker.** Neither is
 * configured in this app's environment, so {@link support} reports
 * `not-configured` and the UI explains that instead of offering a control that
 * cannot work. Everything else here is ready for the day the key lands: only
 * `_subscribe()` needs the key wired in.
 */
@Injectable({ providedIn: 'root' })
export class NotificationDevicesService {
    /** Token registered from this browser, or `null` when not registered. */
    private readonly _token = signal<string | null>(
        readStored(DEVICE_TOKEN_KEY)
    );

    readonly registeredToken = this._token.asReadonly();
    readonly isRegistered = computed(() => !!this._token());

    /**
     * A stable id for this browser, generated once and kept in local storage
     * so re-registering replaces the same device row instead of adding one per
     * visit. Not an identity — it is cleared whenever site data is.
     */
    get deviceId(): string {
        const existing = readStored(DEVICE_ID_KEY);
        if (existing) {
            return existing;
        }
        const generated = crypto.randomUUID();
        writeStored(DEVICE_ID_KEY, generated);
        return generated;
    }

    /** `platform` sent with the registration — this client is always the web app. */
    readonly platform = 'web';

    /** Why push is or isn't available here. See {@link PushSupport}. */
    support(): PushSupport {
        if (
            typeof Notification === 'undefined' ||
            !('serviceWorker' in navigator) ||
            !('PushManager' in window)
        ) {
            return 'unsupported-browser';
        }
        if (Notification.permission === 'denied') {
            return 'permission-denied';
        }
        // No VAPID key is configured for this environment (see class comment).
        return 'not-configured';
    }

    /**
     * Registers `token` for this browser. Exposed separately from the push
     * subscription so a token obtained by any means (native shell, future push
     * provider) can be registered through the same path.
     */
    async register(token: string): Promise<void> {
        await notificationDeviceApi.apiV1NotificationsDevicesPost({
            registerNotificationDeviceRequest: {
                token,
                platform: this.platform,
                deviceId: this.deviceId,
            },
        });
        this._token.set(token);
        writeStored(DEVICE_TOKEN_KEY, token);
    }

    /**
     * Unregisters the token this browser registered. A 404 means the backend
     * already dropped it, which is the state the caller wanted — the local
     * record is cleared either way by {@link forget}.
     */
    async unregister(): Promise<void> {
        const token = this._token();
        if (!token) {
            return;
        }
        await notificationDeviceApi.apiV1NotificationsDevicesDelete({
            unregisterNotificationDeviceRequest: { token },
        });
        this.forget();
    }

    /** Drops the local record without calling the backend. */
    forget(): void {
        this._token.set(null);
        writeStored(DEVICE_TOKEN_KEY, null);
    }
}

function readStored(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        // Storage can be blocked (private mode, third-party cookie policy).
        return null;
    }
}

function writeStored(key: string, value: string | null): void {
    try {
        if (value === null) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, value);
        }
    } catch {
        // Non-fatal: the device just re-registers on the next visit.
    }
}
