import type { HubConnection } from '@microsoft/signalr';
import type { HubConnectionFactory } from './realtime-connection';

/**
 * A hub that never touches the network, for the tests.
 *
 * It records what was registered and invoked, and lets a test push a message or
 * fire a reconnect — the two things that make realtime code fail in ways a
 * live-server test could not reproduce on demand.
 */
export class FakeHub {
    readonly handlers = new Map<string, (payload: unknown) => void>();
    readonly invocations: { method: string; args: unknown[] }[] = [];
    startCalls = 0;
    stopCalls = 0;
    /** Set before `start()` to simulate a refused negotiate (401/403, offline). */
    failStart = false;
    /** Set to make hub method calls throw, e.g. a join the hub rejects. */
    failInvoke = false;

    private _reconnecting: (() => void) | null = null;
    private _reconnected: (() => void) | null = null;
    private _closed: (() => void) | null = null;

    /** Names of the hub methods called, in order — the usual assertion. */
    get calls(): string[] {
        return this.invocations.map((call) => call.method);
    }

    /** Arguments of the last call to `method`, or `undefined`. */
    lastArgs(method: string): unknown[] | undefined {
        return this.invocations.filter((c) => c.method === method).pop()?.args;
    }

    /** Delivers one server → client message, as the real hub would. */
    emit(event: string, payload: unknown): void {
        this.handlers.get(event)?.(payload);
    }

    /** Drops and restores the socket — the gap every feature has to close. */
    reconnect(): void {
        this._reconnecting?.();
        this._reconnected?.();
    }

    asConnection(): HubConnection {
        const hub = {
            on: (event: string, handler: (payload: unknown) => void) => {
                this.handlers.set(event, handler);
            },
            onreconnecting: (handler: () => void) => {
                this._reconnecting = handler;
            },
            onreconnected: (handler: () => void) => {
                this._reconnected = handler;
            },
            onclose: (handler: () => void) => {
                this._closed = handler;
            },
            start: async () => {
                this.startCalls++;
                if (this.failStart) {
                    throw new Error('negotiate refused');
                }
            },
            stop: async () => {
                this.stopCalls++;
                this._closed?.();
            },
            invoke: async (method: string, ...args: unknown[]) => {
                this.invocations.push({ method, args });
                if (this.failInvoke) {
                    throw new Error('hub refused the call');
                }
            },
        };
        return hub as unknown as HubConnection;
    }
}

/** Hands every hub name its own fake, creating them on first ask. */
export function fakeHubFactory(
    hubs: Map<string, FakeHub>
): HubConnectionFactory {
    return (name: string) => {
        const hub = hubs.get(name) ?? new FakeHub();
        hubs.set(name, hub);
        return hub.asConnection();
    };
}
