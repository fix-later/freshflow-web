import {
    Injectable,
    NgZone,
    type Signal,
    computed,
    inject,
    signal,
} from '@angular/core';
import {
    HUB_CONNECTION_FACTORY,
    RealtimeConnection,
} from './realtime-connection';

/** Server → client methods on `OrderHub` and `DeliveryHub`. */
const ORDER_STATUS_CHANGED = 'OrderStatusChanged';
const DELIVERY_STARTED = 'DeliveryStarted';
const DELIVERY_STOP_UPDATED = 'DeliveryStopUpdated';

/** `OrderStatusChangedBroadcastDto`, camelCased by SignalR. */
export interface OrderStatusChangedEvent {
    orderId: string;
    restaurantId: string;
    previousStatus: string;
    newStatus: string;
    changedAt: string;
    estimatedDeliveryAt: string | null;
}

/** `DeliveryRealtimeUpdate` — carried by both delivery methods. */
export interface DeliveryUpdatedEvent {
    orderId: string;
    routeId: string;
    deliveryId: string | null;
    status: string;
    occurredAt: string;
}

/** One order moved, whichever hub said so. What screens actually react to. */
export interface OrderTouched {
    orderId: string;
    /** Status the event carried, lower-cased — absent when it named none. */
    status: string | null;
    /** `Date.now()` when it arrived, so two events for one order differ. */
    at: number;
}

export function isOrderStatusChangedEvent(
    value: unknown
): value is OrderStatusChangedEvent {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const event = value as Partial<OrderStatusChangedEvent>;
    return (
        typeof event.orderId === 'string' &&
        typeof event.restaurantId === 'string' &&
        typeof event.newStatus === 'string' &&
        typeof event.changedAt === 'string'
    );
}

export function isDeliveryUpdatedEvent(
    value: unknown
): value is DeliveryUpdatedEvent {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const event = value as Partial<DeliveryUpdatedEvent>;
    return (
        typeof event.orderId === 'string' &&
        typeof event.routeId === 'string' &&
        typeof event.status === 'string'
    );
}

/**
 * Live order movement, from the two hubs that report it.
 *
 * `OrderHub` says the order changed status; `DeliveryHub` says its stop on a
 * route did. Both are the same question for a screen — *did this order move?* —
 * so both land in {@link touched}, and the two raw signals stay available for
 * anything that needs the detail.
 *
 * This service holds **no order data**. Order state is owned by the screens
 * that fetched it (`order-detail` holds one order, `orders-list` holds a page
 * of them), and an event carries only part of an order, so pushing it into
 * their state would leave a row whose status disagrees with its own totals.
 * The event says *re-read this one* instead, which is also what makes a missed
 * event survivable: the next read is the truth either way.
 *
 * Both hubs are `admin,operations_manager,restaurant` only. A driver or a guest
 * gets a 403 at negotiate, which `RealtimeConnection` drops quietly — screens
 * outside those roles simply never open this.
 */
@Injectable({ providedIn: 'root' })
export class OrderRealtimeService {
    private readonly _zone = inject(NgZone);
    private readonly _build = inject(HUB_CONNECTION_FACTORY);
    private readonly _orders = new RealtimeConnection(
        'orders',
        this._zone,
        this._build
    );
    private readonly _delivery = new RealtimeConnection(
        'delivery',
        this._zone,
        this._build
    );

    private readonly _lastStatusChange = signal<OrderStatusChangedEvent | null>(
        null
    );
    private readonly _lastDelivery = signal<DeliveryUpdatedEvent | null>(null);
    private readonly _touched = signal<OrderTouched | null>(null);
    private _onReconnected: (() => void) | null = null;

    /** The most recent `OrderStatusChanged`, for screens that want the detail. */
    readonly lastStatusChange = this._lastStatusChange.asReadonly();
    /** The most recent delivery update. */
    readonly lastDelivery = this._lastDelivery.asReadonly();
    /** The merged "this order moved" signal — the one screens should watch. */
    readonly touched = this._touched.asReadonly();
    /** True while **both** feeds are up. */
    readonly connected: Signal<boolean> = computed(
        () => this._orders.connected() && this._delivery.connected()
    );

    constructor() {
        this._orders.on(
            ORDER_STATUS_CHANGED,
            isOrderStatusChangedEvent,
            (event) => {
                this._lastStatusChange.set(event);
                this._touch(event.orderId, event.newStatus);
            }
        );
        for (const method of [DELIVERY_STARTED, DELIVERY_STOP_UPDATED]) {
            this._delivery.on(method, isDeliveryUpdatedEvent, (event) => {
                this._lastDelivery.set(event);
                this._touch(event.orderId, event.status);
            });
        }

        // A gap in either feed is a gap in both, as far as a screen is
        // concerned: it cannot know which orders moved while it was deaf, so it
        // is told to re-read whatever it is showing.
        const reconnected = (): void => this._onReconnected?.();
        this._orders.onReconnected(reconnected);
        this._delivery.onReconnected(reconnected);
    }

    /**
     * Registers the "you were deaf for a while, re-read" callback.
     *
     * A single slot rather than a list: the screens using this are one at a
     * time (a detail page or a list page), and a leaked subscription that
     * refetches forever is worse than an overwritten one.
     */
    setReconnectHandler(handler: (() => void) | null): void {
        this._onReconnected = handler;
    }

    /** Opens both feeds for one subscriber. */
    async connect(): Promise<void> {
        await Promise.all([this._orders.connect(), this._delivery.connect()]);
    }

    /** Re-attempts after a sign-in, without claiming a subscriber. */
    async resync(): Promise<void> {
        await Promise.all([this._orders.resync(), this._delivery.resync()]);
    }

    /** Releases one subscriber from both feeds. */
    async disconnect(): Promise<void> {
        await Promise.all([
            this._orders.disconnect(),
            this._delivery.disconnect(),
        ]);
    }

    private _touch(orderId: string, status: string | null): void {
        this._touched.set({
            orderId,
            status: status ? status.toLowerCase() : null,
            at: Date.now(),
        });
    }
}
