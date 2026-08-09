import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    TemplateRef,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
    MatDialog,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import {
    applyApiErrorToForm,
    clearServerErrors,
    fieldErrorKey,
    fieldMaxLength,
    serverError,
} from 'app/core/api/form-errors';
import { trimmedMaxLengthValidator } from 'app/core/api/validators';
import { DateTime } from 'luxon';
import { orderStatusPillClass } from '../orders/orders-list.component';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { ADMIN_DEFAULT_PAGE_SIZE, toApiPage } from '../shared/admin-pagination';
import { ScheduledOrdersAdminService } from './scheduled-orders-admin.service';
import {
    ADMIN_RECURRENCE_TYPES,
    AdminScheduledOrder,
    AdminScheduledOrderInstance,
    SCHEDULED_ORDER_NOTES_MAX_LENGTH,
    isScheduleCancelled,
    scheduleStatusPillClass,
} from './scheduled-orders-admin.types';

/**
 * Admin ▸ Operations ▸ Scheduled orders ▸ Detail.
 *
 * Three endpoints meet here: the schedule itself, the runs it has generated
 * (`…/instances`), and the two writes — `PATCH` to correct it and
 * `PATCH …/cancel` to stop it. Cancelling only stops *future* runs; the orders
 * already generated stay ordinary orders, which is why the instances list links
 * each one out to `/admin/orders/{id}` rather than offering a bulk action.
 */
@Component({
    selector: 'admin-scheduled-order-detail',
    templateUrl: './scheduled-order-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
        MatDatepickerModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
})
export class ScheduledOrderDetailComponent implements OnInit {
    private readonly _schedules = inject(ScheduledOrdersAdminService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _dialog = inject(MatDialog);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);

    private _cancelDialogRef: MatDialogRef<unknown> | null = null;

    readonly statusPillClass = scheduleStatusPillClass;
    readonly orderPillClass = orderStatusPillClass;
    readonly recurrenceTypes = ADMIN_RECURRENCE_TYPES;
    readonly notesMaxLength = SCHEDULED_ORDER_NOTES_MAX_LENGTH;

    readonly schedule = signal<AdminScheduledOrder | null>(null);
    readonly loading = signal(false);
    readonly notFound = signal(false);
    readonly saving = signal(false);
    readonly cancelSaving = signal(false);
    readonly actionError = signal<string | null>(null);

    readonly instances = signal<AdminScheduledOrderInstance[]>([]);
    readonly instancesTotal = signal(0);
    readonly instancesPageIndex = signal(0);
    readonly instancesPageSize = signal(ADMIN_DEFAULT_PAGE_SIZE);
    readonly loadingInstances = signal(false);
    readonly instancesError = signal<string | null>(null);

    /** Cancelled is terminal: the backend refuses every write afterwards. */
    readonly cancelled = computed(() => isScheduleCancelled(this.schedule()));

    readonly form = this._formBuilder.nonNullable.group({
        recurrenceType: ['', Validators.required],
        firstRunAt: this._formBuilder.control<DateTime | null>(null, {
            validators: [Validators.required],
        }),
        notes: [
            '',
            [trimmedMaxLengthValidator(SCHEDULED_ORDER_NOTES_MAX_LENGTH)],
        ],
    });

    /** Template helpers for per-field messages. */
    readonly errorKey = fieldErrorKey;
    readonly maxLength = fieldMaxLength;
    readonly serverMessage = serverError;

    ngOnInit(): void {
        const id = this._route.snapshot.paramMap.get('scheduledOrderId') ?? '';
        if (!id) {
            this.notFound.set(true);
            return;
        }
        const passed = (history.state?.schedule ??
            null) as AdminScheduledOrder | null;
        if (passed?.id === id) {
            this._apply(passed);
        } else {
            this._fetch(id);
        }
        this._loadInstances(id);
    }

    goBack(): void {
        void this._router.navigate(['/admin/scheduled-orders']);
    }

    openOrder(instance: AdminScheduledOrderInstance): void {
        if (instance.id) {
            void this._router.navigate(['/admin/orders', instance.id]);
        }
    }

    onInstancesPageChange(event: PageEvent): void {
        this.instancesPageIndex.set(event.pageIndex);
        this.instancesPageSize.set(event.pageSize);
        this._loadInstances(this.schedule()?.id ?? '');
    }

    /** Discards edits and restores the form to what the server last returned. */
    resetForm(): void {
        const current = this.schedule();
        if (current) {
            this._apply(current);
        }
    }

    save(): void {
        const id = this.schedule()?.id;
        if (!id || this.form.invalid || this.cancelled()) {
            this.form.markAllAsTouched();
            return;
        }
        const { recurrenceType, firstRunAt, notes } = this.form.getRawValue();
        this.saving.set(true);
        this.actionError.set(null);
        clearServerErrors(this.form);

        this._schedules
            .updateScheduledOrder(id, {
                recurrenceType,
                firstRunAt:
                    firstRunAt && firstRunAt.isValid
                        ? firstRunAt.toJSDate()
                        : undefined,
                notes: notes.trim(),
            })
            .then(() => {
                this._notify('admin.scheduledOrders.edit.success');
                // PATCH answers without a body, so the screen re-reads rather
                // than assuming the write landed exactly as sent.
                return this._fetch(id);
            })
            .catch(async (err) => {
                await applyApiErrorToForm(this.form, err, (key) =>
                    this._transloco.translate(key)
                );
                this.actionError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'admin.scheduledOrders.edit.error'
                    )
                );
            })
            .finally(() => this.saving.set(false));
    }

    openCancel(template: TemplateRef<unknown>): void {
        if (this.cancelled() || this._cancelDialogRef) {
            return;
        }
        this.cancelSaving.set(false);
        this._cancelDialogRef = this._dialog.open(template, {
            autoFocus: 'first-tabbable',
            maxWidth: '95vw',
        });
        this._cancelDialogRef.afterClosed().subscribe(() => {
            this._cancelDialogRef = null;
        });
    }

    closeCancel(): void {
        this._cancelDialogRef?.close();
    }

    confirmCancel(): void {
        const id = this.schedule()?.id;
        if (!id) {
            return;
        }
        this.cancelSaving.set(true);
        this._schedules
            .cancelScheduledOrder(id)
            .then(() => {
                this._notify('admin.scheduledOrders.cancel.success');
                this.closeCancel();
                return this._fetch(id);
            })
            .catch(async (err) => {
                this.actionError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'admin.scheduledOrders.cancel.error'
                    )
                );
                this.closeCancel();
            })
            .finally(() => this.cancelSaving.set(false));
    }

    recurrenceLabel(value: string | null | undefined): string {
        const token = String(value ?? '')
            .trim()
            .toLowerCase();
        if (!token) {
            return '—';
        }
        const key = `admin.scheduledOrders.recurrence.${token}`;
        const translated = this._transloco.translate(key);
        return translated === key ? token : translated;
    }

    statusLabel(): string {
        return this._transloco.translate(
            this.cancelled()
                ? 'admin.scheduledOrders.status.cancelled'
                : 'admin.scheduledOrders.status.active'
        );
    }

    orderStatusLabel(status: string | null | undefined): string {
        const token = String(status ?? '')
            .trim()
            .toLowerCase();
        if (!token) {
            return '—';
        }
        const key = `admin.orders.status.${token}`;
        const translated = this._transloco.translate(key);
        return translated === key ? String(status) : translated;
    }

    money(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        const amount = Number(value);
        return Number.isNaN(amount)
            ? String(value)
            : `${amount.toLocaleString(this._transloco.getActiveLang())} ₫`;
    }

    formatDate(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        const date = new Date(String(value));
        return Number.isNaN(date.getTime())
            ? '—'
            : date.toLocaleString(this._transloco.getActiveLang());
    }

    trackById(index: number, row: AdminScheduledOrderInstance): string {
        return row.id || String(index);
    }

    private async _fetch(scheduledOrderId: string): Promise<void> {
        this.loading.set(true);
        this.notFound.set(false);
        try {
            const found =
                await this._schedules.getScheduledOrder(scheduledOrderId);
            if (found) {
                this._apply(found);
            } else {
                this.schedule.set(null);
                this.notFound.set(true);
            }
        } catch {
            this.schedule.set(null);
            this.notFound.set(true);
        } finally {
            this.loading.set(false);
        }
    }

    /** Seeds the edit form from a schedule, and disables it once cancelled. */
    private _apply(schedule: AdminScheduledOrder): void {
        this.schedule.set(schedule);
        const firstRunAt = schedule.firstRunAt
            ? DateTime.fromISO(String(schedule.firstRunAt))
            : null;
        this.form.reset({
            recurrenceType: String(schedule.recurrenceType ?? '').toLowerCase(),
            firstRunAt: firstRunAt?.isValid ? firstRunAt : null,
            notes: schedule.notes ?? '',
        });
        if (isScheduleCancelled(schedule)) {
            this.form.disable();
        } else {
            this.form.enable();
        }
    }

    private _loadInstances(scheduledOrderId: string): void {
        if (!scheduledOrderId) {
            return;
        }
        this.loadingInstances.set(true);
        this.instancesError.set(null);
        this._schedules
            .getInstances(
                scheduledOrderId,
                toApiPage(this.instancesPageIndex()),
                this.instancesPageSize()
            )
            .then((result) => {
                this.instances.set(result.instances);
                this.instancesTotal.set(result.totalCount);
            })
            .catch(async (err) => {
                this.instances.set([]);
                this.instancesTotal.set(0);
                // An empty run list is a meaningful state (nothing generated
                // yet), so a failed read must not be allowed to look like one.
                this.instancesError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'admin.scheduledOrders.instances.loadError'
                    )
                );
            })
            .finally(() => this.loadingInstances.set(false));
    }

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }
}
