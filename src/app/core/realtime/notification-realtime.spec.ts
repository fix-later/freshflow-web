import { NotificationsService } from 'app/layout/common/notifications/notifications.service';
import { environment } from 'environments/environment';
import {
    isNotificationCreatedEvent,
    notificationHubUrl,
} from './notification-realtime.service';

/** What `NotificationHub` actually puts on the wire (camelCased DTO). */
const BROADCAST = {
    id: 'notif-1',
    type: 'ORDER_DELIVERED',
    title: 'Đơn đã giao',
    body: 'Đơn CHO-1708 đã giao xong',
    payload: '{"service_date":"2026-08-24","market_name":"Chợ Bình Điền"}',
    isRead: false,
    readAt: null,
    createdAt: '2026-08-24T01:00:00Z',
};

/**
 * A hub message arrives as `unknown` — no OpenAPI, no status code, nothing
 * between the socket and the panel. The guard is the only thing standing
 * between a renamed backend field and a row of `undefined`s in the bell.
 */
describe('isNotificationCreatedEvent', () => {
    it('accepts what the hub broadcasts', () => {
        expect(isNotificationCreatedEvent(BROADCAST)).toBeTrue();
    });

    it('accepts a read notification with a readAt timestamp', () => {
        expect(
            isNotificationCreatedEvent({
                ...BROADCAST,
                isRead: true,
                readAt: '2026-08-24T02:00:00Z',
            })
        ).toBeTrue();
    });

    it('rejects a payload missing a field', () => {
        const { title: _title, ...withoutTitle } = BROADCAST;
        expect(isNotificationCreatedEvent(withoutTitle)).toBeFalse();
    });

    it('rejects a payload whose types drifted', () => {
        expect(
            isNotificationCreatedEvent({ ...BROADCAST, isRead: 'false' })
        ).toBeFalse();
        expect(
            isNotificationCreatedEvent({ ...BROADCAST, payload: { a: 1 } })
        ).toBeFalse();
    });

    it('rejects the non-objects a broken connection can deliver', () => {
        expect(isNotificationCreatedEvent(null)).toBeFalse();
        expect(isNotificationCreatedEvent('NotificationCreated')).toBeFalse();
        expect(isNotificationCreatedEvent([BROADCAST])).toBeFalse();
    });
});

describe('notificationHubUrl', () => {
    it('points beside the API root, not under /api/v1', () => {
        expect(notificationHubUrl()).toBe(
            `${environment.apiBaseUrl.replace(/\/+$/, '')}/hubs/notifications`
        );
        expect(notificationHubUrl()).not.toContain('/api/v1');
    });

    it('does not double up the slash when the base URL ends in one', () => {
        const original = environment.apiBaseUrl;
        try {
            (environment as { apiBaseUrl: string }).apiBaseUrl =
                'https://api.test/';
            expect(notificationHubUrl()).toBe(
                'https://api.test/hubs/notifications'
            );
        } finally {
            (environment as { apiBaseUrl: string }).apiBaseUrl = original;
        }
    });
});

/**
 * The hub replays nothing, so what it pushes has to land in the same list the
 * first page produced — top of the list, badge included — and a reconnect's
 * re-read must not double anything up.
 */
describe('NotificationsService.receive', () => {
    let service: NotificationsService;

    beforeEach(() => {
        service = new NotificationsService();
    });

    it('puts a pushed notification at the top and counts it unread', () => {
        service.receive(BROADCAST);

        expect(service.items().length).toBe(1);
        expect(service.items()[0].id).toBe('notif-1');
        expect(service.unreadCount()).toBe(1);
    });

    it('parses the JSON payload the same way a listed row is parsed', () => {
        service.receive(BROADCAST);

        const [item] = service.items();
        expect(item.title).toBe('Đơn đã giao');
        expect(item.description).toBe('Đơn CHO-1708 đã giao xong');
        expect(item.serviceDate).toBe('2026-08-24');
        expect(item.marketName).toBe('Chợ Bình Điền');
    });

    it('keeps the newest first', () => {
        service.receive(BROADCAST);
        service.receive({ ...BROADCAST, id: 'notif-2', title: 'Mới hơn' });

        expect(service.items().map((item) => item.id)).toEqual([
            'notif-2',
            'notif-1',
        ]);
    });

    it('ignores an id it already holds, so a reconnect re-read cannot double it', () => {
        service.receive(BROADCAST);
        service.receive(BROADCAST);

        expect(service.items().length).toBe(1);
        expect(service.unreadCount()).toBe(1);
    });

    it('drops a row with no id — nothing could mark it read', () => {
        service.receive({ ...BROADCAST, id: '' });

        expect(service.items()).toEqual([]);
    });
});
