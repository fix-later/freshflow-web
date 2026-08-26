import { NgZone } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { clearTokens, setTokens } from 'contract';
import { FakeHub } from './fake-hub';
import { RealtimeConnection } from './realtime-connection';

/** A signed-in session — `RealtimeConnection` refuses to connect without one. */
function signIn(): void {
    setTokens('header.eyJzdWIiOiJ1LTEifQ.signature', 'refresh-1');
}

function build(hub: FakeHub): RealtimeConnection {
    const zone = TestBed.inject(NgZone);
    return new RealtimeConnection('orders', zone, () => hub.asConnection());
}

const isString = (value: unknown): value is string => typeof value === 'string';

/**
 * The lifecycle rules that are the same for every hub, and each of which is a
 * bug the first time somebody writes it by hand.
 */
describe('RealtimeConnection', () => {
    let hub: FakeHub;

    beforeEach(() => {
        TestBed.resetTestingModule();
        hub = new FakeHub();
        signIn();
    });

    afterEach(() => {
        clearTokens();
    });

    it('does not connect a signed-out visitor', async () => {
        clearTokens();
        const connection = build(hub);

        await connection.connect();

        expect(hub.startCalls).toBe(0);
        expect(connection.connected()).toBeFalse();
    });

    it('opens once and reports itself connected', async () => {
        const connection = build(hub);

        await connection.connect();

        expect(hub.startCalls).toBe(1);
        expect(connection.connected()).toBeTrue();
    });

    it('keeps the socket open until the last subscriber leaves', async () => {
        const connection = build(hub);
        await connection.connect();
        await connection.connect();

        // Two screens wanted this feed; one going away must not cut the other's.
        await connection.disconnect();
        expect(hub.stopCalls).toBe(0);
        expect(connection.connected()).toBeTrue();

        await connection.disconnect();
        expect(hub.stopCalls).toBe(1);
        expect(connection.connected()).toBeFalse();
    });

    it('throws away a connection whose start was refused, so the next try is fresh', async () => {
        hub.failStart = true;
        const connection = build(hub);

        await connection.connect();
        expect(connection.connected()).toBeFalse();

        // `withAutomaticReconnect` never covers a connection that failed to
        // come up, so the retry has to build a new one rather than wait.
        hub.failStart = false;
        await connection.resync();
        expect(hub.startCalls).toBe(2);
        expect(connection.connected()).toBeTrue();
    });

    it('delivers a payload the guard accepts', async () => {
        const seen: string[] = [];
        const connection = build(hub);
        connection.on('Ping', isString, (value) => seen.push(value));
        await connection.connect();

        hub.emit('Ping', 'hello');

        expect(seen).toEqual(['hello']);
    });

    it('drops a payload the guard rejects instead of passing `unknown` on', async () => {
        const seen: string[] = [];
        const connection = build(hub);
        connection.on('Ping', isString, (value) => seen.push(value));
        await connection.connect();

        hub.emit('Ping', { not: 'a string' });
        hub.emit('Ping', null);

        expect(seen).toEqual([]);
    });

    it('runs the reconnect hook, where groups are re-joined and gaps closed', async () => {
        let reconnects = 0;
        const connection = build(hub);
        connection.onReconnected(() => {
            reconnects++;
        });
        await connection.connect();

        hub.reconnect();

        expect(reconnects).toBe(1);
        expect(connection.connected()).toBeTrue();
    });

    it('answers false from invoke() when the hub refuses the call', async () => {
        hub.failInvoke = true;
        const connection = build(hub);
        await connection.connect();

        // A refused `JoinMarketAsync` must not take the page down with it.
        await expectAsync(
            connection.invoke('JoinMarketAsync', 'm-1')
        ).toBeResolvedTo(false);
    });

    it('answers false from invoke() when there is no socket at all', async () => {
        const connection = build(hub);

        await expectAsync(
            connection.invoke('JoinMarketAsync', 'm-1')
        ).toBeResolvedTo(false);
    });

    it('closes regardless of the count when the session ends', async () => {
        const connection = build(hub);
        await connection.connect();
        await connection.connect();

        await connection.reset();

        expect(hub.stopCalls).toBe(1);
        expect(connection.connected()).toBeFalse();
    });
});
