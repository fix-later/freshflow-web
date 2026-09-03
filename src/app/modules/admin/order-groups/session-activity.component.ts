import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    computed,
    effect,
    inject,
    input,
    signal,
    untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { AdminService } from '../admin.service';
import { AdminBatchItem, AdminOrderGroupRow } from '../admin.types';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { CrudRow } from '../shared/resource-crud.types';
import {
    SessionAction,
    SessionActor,
    byHappenedAt,
    hubHandoverActions,
    hubInboundActions,
    hubOutboundActions,
    hubSortingActions,
    marketAgentActions,
    sessionMilestones,
} from './session-activity';

type ActorFilter = SessionActor | '';

/**
 * Admin ▸ Phiên chợ ▸ Hoạt động — what the people working one session did,
 * in the order they did it.
 *
 * The reports tab beside this one answers "what went wrong". This answers the
 * other half of the same question: what was actually done, by whom, and when —
 * the agents' purchases off the session's batch, and the hub's receiving,
 * sorting, dispatch and driver hand-offs for that hub-day.
 *
 * **What can and cannot be tied to one session.** The batch belongs to the
 * session, so every agent act here is certainly this session's. The hub works
 * per hub-day: an arrival names the chợ it came from (`sourceMarketId`) and a
 * sorted line names its order, so both are narrowed; dispatch and hand-over
 * name only a route, so they are the hub's acts on the session's service date
 * and the panel says as much rather than implying more.
 *
 * Four reads, all cheap and none on the rate-limited orders endpoint, and only
 * once the tab is opened.
 */
@Component({
    selector: 'admin-session-activity',
    templateUrl: './session-activity.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatProgressBarModule,
        MatSelectModule,
        MatTooltipModule,
        TranslocoModule,
    ],
})
export class SessionActivityComponent {
    private readonly _admin = inject(AdminService);
    private readonly _logistics = inject(LogisticsAdminService);
    private readonly _transloco = inject(TranslocoService);

    /** The session's procurement batch, as the dialog already loaded it. */
    readonly batch = input<AdminOrderGroupRow | null>(null);
    readonly hubId = input<string | null>(null);
    readonly marketId = input<string | null>(null);
    /** `yyyy-MM-dd` — the day the hub's work is read for. */
    readonly serviceDate = input<string | null>(null);
    /** Nothing is read until the tab is the one on screen. */
    readonly active = input(false);

    /**
     * Bumped by the dialog's refresh button. Part of {@link _key}, so asking
     * for a reload invalidates what this panel has cached and it re-reads the
     * next time it is on screen — one button in the header serving every tab.
     */
    readonly reloadToken = input(0);

    readonly loading = signal(false);
    readonly loadError = signal<string | null>(null);
    /** At least one of the four hub reads did not answer. */
    readonly partial = signal(false);
    readonly hubActions = signal<SessionAction[]>([]);
    readonly userLabels = signal<Map<string, string>>(new Map());

    readonly actorFilter = signal<ActorFilter>('');

    private _loadedKey: string | null = null;

    constructor() {
        effect(() => {
            const key = this._key();
            const active = this.active();
            untracked(() => {
                if (!active || key === this._loadedKey) {
                    return;
                }
                this._loadedKey = key;
                void this._load();
            });
        });
    }

    /** The agents' acts, off the batch — no request, so they need no loading. */
    readonly agentActions = computed(() =>
        marketAgentActions(
            this.batch(),
            (value) => this.money(value),
            (value) => this.number(value)
        )
    );

    readonly milestones = computed(() => sessionMilestones(this.batch()));

    readonly actions = computed(() =>
        [
            ...this.agentActions(),
            ...this.hubActions(),
            ...this.milestones(),
        ].sort(byHappenedAt)
    );

    readonly filtered = computed(() => {
        const actor = this.actorFilter();
        if (!actor) {
            return this.actions();
        }
        // A milestone is the frame the acts sit in, so it stays whichever side
        // is being read — a filtered timeline that starts nowhere is worse.
        return this.actions().filter(
            (action) => action.actor === actor || action.actor === 'session'
        );
    });

    /** Lines the batch was built with, and how many an agent has bought. */
    readonly purchaseProgress = computed(() => {
        const items = (this.batch()?.['items'] ?? []) as AdminBatchItem[];
        const lines = Array.isArray(items) ? items : [];
        return {
            total: lines.length,
            purchased: lines.filter((item) => !!item.purchasedAt).length,
        };
    });

    readonly summary = computed(() => {
        const actions = this.actions();
        const progress = this.purchaseProgress();
        return {
            agent: actions.filter((row) => row.actor === 'market_agent').length,
            hub: actions.filter((row) => row.actor === 'hub_staff').length,
            purchased: progress.purchased,
            lines: progress.total,
            people: new Set(
                actions
                    .map((row) => row.actorId)
                    .filter((id): id is string => !!id)
            ).size,
        };
    });

    readonly hasBatch = computed(() => !!this.batch()?.id);

    reload(): void {
        void this._load();
    }

    setActorFilter(value: ActorFilter): void {
        this.actorFilter.set(value);
    }

    actorLabel(action: SessionAction): string {
        if (action.actorId) {
            const name = this.userLabels().get(action.actorId);
            if (name) {
                return name;
            }
        }
        return this._t(
            `admin.orderGroups.marketSessions.activity.actor.${action.actor}`
        );
    }

    kindLabel(action: SessionAction): string {
        const key = `admin.orderGroups.marketSessions.activity.kind.${action.kind}`;
        const label = this._t(key);
        return label === key ? action.kind : label;
    }

    /**
     * The timeline marker's colours — indigo for the chợ, cyan for the hub, the
     * same pairing the reports use.
     *
     * People's acts are ringed and the session's own milestones are filled: the
     * milestones are the spine the rest hangs off, so they read as the darker
     * marks even though there are only ever three of them.
     */
    actorMarkerClass(action: SessionAction): string {
        switch (action.actor) {
            case 'market_agent':
                return 'bg-card text-indigo-600 ring-indigo-200 dark:bg-default dark:text-indigo-300 dark:ring-indigo-800';
            case 'hub_staff':
                return 'bg-card text-cyan-600 ring-cyan-200 dark:bg-default dark:text-cyan-300 dark:ring-cyan-800';
            default:
                return 'bg-gray-700 text-white ring-transparent dark:bg-gray-600';
        }
    }

    /** What the marker shows: who did it, not what was done. */
    actorIcon(action: SessionAction): string {
        switch (action.actor) {
            case 'market_agent':
                return 'heroicons_solid:shopping-bag';
            case 'hub_staff':
                return 'heroicons_solid:cube';
            default:
                return 'heroicons_solid:flag';
        }
    }

    money(value: number): string {
        return new Intl.NumberFormat(this._lang(), {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0,
        }).format(value);
    }

    number(value: number): string {
        return value.toLocaleString(this._lang());
    }

    formatTime(value: string | null): string {
        if (!value) {
            return '—';
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? '—'
            : date.toLocaleString(this._lang());
    }

    trackById(index: number, action: SessionAction): string {
        return action.id || String(index);
    }

    /**
     * The hub's four logs for the session's service date, each on its own.
     *
     * `Promise.allSettled`, not `all`: sorting answers 400 without a service
     * date and hand-overs are a cursor walk, so one of the four failing must
     * cost its own line of the timeline and nothing else.
     */
    private async _load(): Promise<void> {
        const key = this._key();
        const hubId = this.hubId();
        const serviceDate = this.serviceDate();
        this.loading.set(true);
        this.loadError.set(null);
        this.partial.set(false);
        try {
            const labels = this._admin
                .getUserLabels()
                .then((map) => this.userLabels.set(map))
                .catch(() => undefined);

            if (!hubId) {
                this.hubActions.set([]);
                await labels;
                return;
            }

            const [inbound, sorting, outbound, handovers] =
                await Promise.allSettled([
                    this._logistics.getInboundHistory(
                        hubId,
                        serviceDate ?? undefined
                    ),
                    this._logistics.getSortingProgress(
                        hubId,
                        serviceDate ?? undefined
                    ),
                    this._logistics.getOutbound(
                        hubId,
                        serviceDate ?? undefined
                    ),
                    this._logistics.getHandovers(hubId),
                ]);
            await labels;
            if (key !== this._key()) {
                return;
            }

            const kg = (value: number) => `${this.number(value)} kg`;
            const rows = (
                result: PromiseSettledResult<CrudRow[]>
            ): CrudRow[] => (result.status === 'fulfilled' ? result.value : []);

            this.hubActions.set([
                ...hubInboundActions(rows(inbound), this.marketId(), kg),
                ...hubSortingActions(rows(sorting), this._orderIds(), kg),
                ...hubOutboundActions(rows(outbound), kg),
                ...hubHandoverActions(rows(handovers), serviceDate),
            ]);

            const failures = [inbound, sorting, outbound, handovers].filter(
                (result) => result.status === 'rejected'
            );
            if (failures.length === 4) {
                this.loadError.set(
                    await describeApiError(
                        (failures[0] as PromiseRejectedResult).reason,
                        (translationKey) => this._t(translationKey),
                        'admin.orderGroups.marketSessions.activity.loadError'
                    )
                );
                this._loadedKey = null;
            } else if (failures.length) {
                this.partial.set(true);
            }
        } finally {
            if (key === this._key()) {
                this.loading.set(false);
            }
        }
    }

    /** The session's own orders, for narrowing what the hub sorted. */
    private _orderIds(): ReadonlySet<string> {
        const members = this.batch()?.['members'];
        if (!Array.isArray(members)) {
            return new Set<string>();
        }
        return new Set(
            members
                .map((member) =>
                    String((member as CrudRow)['orderId'] ?? '').trim()
                )
                .filter((orderId) => !!orderId)
        );
    }

    private _key(): string {
        return [
            this.batch()?.id ?? '',
            this.hubId() ?? '',
            this.serviceDate() ?? '',
            String(this.reloadToken()),
        ].join('|');
    }

    private _t(key: string): string {
        return this._transloco.translate(key);
    }

    private _lang(): string {
        return this._transloco.getActiveLang();
    }
}
