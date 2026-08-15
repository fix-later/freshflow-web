/**
 * UX audit harness — drives the running app through the scenario matrix and
 * captures what a machine can decide, plus a screenshot of what it cannot.
 *
 * Deterministic layer (this file): route guards and redirects, action
 * visibility per role/state, the required states, axe-core violations, console
 * errors, and which API calls each screen actually makes.
 * Judgement layer: the screenshots in `<out>/shots`, reviewed against
 * `specs/ux/SCREEN_RULES.md` + `specs/product/BUSINESS_RULES.md`.
 *
 * Nothing reaches the network. Every `/api/v1/**` call is answered from
 * `fixtures.mjs`; every other non-localhost request is aborted and recorded,
 * so a run can neither read nor write the real backend and cannot drift with
 * its data.
 *
 *   node scripts/ux-audit/run.mjs --base http://localhost:4300 --out <dir>
 *
 * `playwright-core` and `axe-core` are resolved from `UX_AUDIT_MODULES` when
 * set, so the harness runs from a throwaway install without adding two browser
 * automation packages to the app's dependency tree.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { baseStubs, forgeJwt } from './fixtures.mjs';
import { scenarios, t } from './scenarios.mjs';

const require = createRequire(import.meta.url);
const modulesRoot = process.env.UX_AUDIT_MODULES;
const resolve = (name) =>
    modulesRoot ? require(join(modulesRoot, name)) : require(name);
const { chromium } = resolve('playwright-core');
const axePath = modulesRoot
    ? join(modulesRoot, 'axe-core/axe.min.js')
    : require.resolve('axe-core/axe.min.js');

const args = Object.fromEntries(
    [
        ...process.argv
            .slice(2)
            .join(' ')
            .matchAll(/--([\w-]+)(?:[= ]([^-\s][^\s]*))?/g),
    ].map((m) => [m[1], m[2] ?? true])
);

const BASE = args.base ?? 'http://localhost:4300';
const OUT = args.out ?? join(process.cwd(), '.ux-audit');
const ONLY = typeof args.only === 'string' ? args.only.split(',') : null;

const VIEWPORTS = {
    desktop: { width: 1440, height: 900 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 390, height: 844 },
};

/** Impacts worth a finding; "minor" is noise at this stage. */
const AXE_IMPACTS = new Set(['serious', 'critical']);

// -----------------------------------------------------------------------------
// Probes — checks that need to drive the UI, not just read it
// -----------------------------------------------------------------------------

const probes = {
    /**
     * BR-ORD-4 makes a cancellation reason required. Submits the confirmation
     * with the field empty and reports whether the request left the browser:
     * if it did, the rule is not enforced at the UI.
     */
    async emptyCancelReason({ page, calls }) {
        const before = calls.filter((c) => /\/cancel$/.test(c.path)).length;
        const confirm = page
            .locator(`button:has-text("${t('orders.detail.cancelConfirm')}")`)
            .last();
        if (!(await confirm.count())) {
            return { ok: false, detail: 'confirm button not found' };
        }
        await confirm.click({ trial: false }).catch(() => {});
        await page.waitForTimeout(700);
        const sent =
            calls.filter((c) => /\/cancel$/.test(c.path)).length > before;
        return {
            ok: !sent,
            detail: sent
                ? 'PATCH /orders/{id}/cancel was sent with an empty reason'
                : 'submit blocked with an empty reason',
        };
    },
};

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------

async function runScenario(browser, scenario, viewportName) {
    const context = await browser.newContext({
        viewport: VIEWPORTS[viewportName],
        locale: 'vi-VN',
        timezoneId: 'Asia/Ho_Chi_Minh',
        reducedMotion: 'reduce',
    });

    const consoleErrors = [];
    const calls = [];
    const unstubbed = new Set();
    const blockedExternal = new Set();

    const table = [
        ...(scenario.stubs ?? []),
        ...baseStubs({
            role: scenario.role ?? 'restaurant',
            approval: scenario.approval ?? 'active',
        }),
    ];

    // Seed the session before the app boots: a forged token (only `exp` is ever
    // read) and, unless the scenario is about the picker itself, a chosen
    // market — the storefront holds every catalogue screen behind that choice.
    await context.addInitScript(
        ([access, refresh, market]) => {
            if (access) {
                localStorage.setItem('accessToken', access);
                localStorage.setItem('refreshToken', refresh);
            }
            if (market) {
                localStorage.setItem('freshflow.selectedMarket', market);
            }
        },
        [
            scenario.role ? forgeJwt() : null,
            scenario.role ? forgeJwt(30) : null,
            scenario.market === false
                ? null
                : JSON.stringify({
                      id: 'e1000000-0000-4000-8000-000000000001',
                      name: 'Chợ Bình Điền',
                      address: 'Quận 8, TP. Hồ Chí Minh',
                  }),
        ]
    );

    const page = await context.newPage();

    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text().slice(0, 300));
        }
    });
    page.on('pageerror', (err) =>
        consoleErrors.push(`[pageerror] ${err.message}`.slice(0, 300))
    );

    await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            return route.continue();
        }
        if (!url.pathname.startsWith('/api/')) {
            // Web fonts are allowed through: blocking them changes the metrics
            // every screenshot is reviewed on. Nothing else off-origin is.
            if (
                /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(
                    url.hostname
                )
            ) {
                return route.continue();
            }
            blockedExternal.add(url.origin + url.pathname);
            return route.abort();
        }
        calls.push({ method: route.request().method(), path: url.pathname });
        const entry = table.find(([re]) => re.test(url.pathname));
        if (!entry) {
            unstubbed.add(`${route.request().method()} ${url.pathname}`);
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: { items: [], totalCount: 0 },
                }),
            });
        }
        const res = entry[1](url) ?? {};
        if (res.delayMs) {
            await new Promise((r) => setTimeout(r, res.delayMs));
        }
        return route.fulfill({
            status: res.status ?? 200,
            contentType: 'application/json',
            body: JSON.stringify(res.body ?? { success: true, data: null }),
        });
    });

    await page.goto(BASE + scenario.route, { waitUntil: 'domcontentloaded' });
    // A loading-state scenario must be photographed while the request is still
    // in flight, so it opts out of waiting for the network to go quiet —
    // otherwise the wait outlives the very delay the scenario introduced.
    if (!scenario.duringLoad) {
        await page
            .waitForLoadState('networkidle', { timeout: 15_000 })
            .catch(() => {});
    }
    await page.waitForTimeout(scenario.settleMs ?? 600);

    for (const action of scenario.actions ?? []) {
        if (action.settle) {
            await page.waitForTimeout(action.settle);
        }
        if (action.click) {
            await page
                .locator(action.click)
                .first()
                .click({ timeout: 5000 })
                .catch(() => {});
        }
    }

    // ── assertions ────────────────────────────────────────────────────────
    const failures = [];
    const expected = scenario.expect ?? {};
    const finalPath = new URL(page.url()).pathname;

    if (expected.url && !finalPath.startsWith(expected.url)) {
        failures.push(
            `expected to land on ${expected.url}, landed on ${finalPath}`
        );
    }
    for (const sel of expected.visible ?? []) {
        if (
            !(await page
                .locator(sel)
                .first()
                .isVisible()
                .catch(() => false))
        ) {
            failures.push(`expected visible: ${sel}`);
        }
    }
    for (const sel of expected.hidden ?? []) {
        if (
            await page
                .locator(sel)
                .first()
                .isVisible()
                .catch(() => false)
        ) {
            failures.push(`expected hidden, but rendered: ${sel}`);
        }
    }

    let probeResult = null;
    if (scenario.probe) {
        probeResult = await probes[scenario.probe]({ page, calls, t });
        if (!probeResult.ok) {
            failures.push(`probe ${scenario.probe}: ${probeResult.detail}`);
        }
    }

    // ── axe ───────────────────────────────────────────────────────────────
    let axeViolations = [];
    if (!scenario.skipAxe) {
        await page.addScriptTag({ content: await readFile(axePath, 'utf8') });
        const result = await page.evaluate(
            async () =>
                // eslint-disable-next-line no-undef
                await window.axe.run(document, { resultTypes: ['violations'] })
        );
        axeViolations = result.violations
            .filter((v) => AXE_IMPACTS.has(v.impact))
            .map((v) => ({
                id: v.id,
                impact: v.impact,
                help: v.help,
                nodes: v.nodes.length,
                sample: v.nodes[0]?.target?.join(' ') ?? '',
                html: (v.nodes[0]?.html ?? '').slice(0, 400),
                why: (v.nodes[0]?.failureSummary ?? '').slice(0, 300),
            }));
    }

    // Two frames per scenario: the full page for content and hierarchy, and the
    // viewport alone because a full-page capture relocates sticky/fixed chrome
    // and would otherwise read as a layout bug that is not there.
    const shot = `${scenario.id}-${viewportName}.png`;
    const fold = `${scenario.id}-${viewportName}-fold.png`;
    await page.screenshot({ path: join(OUT, 'shots', shot), fullPage: true });
    await page.screenshot({ path: join(OUT, 'shots', fold) });

    await context.close();

    return {
        id: scenario.id,
        title: scenario.title,
        traces: scenario.traces,
        role: scenario.role ?? 'guest',
        approval: scenario.approval ?? null,
        route: scenario.route,
        viewport: viewportName,
        finalPath,
        pass: failures.length === 0,
        failures,
        probe: probeResult,
        axeViolations,
        consoleErrors,
        apiCalls: [...new Set(calls.map((c) => `${c.method} ${c.path}`))],
        unstubbed: [...unstubbed],
        blockedExternal: [...blockedExternal],
        screenshot: `shots/${shot}`,
        fold: `shots/${fold}`,
    };
}

async function main() {
    await mkdir(join(OUT, 'shots'), { recursive: true });
    const browser = await chromium.launch({
        channel: 'chrome',
        headless: true,
    });

    const selected = ONLY
        ? scenarios.filter((s) => ONLY.includes(s.id))
        : scenarios;
    const results = [];
    const startedAt = Date.now();

    for (const scenario of selected) {
        for (const viewport of scenario.viewports ?? ['desktop']) {
            process.stdout.write(`· ${scenario.id} @ ${viewport} `);
            try {
                const result = await runScenario(browser, scenario, viewport);
                results.push(result);
                process.stdout.write(
                    result.pass ? 'ok\n' : `FAIL — ${result.failures[0]}\n`
                );
            } catch (err) {
                results.push({
                    id: scenario.id,
                    title: scenario.title,
                    viewport,
                    pass: false,
                    failures: [`harness error: ${err.message}`],
                });
                process.stdout.write(`ERROR — ${err.message}\n`);
            }
        }
    }

    await browser.close();

    const report = {
        base: BASE,
        ranAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        total: results.length,
        failed: results.filter((r) => !r.pass).length,
        results,
    };
    await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2));

    console.log(
        `\n${report.total - report.failed}/${report.total} passed in ${(report.durationMs / 1000).toFixed(1)}s → ${OUT}`
    );
    process.exitCode = report.failed ? 1 : 0;
}

await main();
