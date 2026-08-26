import {
    InjectionToken,
    NgZone,
    signal,
    type Signal,
    type WritableSignal,
} from '@angular/core';
import {
    HubConnectionBuilder,
    LogLevel,
    type HubConnection,
} from '@microsoft/signalr';
import { getValidAccessToken, hasAccessToken } from 'contract';
import { environment } from 'environments/environment';

/**
 * Reconnect backoff, matching the mobile client so both behave the same after
 * a dropped connection: immediately, then easing off to every 30s.
 */
const RECONNECT_DELAYS_MS = [0, 2_000, 5_000, 10_000, 30_000];

/** `https://api…/hubs/{name}` — the hubs live beside `/api/v1`, not under it. */
export function hubUrl(name: string): string {
    return `${environment.apiBaseUrl.replace(/\/+$/, '')}/hubs/${name}`;
}

/** Builds an unstarted connection to one hub. */
export type HubConnectionFactory = (hubName: string) => HubConnection;

/** The real one: bearer token on the query string, reconnecting, quiet logs. */
export const defaultHubConnectionFactory: HubConnectionFactory = (hubName) =>
    new HubConnectionBuilder()
        .withUrl(hubUrl(hubName), {
            // A browser cannot set headers on a WebSocket, so the token rides
            // the query string — which is what the backend reads for `/hubs/*`.
            accessTokenFactory: getValidAccessToken,
        })
        .withAutomaticReconnect([...RECONNECT_DELAYS_MS])
        .configureLogging(LogLevel.Error)
        .build();

/**
 * How a {@link RealtimeConnection} gets its socket.
 *
 * A seam, not a configuration point: production always uses
 * {@link defaultHubConnectionFactory}. Tests override it to hand the services a
 * fake hub, which is the only way to exercise the parts worth testing — group
 * re-joining after a reconnect, reference counting, payload rejection — without
 * a live backend.
 */
export const HUB_CONNECTION_FACTORY = new InjectionToken<HubConnectionFactory>(
    'HUB_CONNECTION_FACTORY',
    { providedIn: 'root', factory: () => defaultHubConnectionFactory }
);

/** What a feature registers for one server → client method. */
interface Handler<T> {
    event: string;
    /** Narrows the `unknown` the hub delivers; anything rejected is dropped. */
    accepts: (value: unknown) => value is T;
    handle: (value: T) => void;
}

/**
 * One SignalR connection, with the lifecycle every hub needs and none of the
 * feature logic.
 *
 * Each hub gets its own instance because the hubs are separate endpoints, but
 * they all need the same five things, and each of them is a bug the first time
 * it is written by hand:
 *
 * - **Reference counting.** Several screens (or two copies of one header) can
 *   want the same feed at once. One of them going away must not cut the
 *   others', so the socket closes on the last release, not the first.
 * - **`stop()` only after `start()` settles.** Stopping mid-negotiate throws,
 *   which is what a screen that mounts and unmounts quickly does.
 * - **A token that is still valid.** HTTP can refresh on the 401 and retry; a
 *   negotiate cannot, and every reconnect reuses this same factory.
 * - **Guarded payloads.** Hub messages arrive as `unknown` — no schema, no
 *   status code — so each handler declares what it accepts.
 * - **Re-entering Angular.** Socket callbacks land outside the zone while the
 *   screens reading them are `OnPush`.
 *
 * What it deliberately does *not* do is own data. A feature service registers
 * handlers and writes to whatever signal already holds that data, so there is
 * one copy of the truth whether it arrived by REST or by socket.
 */
export class RealtimeConnection {
    private readonly _connected: WritableSignal<boolean> = signal(false);
    private readonly _handlers: Handler<never>[] = [];
    private _connection: HubConnection | null = null;
    private _starting: Promise<void> | null = null;
    private _subscribers = 0;
    private _onReconnected: (() => void | Promise<void>) | null = null;

    /**
     * @param name Hub path segment, e.g. `notifications` for `/hubs/notifications`.
     * @param zone Injected by the owning service — this class is not injectable
     *   itself so a feature service can hold one per hub.
     */
    constructor(
        private readonly name: string,
        private readonly zone: NgZone,
        private readonly build: HubConnectionFactory = defaultHubConnectionFactory
    ) {}

    /** True while the socket is up — for a "live" indicator, and for tests. */
    get connected(): Signal<boolean> {
        return this._connected.asReadonly();
    }

    /**
     * Registers a server → client handler. Call before {@link connect}; handlers
     * are attached to each connection object as it is built, so they survive a
     * connection that failed to start and was thrown away.
     */
    on<T>(
        event: string,
        accepts: (value: unknown) => value is T,
        handle: (value: T) => void
    ): void {
        this._handlers.push({ event, accepts, handle } as Handler<never>);
    }

    /**
     * Runs after every successful *re*connect (not the first connect).
     *
     * Two things belong here. Groups joined by an explicit call — `PricingHub`'s
     * `market:{id}` — are **not** restored by the client and have to be re-joined
     * or the socket stays silent while looking healthy. And whatever the hub
     * broadcast while the socket was down is simply gone: hubs replay nothing,
     * so the feature re-reads the REST view to close the gap.
     */
    onReconnected(handler: () => void | Promise<void>): void {
        this._onReconnected = handler;
    }

    /** Opens the connection (or joins the open one) and claims one subscriber. */
    async connect(): Promise<void> {
        this._subscribers++;
        await this.resync();
    }

    /**
     * Opens the connection if it is not open, without claiming a subscriber.
     *
     * This is the sign-in path: a screen mounts for a guest, `connect()` finds
     * no token and does nothing, and the session starts a moment later. Calling
     * `connect()` again there would inflate the reference count and leave the
     * socket open after the screen is gone.
     */
    async resync(): Promise<void> {
        if (this._connection) {
            await this._starting?.catch(() => undefined);
            return;
        }
        if (!hasAccessToken()) {
            return;
        }

        const connection = this.build(this.name);

        for (const handler of this._handlers) {
            connection.on(handler.event, (payload: unknown) => {
                if (!handler.accepts(payload)) {
                    return;
                }
                this.zone.run(() => handler.handle(payload));
            });
        }

        connection.onreconnecting(() => this._connected.set(false));
        connection.onreconnected(() => {
            this._connected.set(true);
            this.zone.run(() => void this._onReconnected?.());
        });
        connection.onclose(() => this._connected.set(false));

        this._connection = connection;
        this._starting = connection.start();
        try {
            await this._starting;
            this._connected.set(true);
        } catch {
            // `withAutomaticReconnect` only covers a connection that came up at
            // least once, so a failed start is dropped entirely and the next
            // `connect()` builds a fresh one. A 403 here is normal: the order
            // and delivery hubs refuse roles that have no business on them.
            this._connection = null;
            this._starting = null;
            this._connected.set(false);
        }
    }

    /** Releases one subscriber; the socket closes when the last one leaves. */
    async disconnect(): Promise<void> {
        this._subscribers = Math.max(0, this._subscribers - 1);
        if (this._subscribers > 0) {
            return;
        }
        const connection = this._connection;
        if (!connection) {
            return;
        }
        this._connection = null;
        // Let a negotiate in flight settle first — `stop()` mid-start throws.
        await this._starting?.catch(() => undefined);
        this._starting = null;
        try {
            await connection.stop();
        } catch {
            // Already closed, or never opened: nothing left to release.
        }
        this._connected.set(false);
    }

    /**
     * Calls a hub method, e.g. `PricingHub.JoinMarketAsync`.
     *
     * Answers `false` instead of throwing when the socket is not up or the hub
     * refuses the call: joining a market group is best-effort from the caller's
     * point of view — the page still works, it just is not live.
     */
    async invoke(method: string, ...args: unknown[]): Promise<boolean> {
        const connection = this._connection;
        if (!connection) {
            return false;
        }
        try {
            await this._starting;
            await connection.invoke(method, ...args);
            return true;
        } catch {
            return false;
        }
    }

    /** Closes the socket regardless of the reference count (sign-out). */
    async reset(): Promise<void> {
        this._subscribers = 0;
        await this.disconnect();
    }
}
