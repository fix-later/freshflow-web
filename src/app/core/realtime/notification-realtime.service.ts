import { Injectable, NgZone, type Signal, inject } from '@angular/core';
import { NotificationsService } from 'app/layout/common/notifications/notifications.service';
import {
    HUB_CONNECTION_FACTORY,
    RealtimeConnection,
    hubUrl,
} from './realtime-connection';

/** Server → client method name on `NotificationHub`. */
const NOTIFICATION_CREATED = 'NotificationCreated';

/**
 * The shape `NotificationHub` broadcasts — SignalR's JSON protocol serialises
 * `NotificationDto` camelCased, same as the REST bodies.
 */
export interface NotificationCreatedEvent {
    id: string;
    type: string;
    title: string;
    body: string;
    payload: string | null;
    isRead: boolean;
    readAt: string | null;
    createdAt: string;
    /** Same open shape the REST rows are parsed from — extra fields are kept. */
    [key: string]: unknown;
}

/**
 * Narrows a hub payload, which arrives as `unknown`.
 *
 * A hub message is not validated by anything on the way in — no OpenAPI, no
 * status code — so a renamed or reshaped field would otherwise land in the
 * panel as a row of `undefined`s. Anything that fails this is dropped; the
 * next list read still shows the notification.
 */
export function isNotificationCreatedEvent(
    value: unknown
): value is NotificationCreatedEvent {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const event = value as Partial<NotificationCreatedEvent>;
    return (
        typeof event.id === 'string' &&
        typeof event.type === 'string' &&
        typeof event.title === 'string' &&
        typeof event.body === 'string' &&
        (typeof event.payload === 'string' || event.payload === null) &&
        typeof event.isRead === 'boolean' &&
        (typeof event.readAt === 'string' || event.readAt === null) &&
        typeof event.createdAt === 'string'
    );
}

/** Kept for the callers (and tests) that assert the endpoint. */
export function notificationHubUrl(): string {
    return hubUrl('notifications');
}

/**
 * Live notifications over SignalR (`/hubs/notifications`).
 *
 * The hub puts every connection into `user:{userId}` from the JWT, so there is
 * no group to join — connecting is the whole subscription. Each broadcast is
 * pushed straight into {@link NotificationsService}, which owns the list and
 * the unread badge; this service owns only the connection.
 */
@Injectable({ providedIn: 'root' })
export class NotificationRealtimeService {
    private readonly _notifications = inject(NotificationsService);
    private readonly _connection = new RealtimeConnection(
        'notifications',
        inject(NgZone),
        inject(HUB_CONNECTION_FACTORY)
    );

    /** True while the hub connection is up. */
    readonly connected: Signal<boolean> = this._connection.connected;

    constructor() {
        this._connection.on(
            NOTIFICATION_CREATED,
            isNotificationCreatedEvent,
            (event) => this._notifications.receive(event)
        );
        // Anything broadcast while the socket was down was missed — the hub has
        // no replay — so the list is re-read rather than left with a hole in it.
        this._connection.onReconnected(() => this._notifications.reload());
    }

    /** Opens the feed for one subscriber (a mounted bell). */
    connect(): Promise<void> {
        return this._connection.connect();
    }

    /** Re-attempts after a sign-in, without claiming a subscriber. */
    resync(): Promise<void> {
        return this._connection.resync();
    }

    /** Releases one subscriber; the socket closes with the last one. */
    disconnect(): Promise<void> {
        return this._connection.disconnect();
    }
}
