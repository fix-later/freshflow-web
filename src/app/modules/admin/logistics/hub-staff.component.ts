import { Location } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { apiErrorMessage } from '../admin.service';
import { CrudOption } from '../shared/resource-crud.types';
import { LogisticsAdminService } from './logistics-admin.service';

/**
 * Admin ▸ Logistics ▸ Hubs ▸ Staff roster. Mirrors the market-assignment
 * picker on user detail: a checkbox list of hub-staff users, saved as a full
 * replacement via `PUT /hubs/{hubId}/staff-assignments`. The hub name comes
 * from the row the hubs list passed via router `state` (there is no
 * `GET /hubs/{id}` call here), falling back to the id.
 */
@Component({
    selector: 'admin-hub-staff',
    templateUrl: './hub-staff.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    // Full-width flex host so the page fills the screen (see ResourceCrudComponent).
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        MatButtonModule,
        MatCheckboxModule,
        MatIconModule,
        MatProgressBarModule,
        MatSnackBarModule,
        TranslocoModule,
    ],
})
export class HubStaffComponent implements OnInit {
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _location = inject(Location);
    private readonly _logistics = inject(LogisticsAdminService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    readonly hubId = this._route.snapshot.params['hubId'] as string;
    readonly hubName = signal('');
    readonly staff = signal<CrudOption[]>([]);
    readonly assignedIds = signal<Set<string>>(new Set());
    readonly loading = signal(false);
    readonly saving = signal(false);

    ngOnInit(): void {
        const state = this._location.getState() as { hubName?: string };
        this.hubName.set(state?.hubName ?? this.hubId);
        if (!state?.hubName) {
            // Deep link or reload: router state is gone, so read the name back
            // rather than leaving a UUID in the heading.
            this._logistics
                .getHubName(this.hubId)
                .then((name) => name && this.hubName.set(name))
                .catch(() => undefined);
        }

        this.loading.set(true);
        Promise.all([
            this._logistics.hubManagerOptions(),
            this._logistics.listHubStaffAssignments(this.hubId),
        ])
            .then(([staff, assigned]) => {
                this.staff.set(staff);
                this.assignedIds.set(new Set(assigned));
            })
            .catch(() => {
                this.staff.set([]);
                this.assignedIds.set(new Set());
            })
            .finally(() => this.loading.set(false));
    }

    goBack(): void {
        this._router.navigate(['/admin/hubs']);
    }

    isAssigned(userId: string): boolean {
        return this.assignedIds().has(userId);
    }

    toggle(userId: string): void {
        this.assignedIds.update((set) => {
            const next = new Set(set);
            if (next.has(userId)) {
                next.delete(userId);
            } else {
                next.add(userId);
            }
            return next;
        });
    }

    save(): void {
        this.saving.set(true);
        this._logistics
            .replaceHubStaffAssignments(
                this.hubId,
                Array.from(this.assignedIds())
            )
            .then(async () => {
                this._notify(
                    this._transloco.translate('admin.hubStaff.saveSuccess')
                );
                // Read the roster back: the checkboxes currently show what was
                // submitted, which is not necessarily what the server kept
                // (it may drop ids that are no longer eligible hub staff).
                await this._reloadAssignments();
            })
            .catch(async (err) =>
                this._notify(
                    (await apiErrorMessage(err)) ??
                        this._transloco.translate('admin.hubStaff.saveError')
                )
            )
            .finally(() => this.saving.set(false));
    }

    /** Re-reads the saved roster, leaving the checkboxes as-is on failure. */
    private async _reloadAssignments(): Promise<void> {
        try {
            const assigned = await this._logistics.listHubStaffAssignments(
                this.hubId
            );
            this.assignedIds.set(new Set(assigned));
        } catch {
            // Keep the submitted selection rather than blanking the form.
        }
    }

    private _notify(message: string): void {
        this._snackBar.open(message, undefined, { duration: 3000 });
    }
}
