import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    TemplateRef,
    ViewEncapsulation,
    computed,
    inject,
    input,
    signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
    MatDialog,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { RoleLabelPipe } from 'app/core/i18n/role-label.pipe';
import { includesFolded } from 'app/core/util/text-search';
import { AdminService } from '../admin.service';
import { AdminUserRow } from '../admin.types';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';

const MARKET_AGENT = 'market_agent';
const HUB_STAFF = 'hub_staff';
const DRIVER = 'driver';

/**
 * Roles the dialog lists. Driver is browsable but not attachable — nothing in
 * the backend ties a driver to a hub or a chợ (see the class comment) — so its
 * rows come up read-only and Save stays disabled, rather than the role being
 * hidden as if no drivers existed.
 */
const PICKER_ROLES = [MARKET_AGENT, HUB_STAFF, DRIVER] as const;

interface StaffRow {
    id: string;
    email: string;
    phone: string;
    avatarUrl: string;
    role: string;
    /** Hub the person works at — hub-scoped roles only. */
    hubId: string;
    /** Where they are attached: a hub name, or the chợ for an agent. */
    position: string;
    /** False for drivers, which have nothing tying them to a chợ to undo. */
    removable: boolean;
}

interface CandidateRow {
    id: string;
    email: string;
    avatarUrl: string;
    /** Every market / hub this person already works at, comma-joined. */
    position: string;
    /** Already on this chợ — listed, but not pickable again. */
    alreadyHere: boolean;
    /**
     * Deactivated accounts are listed but not pickable:
     * `ReplaceHubStaffAssignmentsCommandHandler` rejects the *whole* roster with
     * `INVALID_ASSIGNMENT_TARGET` if one entry is inactive, so one stale pick
     * would fail every other pick with it.
     */
    inactive: boolean;
}

/**
 * Nhân sự of a chợ — market agents, hub staff and drivers in one list.
 *
 * The three live in three different places, and only two can be attached here:
 *
 * - **market agent** → `UserMarketAssignment`, replaced per agent
 *   (`PUT /admin/users/{id}/market-assignments`), so the assignment is to the
 *   chợ itself
 * - **hub staff** → the roster of one of this market's hubs
 *   (`PUT /hubs/{hubId}/staff-assignments`), so the assignment is to a hub
 * - **driver** → nothing. `DriverProfile` carries no hub or market, and the one
 *   hub-shaped endpoint (`/hubs/{hubId}/drivers/eligible`) ignores its hub id.
 *   Drivers are therefore listed but not attachable.
 */
@Component({
    selector: 'admin-market-staff-panel',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
        MatCheckboxModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        RoleLabelPipe,
        TranslocoModule,
    ],
    templateUrl: './market-staff-panel.component.html',
    styles: [
        `
            /* Photo, role chip and the action are fixed at their content width;
               the three text columns split what is left in equal thirds, so
               every row lines up whatever the role. */
            .market-staff-grid {
                /* photo | email | phone | position | role | remove */
                grid-template-columns:
                    3.25rem minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 10rem
                    5rem;
            }

            .market-staff-picker-grid {
                /* checkbox | photo | email | position */
                grid-template-columns: 2.5rem 3.25rem minmax(0, 1fr) minmax(
                        0,
                        1fr
                    );
            }

            .market-staff-avatar {
                width: 2.25rem;
                height: 2.25rem;
                flex: 0 0 auto;
                border-radius: 9999px;
                object-fit: cover;
            }
        `,
    ],
})
export class MarketStaffPanelComponent implements OnInit {
    private readonly _admin = inject(AdminService);
    private readonly _logistics = inject(LogisticsAdminService);
    private readonly _dialog = inject(MatDialog);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    /** Empty on the create page, where the market does not exist yet. */
    readonly marketId = input('');

    readonly rows = signal<StaffRow[]>([]);
    readonly loading = signal(false);
    readonly saving = signal(false);

    /** Hubs of this market — where a hub-scoped role gets tracked. */
    readonly hubs = signal<{ id: string; name: string }[]>([]);

    /** Header filters over the roster itself (the dialog has its own search). */
    readonly listSearch = signal('');
    readonly roleFilter = signal('');
    readonly positionFilter = signal('');

    /** Only the roles and places this chợ actually has people in. */
    readonly roleOptions = computed(() => [
        ...new Set(this.rows().map((row) => row.role)),
    ]);
    readonly positionOptions = computed(() =>
        [
            ...new Set(
                this.rows()
                    .map((row) => row.position)
                    .filter((name) => !!name)
            ),
        ].sort((a, b) => a.localeCompare(b))
    );

    readonly hasActiveFilters = computed(
        () => !!this.roleFilter() || !!this.positionFilter()
    );

    readonly visibleRows = computed(() => {
        const term = this.listSearch().trim();
        const role = this.roleFilter();
        const position = this.positionFilter();
        return this.rows().filter((row) => {
            if (role && row.role !== role) {
                return false;
            }
            if (position && row.position !== position) {
                return false;
            }
            return (
                !term ||
                includesFolded(row.email, term) ||
                includesFolded(row.phone, term) ||
                includesFolded(row.position, term)
            );
        });
    });

    readonly candidates = signal<CandidateRow[]>([]);
    readonly loadingCandidates = signal(false);
    readonly picked = signal<Set<string>>(new Set());
    readonly candidateSearch = signal('');

    readonly pickerRoles = PICKER_ROLES;
    readonly addForm = new FormGroup({
        role: new FormControl<string>(MARKET_AGENT, { nonNullable: true }),
        hubId: new FormControl<string>('', { nonNullable: true }),
    });

    /** Hub staff are tracked per hub, so the dialog asks which one. */
    readonly needsHub = computed(
        () => this.addForm.controls.role.value === HUB_STAFF
    );

    /** Drivers can be browsed but not attached — see PICKER_ROLES. */
    readonly readOnlyRole = computed(
        () => this.addForm.controls.role.value === DRIVER
    );

    readonly visibleCandidates = computed(() => {
        const term = this.candidateSearch().trim();
        const list = this.candidates();
        return term
            ? list.filter(
                  (row) =>
                      includesFolded(row.email, term) ||
                      includesFolded(row.position, term)
              )
            : list;
    });

    readonly pickedCount = computed(() => this.picked().size);

    private _dialogRef: MatDialogRef<unknown> | null = null;

    ngOnInit(): void {
        void this._load();
    }

    rolePillClass(role: string): string {
        switch (role) {
            case MARKET_AGENT:
                return 'admin-pill admin-pill-success';
            case HUB_STAFF:
                return 'admin-pill admin-pill-info';
            default:
                return 'admin-pill admin-pill-teal';
        }
    }

    /** First letter of the email — the stand-in when there is no photo. */
    initial(row: { email: string }): string {
        return (row.email.trim()[0] ?? '?').toUpperCase();
    }

    clearFilters(): void {
        this.roleFilter.set('');
        this.positionFilter.set('');
    }

    openAdd(template: TemplateRef<unknown>): void {
        this.addForm.reset({ role: MARKET_AGENT, hubId: '' });
        this.picked.set(new Set());
        this.candidateSearch.set('');
        void this._loadCandidates(MARKET_AGENT);
        this._dialogRef = this._dialog.open(template, {
            autoFocus: 'first-tabbable',
            maxWidth: '95vw',
        });
        this._dialogRef.afterClosed().subscribe(() => (this._dialogRef = null));
    }

    closeAdd(): void {
        this._dialogRef?.close();
    }

    /** Switching role changes who can be picked, and whether a hub is needed. */
    onRoleChange(role: string): void {
        this.addForm.patchValue({ hubId: '' });
        this.picked.set(new Set());
        void this._loadCandidates(role);
    }

    isPicked(id: string): boolean {
        return this.picked().has(id);
    }

    togglePick(id: string, checked: boolean): void {
        const next = new Set(this.picked());
        if (checked) {
            next.add(id);
        } else {
            next.delete(id);
        }
        this.picked.set(next);
    }

    canSave(): boolean {
        return (
            !this.readOnlyRole() &&
            this.pickedCount() > 0 &&
            (!this.needsHub() || !!this.addForm.controls.hubId.value) &&
            !this.saving()
        );
    }

    save(): void {
        if (!this.canSave()) {
            return;
        }
        const { role, hubId } = this.addForm.getRawValue();
        const ids = [...this.picked()];
        this.saving.set(true);
        const assign =
            role === MARKET_AGENT
                ? this._assignAgents(ids)
                : this._assignHubStaff(hubId, ids);
        void assign
            .then(() => {
                this._notify('admin.markets.staff.addSuccess');
                this.closeAdd();
                return this._load();
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.saving.set(false));
    }

    remove(row: StaffRow): void {
        if (!row.removable || this.saving()) {
            return;
        }
        this.saving.set(true);
        const drop =
            row.role === MARKET_AGENT
                ? this._admin.setMarketAgents(this.marketId(), [], [row.id])
                : this._dropHubStaff(row.hubId, row.id);
        void drop
            .then(() => {
                this._notify('admin.markets.staff.removeSuccess');
                return this._load();
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.saving.set(false));
    }

    private _assignAgents(userIds: string[]): Promise<void> {
        const current = this.rows()
            .filter((row) => row.role === MARKET_AGENT)
            .map((row) => row.id);
        return this._admin.setMarketAgents(
            this.marketId(),
            [...current, ...userIds],
            current
        );
    }

    private async _assignHubStaff(
        hubId: string,
        userIds: string[]
    ): Promise<void> {
        const keep = await this._writableRoster(hubId);
        await this._logistics.replaceHubStaffAssignments(hubId, [
            ...new Set([...keep, ...userIds]),
        ]);
    }

    private async _dropHubStaff(hubId: string, userId: string): Promise<void> {
        const keep = await this._writableRoster(hubId);
        await this._logistics.replaceHubStaffAssignments(
            hubId,
            keep.filter((id) => id !== userId)
        );
    }

    /**
     * The hub's current roster, minus anyone the replace endpoint would now
     * refuse. Adding and removing both send the *whole* roster back, and
     * `ReplaceHubStaffAssignmentsCommandHandler` validates every id in it — so
     * one member who has since been deactivated (or moved off `hub_staff`)
     * would fail every later edit of that hub with `INVALID_ASSIGNMENT_TARGET`,
     * including the removals meant to clean it up. They are dropped instead:
     * the roster cannot hold them either way, and the alternative is a hub
     * nobody can edit at all.
     */
    private async _writableRoster(hubId: string): Promise<string[]> {
        const [roster, people] = await Promise.all([
            this._logistics.getHubStaffAssignments(hubId),
            this._usersOf(HUB_STAFF),
        ]);
        const assignable = new Set(
            people
                .filter((person) => person.isActive !== false)
                .map((person) => person.id)
        );
        return roster.filter((id) => assignable.has(id));
    }

    private async _load(): Promise<void> {
        const marketId = this.marketId();
        this.loading.set(true);
        try {
            const hubs = marketId
                ? await this._logistics.hubOptions(marketId).catch(() => [])
                : [];
            this.hubs.set(
                hubs.map((hub) => ({ id: hub.value, name: hub.label }))
            );

            // Only people actually attached to this chợ or one of its hubs.
            // Drivers are absent by construction: nothing attaches them (see
            // the class comment), so listing them here would be listing the
            // whole fleet under a heading that says "of this market".
            const hubIds = hubs.map((hub) => hub.value);
            const [agents, staff] = await Promise.all([
                this._agentRows(marketId),
                this._hubStaffRows(hubIds),
            ]);
            this.rows.set([...agents, ...staff]);
        } finally {
            this.loading.set(false);
        }
    }

    private async _agentRows(marketId: string): Promise<StaffRow[]> {
        if (!marketId) {
            return [];
        }
        const { agentsByMarket } = await this._admin
            .getMarketAgentsWithAssignments()
            .catch(() => ({
                agents: [],
                agentsByMarket: new Map<string, AdminUserRow[]>(),
            }));
        const marketName = await this._marketName(marketId);
        return (agentsByMarket.get(marketId) ?? []).map((agent) =>
            this._toRow(agent, MARKET_AGENT, '', marketName, true)
        );
    }

    private async _hubStaffRows(hubIds: string[]): Promise<StaffRow[]> {
        if (hubIds.length === 0) {
            return [];
        }
        const people = await this._usersOf(HUB_STAFF);
        const byId = new Map(people.map((person) => [person.id, person]));
        const hubNames = new Map(this.hubs().map((hub) => [hub.id, hub.name]));
        const perHub = await Promise.all(
            hubIds.map(async (hubId) => ({
                hubId,
                ids: await this._logistics
                    .getHubStaffAssignments(hubId)
                    .catch(() => []),
            }))
        );
        return perHub.flatMap(({ hubId, ids }) =>
            ids
                .map((id) => byId.get(id))
                .filter((person): person is AdminUserRow => !!person)
                .map((person) =>
                    this._toRow(
                        person,
                        HUB_STAFF,
                        hubId,
                        hubNames.get(hubId) ?? '',
                        true
                    )
                )
        );
    }

    private _toRow(
        person: AdminUserRow,
        role: string,
        hubId: string,
        position: string,
        removable: boolean
    ): StaffRow {
        return {
            id: person.id,
            // `UserSummaryDto` stops at email and phone, so there is no name to
            // show — email is the identity here. The photo degrades to an
            // initial and fills in by itself if the DTO ever grows an avatar.
            avatarUrl: String(person['avatarUrl'] ?? '').trim(),
            email: person.email || person.id,
            phone: person.phone || '',
            role,
            hubId,
            position,
            removable,
        };
    }

    private _usersOf(role: string): Promise<AdminUserRow[]> {
        return this._admin.listUsersByRole(role).catch(() => []);
    }

    private async _marketName(marketId: string): Promise<string> {
        const markets = await this._logistics.marketOptions().catch(() => []);
        return markets.find((m) => m.value === marketId)?.label ?? '';
    }

    /**
     * Users of `role` who are not on this chợ yet, each labelled with where
     * they already work — so an admin can see they are taking someone off
     * another market or hub before picking them.
     */
    private async _loadCandidates(role: string): Promise<void> {
        this.loadingCandidates.set(true);
        try {
            // Everyone of that role is listed — the ones already on this chợ
            // are shown greyed out rather than hidden, so it is obvious they
            // are here and not simply missing.
            const taken = new Set(
                this.rows()
                    .filter((row) => row.role === role)
                    .map((row) => row.id)
            );
            const [people, positions] = await Promise.all([
                this._usersOf(role),
                this._positionsFor(role),
            ]);
            this.candidates.set(
                people.map((person) => ({
                    id: person.id,
                    email: person.email || person.id,
                    avatarUrl: String(person['avatarUrl'] ?? '').trim(),
                    position: positions.get(person.id) ?? '',
                    alreadyHere: taken.has(person.id),
                    inactive: person.isActive === false,
                }))
            );
        } finally {
            this.loadingCandidates.set(false);
        }
    }

    /** userId → every market (agents) or hub (staff) they are attached to. */
    private async _positionsFor(role: string): Promise<Map<string, string>> {
        const positions = new Map<string, string>();
        const append = (userId: string, label: string): void => {
            if (!label) {
                return;
            }
            const current = positions.get(userId);
            positions.set(userId, current ? `${current}, ${label}` : label);
        };

        if (role === MARKET_AGENT) {
            const [{ agentsByMarket }, markets] = await Promise.all([
                this._admin.getMarketAgentsWithAssignments().catch(() => ({
                    agents: [],
                    agentsByMarket: new Map<string, AdminUserRow[]>(),
                })),
                this._logistics.marketOptions().catch(() => []),
            ]);
            const marketNames = new Map<string, string>(
                markets.map((m): [string, string] => [m.value, m.label])
            );
            for (const [marketId, agents] of agentsByMarket) {
                for (const agent of agents) {
                    append(agent.id, marketNames.get(marketId) ?? marketId);
                }
            }
            return positions;
        }

        // Hub-scoped roles: read every hub's roster, not just this market's, so
        // the picker can say a candidate already works elsewhere.
        const hubs = await this._logistics.hubOptions().catch(() => []);
        const rosters = await Promise.all(
            hubs.map(async (hub) => ({
                label: hub.label,
                ids: await this._logistics
                    .getHubStaffAssignments(hub.value)
                    .catch(() => []),
            }))
        );
        for (const { label, ids } of rosters) {
            for (const id of ids) {
                append(id, label);
            }
        }
        return positions;
    }

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }

    private async _notifyError(err: unknown): Promise<void> {
        this._snackBar.open(
            await describeApiError(
                err,
                (key) => this._transloco.translate(key),
                'admin.crud.saveError'
            ),
            undefined,
            { duration: 5000 }
        );
    }
}
