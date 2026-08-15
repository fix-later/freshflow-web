/**
 * The scenario matrix — slice 1: M1 (auth / approval gate) + M5 (orders).
 *
 * Every row is `role × screen × business state`, and every row carries the
 * spec IDs it exists to check. A finding without a `traces` entry is an
 * opinion, not an audit result: the rules live in `specs/product/*` and
 * `specs/ux/SCREEN_RULES.md`, and this file only mechanises them.
 *
 * `expect` is what the harness can decide on its own. Everything a machine
 * cannot judge — hierarchy, whether the copy explains itself, whether the
 * empty state offers the right next step — is left to the screenshot review.
 */
import { createRequire } from 'node:module';
import {
    confirmPreview,
    envelope,
    list,
    order,
    orderingWindow,
} from './fixtures.mjs';

const require = createRequire(import.meta.url);
const vi = require('../../public/i18n/vi.json');

/** Resolves a Transloco key to the shipped Vietnamese copy (flat key map). */
export const t = (key) => {
    const value = vi[key];
    if (value === undefined) {
        throw new Error(`ux-audit: unknown i18n key "${key}"`);
    }
    return value;
};

const ORDER_ID = 'a1000000-0000-4000-8000-000000000001';

export const scenarios = [
    // ── M1 · Auth, approval gate, RBAC ────────────────────────────────────
    {
        id: 'M1-01',
        title: 'Guest deep-links /orders',
        traces: ['ROLE_MATRIX §UI enforcement 2', 'BR-AUTH-4'],
        role: null,
        route: '/orders',
        expect: { url: '/sign-in' },
    },
    {
        id: 'M1-02',
        title: 'PENDING_APPROVAL restaurant on the catalogue',
        traces: ['BR-AUTH-1', 'SCREEN_RULES §Required states · Permission'],
        role: 'restaurant',
        approval: 'pending',
        route: '/catalog',
        viewports: ['desktop', 'mobile'],
        expect: { visible: ['approval-banner'] },
    },
    {
        id: 'M1-03',
        title: 'Approved restaurant on the catalogue — no gate copy',
        traces: ['BR-AUTH-1'],
        role: 'restaurant',
        approval: 'active',
        route: '/catalog',
        expect: { hidden: ['approval-banner'] },
    },
    {
        id: 'M1-04',
        title: 'Suspended restaurant on the catalogue',
        traces: ['BR-AUTH-1', 'SCREEN_RULES §Required states · Permission'],
        role: 'restaurant',
        approval: 'suspended',
        route: '/catalog',
        // A suspended account is blocked from ordering exactly like a pending
        // one, so the screen owes it the same explanation. Asserted as the
        // rule reads; a failure here is the finding.
        expect: { visible: ['approval-banner'] },
    },
    {
        id: 'M1-05',
        title: 'Restaurant deep-links the admin console',
        traces: [
            'ROLE_MATRIX §M13 · Restaurant —',
            'ROLE_MATRIX §UI enforcement 2',
        ],
        role: 'restaurant',
        approval: 'active',
        route: '/admin',
        expect: { url: '/home' },
    },
    {
        id: 'M1-06',
        title: 'Admin deep-links the restaurant order history',
        traces: [
            'ROLE_MATRIX §M5 · Ownership scoping R⁺',
            'ROLE_MATRIX §UI enforcement 4',
        ],
        role: 'admin',
        route: '/orders',
        expect: { url: '/home' },
    },
    {
        id: 'M1-07',
        title: 'Server answers 403 on the order list',
        traces: ['BR-AUTH-4', 'SCREEN_RULES §Required states · Error'],
        role: 'restaurant',
        approval: 'active',
        route: '/orders',
        stubs: [
            [
                /\/api\/v1\/orders\/?$/,
                () => ({
                    status: 403,
                    body: {
                        error: { code: 'FORBIDDEN', message: 'Forbidden' },
                    },
                }),
            ],
        ],
        expect: { visible: ['[role="alert"]'] },
    },

    // ── M5 · Orders: required states ──────────────────────────────────────
    {
        id: 'M5-01',
        title: 'Order list — loading',
        traces: ['SCREEN_RULES §Required states · Loading'],
        role: 'restaurant',
        approval: 'active',
        route: '/orders',
        // Held open long enough to photograph the loading treatment.
        stubs: [
            [
                /\/api\/v1\/orders\/?$/,
                () => ({ body: list([]), delayMs: 6000 }),
            ],
        ],
        duringLoad: true,
        settleMs: 2500,
        skipAxe: true,
        // Whatever is on screen while the list loads, it must not be the empty
        // state — "you have no orders" is a claim, and it is not known yet.
        expect: { hidden: [`text=${t('orders.empty')}`] },
    },
    {
        id: 'M5-02',
        title: 'Order list — empty',
        traces: ['SCREEN_RULES §Required states · Empty'],
        role: 'restaurant',
        approval: 'active',
        route: '/orders',
        viewports: ['desktop', 'mobile'],
        expect: {
            visible: [
                `text=${t('orders.empty')}`,
                `text=${t('orders.browseCatalog')}`,
            ],
        },
    },
    {
        id: 'M5-03',
        title: 'Order list — server error, retryable',
        traces: ['SCREEN_RULES §Required states · Error'],
        role: 'restaurant',
        approval: 'active',
        route: '/orders',
        stubs: [
            [
                /\/api\/v1\/orders\/?$/,
                () => ({
                    status: 500,
                    body: { error: { code: 'INTERNAL', message: 'boom' } },
                }),
            ],
        ],
        expect: { visible: ['[role="alert"]', `text=${t('common.retry')}`] },
    },
    {
        id: 'M5-04',
        title: 'Order list — populated across statuses',
        traces: ['SCREEN_RULES §Page archetypes · List', 'BR-ORD-6'],
        role: 'restaurant',
        approval: 'active',
        route: '/orders',
        viewports: ['desktop', 'mobile'],
        stubs: [
            [
                /\/api\/v1\/orders\/?$/,
                () => ({
                    body: list([
                        order({ id: ORDER_ID, status: 'confirmed' }),
                        order({
                            id: 'a2',
                            status: 'batched',
                            totalAmount: 980_000,
                        }),
                        order({
                            id: 'a3',
                            status: 'in_transit',
                            totalAmount: 4_120_000,
                        }),
                        order({
                            id: 'a4',
                            status: 'delivered',
                            totalAmount: 1_260_000,
                        }),
                        order({
                            id: 'a5',
                            status: 'cancelled',
                            totalAmount: 310_000,
                        }),
                    ]),
                }),
            ],
        ],
        expect: {},
    },

    // ── M5 · Orders: cancellation window (BR-ORD-4) ───────────────────────
    {
        id: 'M5-05',
        title: 'Order detail — CONFIRMED, cancellable',
        traces: ['BR-ORD-4'],
        role: 'restaurant',
        approval: 'active',
        route: `/orders/${ORDER_ID}`,
        stubs: [
            [
                /\/api\/v1\/orders\/[^/]+$/,
                () => ({ body: envelope(order({ status: 'confirmed' })) }),
            ],
        ],
        expect: { visible: [`text=${t('orders.detail.cancel')}`] },
    },
    {
        id: 'M5-06',
        title: 'Order detail — BATCHED, past the cancellation window',
        traces: ['BR-ORD-4', 'BR-PROC-1'],
        role: 'restaurant',
        approval: 'active',
        route: `/orders/${ORDER_ID}`,
        stubs: [
            [
                /\/api\/v1\/orders\/[^/]+$/,
                () => ({ body: envelope(order({ status: 'batched' })) }),
            ],
        ],
        // BR-ORD-4 allows a cancel only before batching, so the action must be
        // gone here. Asserted as the rule reads.
        expect: { hidden: [`text=${t('orders.detail.cancel')}`] },
    },
    {
        id: 'M5-07',
        title: 'Order detail — DELIVERED: confirm receipt / report an issue',
        traces: ['BR-ORD-7', 'BR-ORD-4'],
        role: 'restaurant',
        approval: 'active',
        route: `/orders/${ORDER_ID}`,
        stubs: [
            [
                /\/api\/v1\/orders\/[^/]+$/,
                () => ({ body: envelope(order({ status: 'delivered' })) }),
            ],
        ],
        expect: { hidden: [`text=${t('orders.detail.cancel')}`] },
    },
    {
        id: 'M5-08',
        title: 'Order detail — cancel asks for a reason',
        traces: ['BR-ORD-4', 'SCREEN_RULES §Forms'],
        role: 'restaurant',
        approval: 'active',
        route: `/orders/${ORDER_ID}`,
        stubs: [
            [
                /\/api\/v1\/orders\/[^/]+$/,
                () => ({ body: envelope(order({ status: 'confirmed' })) }),
            ],
        ],
        // Open the confirmation, submit nothing: BR-ORD-4 makes the reason
        // mandatory, so an empty submit must not reach the API.
        actions: [
            { click: `text=${t('orders.detail.cancel')}` },
            { settle: 400 },
        ],
        expect: { visible: [`text=${t('orders.detail.cancelTitle')}`] },
        probe: 'emptyCancelReason',
    },
    {
        id: 'M5-09',
        title: 'Order detail — 404, the order is not there',
        traces: ['SCREEN_RULES §Required states · Error'],
        role: 'restaurant',
        approval: 'active',
        route: `/orders/${ORDER_ID}`,
        stubs: [
            [
                /\/api\/v1\/orders\/[^/]+$/,
                () => ({
                    status: 404,
                    body: {
                        error: {
                            code: 'ORDER_NOT_FOUND',
                            message: 'not found',
                        },
                    },
                }),
            ],
        ],
        expect: {},
    },

    // ── M5 · Checkout: cutoff and credit gates ────────────────────────────
    {
        id: 'M5-10',
        title: 'Checkout — before the 22:00 cutoff',
        traces: ['BR-ORD-2'],
        role: 'restaurant',
        approval: 'active',
        // Entered through the cart, not by deep link: `/checkout` decides on an
        // empty cart in `ngOnInit`, before the draft has loaded, so a direct
        // visit bounces to `/cart` (see M5-14).
        route: '/cart',
        actions: [
            { click: `text=${t('cart.totals.proceed')}` },
            { settle: 2500 },
        ],
        stubs: [
            [
                /\/api\/v1\/orders\/?$/,
                () => ({
                    body: list([order({ id: ORDER_ID, status: 'draft' })]),
                }),
            ],
            [
                /\/api\/v1\/orders\/ordering-window$/,
                () => ({
                    body: orderingWindow({
                        isOpen: true,
                        earliestServiceDate: '2026-08-13',
                    }),
                }),
            ],
        ],
        viewports: ['desktop', 'mobile'],
        expect: {},
    },
    {
        id: 'M5-11',
        title: 'Checkout — after the cutoff, window closed',
        traces: ['BR-ORD-2'],
        role: 'restaurant',
        approval: 'active',
        // Entered through the cart, not by deep link: `/checkout` decides on an
        // empty cart in `ngOnInit`, before the draft has loaded, so a direct
        // visit bounces to `/cart` (see M5-14).
        route: '/cart',
        actions: [
            { click: `text=${t('cart.totals.proceed')}` },
            { settle: 2500 },
        ],
        stubs: [
            [
                /\/api\/v1\/orders\/?$/,
                () => ({
                    body: list([order({ id: ORDER_ID, status: 'draft' })]),
                }),
            ],
            [
                /\/api\/v1\/orders\/ordering-window$/,
                () => ({
                    body: orderingWindow({
                        isOpen: false,
                        earliestServiceDate: '2026-08-14',
                    }),
                }),
            ],
        ],
        expect: {},
    },
    {
        id: 'M5-12',
        title: 'Checkout — confirm refused: credit limit exceeded',
        traces: ['BR-CRE-2', 'SCREEN_RULES §Forms'],
        role: 'restaurant',
        approval: 'active',
        // Entered through the cart, not by deep link: `/checkout` decides on an
        // empty cart in `ngOnInit`, before the draft has loaded, so a direct
        // visit bounces to `/cart` (see M5-14).
        route: '/cart',
        actions: [
            { click: `text=${t('cart.totals.proceed')}` },
            { settle: 2500 },
            // The refusal is only surfaced on the attempt, so the attempt is
            // part of the scenario.
            { click: `button:has-text("${t('cart.totals.placeOrder')}")` },
            { settle: 1500 },
        ],
        stubs: [
            [
                /\/api\/v1\/orders\/?$/,
                () => ({
                    body: list([order({ id: ORDER_ID, status: 'draft' })]),
                }),
            ],
            [
                /\/api\/v1\/orders\/[^/]+\/confirm-preview$/,
                () => ({
                    body: confirmPreview({
                        wouldSucceed: false,
                        remainingCreditAfter: -1_250_000,
                        issues: [
                            {
                                code: 'CREDIT_LIMIT_EXCEEDED',
                                message: 'Vượt hạn mức công nợ',
                            },
                        ],
                    }),
                }),
            ],
        ],
        expect: {},
    },
    {
        id: 'M5-13',
        title: 'Checkout — confirm refused: account not approved',
        traces: ['BR-AUTH-1', 'SCREEN_RULES §Required states · Permission'],
        role: 'restaurant',
        approval: 'pending',
        // Entered through the cart, not by deep link: `/checkout` decides on an
        // empty cart in `ngOnInit`, before the draft has loaded, so a direct
        // visit bounces to `/cart` (see M5-14).
        route: '/cart',
        actions: [
            { click: `text=${t('cart.totals.proceed')}` },
            { settle: 2500 },
            { click: `button:has-text("${t('cart.totals.placeOrder')}")` },
            { settle: 1500 },
        ],
        stubs: [
            [
                /\/api\/v1\/orders\/?$/,
                () => ({
                    body: list([order({ id: ORDER_ID, status: 'draft' })]),
                }),
            ],
            [
                /\/api\/v1\/orders\/[^/]+\/confirm-preview$/,
                () => ({
                    body: confirmPreview({
                        wouldSucceed: false,
                        issues: [
                            {
                                code: 'RESTAURANT_NOT_APPROVED',
                                message: 'Tài khoản chưa được duyệt',
                            },
                        ],
                    }),
                }),
            ],
        ],
        // A pending restaurant must learn it cannot order before it fills in a
        // checkout, not after (SCREEN_RULES: approval-gated actions show an
        // inline explanation).
        expect: { visible: ['approval-banner'] },
    },
    {
        id: 'M5-14',
        title: 'Checkout — reached by deep link / reload with a full cart',
        traces: ['SCREEN_RULES §Required states · Loading', 'BR-ORD-1'],
        role: 'restaurant',
        approval: 'active',
        route: '/checkout',
        stubs: [
            [
                /\/api\/v1\/orders\/?$/,
                () => ({
                    body: list([order({ id: ORDER_ID, status: 'draft' })]),
                }),
            ],
        ],
        // The cart is a server-side draft, fetched after the component starts.
        // Deep-linking must survive that, so the screen is expected to stay put.
        expect: { url: '/checkout' },
    },
];
