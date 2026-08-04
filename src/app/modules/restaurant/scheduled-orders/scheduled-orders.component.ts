import { DatePipe, DecimalPipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import {
    applyApiErrorToForm,
    clearServerErrors,
    fieldErrorKey,
    fieldMaxLength,
    serverError,
} from 'app/core/api/form-errors';
import {
    nonBlankValidator,
    trimmedMaxLengthValidator,
} from 'app/core/api/validators';
import {
    futureDateTimeValidator,
    ORDER_TEXT_MAX_LENGTH,
} from 'app/modules/orders/orders.validation';
import { RestaurantScheduledOrdersService } from './scheduled-orders.service';
import {
    isKnownRecurrence,
    SCHEDULE_RECURRENCE_TYPES,
    ScheduledOrder,
    ScheduledOrderInstance,
} from './scheduled-orders.types';

/**
 * Recurring orders (UC-ORD-09/10) — create a daily or weekly schedule, list
 * them, inspect the runs each has produced, edit one, and stop future runs.
 *
 * Pausing is in BR-ORD-5 but has no endpoint (only `.../cancel`), so it is not
 * offered — a control that cannot reach the server would be a lie.
 */
@Component({
    selector: 'scheduled-orders',
    templateUrl: './scheduled-orders.component.html',
    styleUrl: './scheduled-orders.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        DatePipe,
        DecimalPipe,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
})
export class ScheduledOrdersComponent implements OnInit {
    private readonly _service = inject(RestaurantScheduledOrdersService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _fb = inject(FormBuilder);

    /** Localized reason the list read failed — drives the retry state. */
    readonly loadError = signal<string | null>(null);
    /** Localized reason the last write failed (409 already cancelled, 422, …). */
    readonly actionError = signal<string | null>(null);
    readonly saving = signal(false);

    /** Template helpers for per-field messages. */
    readonly errorKey = fieldErrorKey;
    readonly maxLength = fieldMaxLength;
    readonly serverMessage = serverError;

    /**
     * Editing a schedule (`PATCH`): frequency, first run and notes — the three
     * fields `UpdateScheduledOrderRequest` accepts. Laid out the way Uber Eats
     * orders its recurring-order settings: when it first runs, then how often.
     *
     * `recurrenceType` is an opaque string in the spec — the vocabulary is not
     * enumerated, so this is free text seeded from the current value rather
     * than a select of options we would have to invent.
     */
    /** Recurrence options, from BR-ORD-5 / FR-ORD-009 (daily or weekly). */
    readonly recurrenceTypes = SCHEDULE_RECURRENCE_TYPES;

    /** `null` = closed, `'new'` = creating, otherwise the id being edited. */
    readonly editingId = signal<string | null>(null);
    readonly editForm = this._fb.group({
        recurrenceType: this._fb.nonNullable.control('', {
            validators: [Validators.required, nonBlankValidator],
        }),
        firstRunAt: this._fb.nonNullable.control('', {
            validators: [Validators.required, futureDateTimeValidator],
        }),
        notes: this._fb.nonNullable.control('', {
            validators: [trimmedMaxLengthValidator(ORDER_TEXT_MAX_LENGTH)],
        }),
    });

    readonly loading = signal(true);
    readonly schedules = signal<ScheduledOrder[]>([]);
    readonly includeCancelled = signal(false);

    /** Schedule id whose runs are expanded, plus the runs themselves. */
    readonly expandedId = signal<string | null>(null);
    readonly instances = signal<ScheduledOrderInstance[]>([]);
    readonly instancesLoading = signal(false);

    async ngOnInit(): Promise<void> {
        await this.reload();
    }

    async reload(): Promise<void> {
        this.loading.set(true);
        this.loadError.set(null);
        try {
            const { items } = await this._service.listScheduled(
                1,
                this.includeCancelled()
            );
            this.schedules.set(items);
        } catch (err) {
            // A failed read is not "no schedules" — say which it is.
            this.schedules.set([]);
            this.loadError.set(
                await this._describe(err, 'scheduledOrders.loadError')
            );
        } finally {
            this.loading.set(false);
        }
    }

    async toggleCancelled(include: boolean): Promise<void> {
        this.includeCancelled.set(include);
        await this.reload();
    }

    /** Expand a schedule to show the orders it has generated. */
    async toggleInstances(schedule: ScheduledOrder): Promise<void> {
        if (this.expandedId() === schedule.id) {
            this.expandedId.set(null);
            return;
        }

        this.expandedId.set(schedule.id);
        this.instances.set([]);
        this.instancesLoading.set(true);
        try {
            const { items } = await this._service.listInstances(schedule.id);
            this.instances.set(items);
        } catch (err) {
            this.instances.set([]);
            this.actionError.set(
                await this._describe(err, 'scheduledOrders.instancesError')
            );
        } finally {
            this.instancesLoading.set(false);
        }
    }

    async cancel(schedule: ScheduledOrder): Promise<void> {
        try {
            await this._service.cancelScheduled(schedule.id);
            this._snackBar.open(
                this._transloco.translate('scheduledOrders.cancelled'),
                undefined,
                { duration: 3000 }
            );
            await this.reload();
        } catch (error) {
            // 409 = already cancelled, 404 = gone, 403 = not yours: each gets
            // its own wording, and the list re-reads so it stops showing a
            // schedule the backend no longer has.
            const message = await this._describe(
                error,
                'scheduledOrders.cancelError'
            );
            this.actionError.set(message);
            this._snackBar.open(message, undefined, { duration: 5000 });
            await this.reload();
        }
    }

    /** Opens the form blank to create a new schedule (UC-ORD-09). */
    openCreate(): void {
        this.editingId.set('new');
        this.actionError.set(null);
        clearServerErrors(this.editForm);
        this.editForm.reset({
            recurrenceType: SCHEDULE_RECURRENCE_TYPES[0],
            firstRunAt: '',
            notes: '',
        });
    }

    /** True while the form is creating rather than editing. */
    isCreating(): boolean {
        return this.editingId() === 'new';
    }

    /** Opens the edit form seeded from the schedule's current values. */
    openEdit(schedule: ScheduledOrder): void {
        this.editingId.set(schedule.id);
        this.actionError.set(null);
        clearServerErrors(this.editForm);
        this.editForm.reset({
            // A schedule saved with a value outside the documented vocabulary
            // must not be silently rewritten — leave the select unset instead.
            recurrenceType: isKnownRecurrence(schedule.recurrenceType)
                ? schedule.recurrenceType.toUpperCase()
                : '',
            firstRunAt: toLocalInput(schedule.nextRunAt ?? schedule.firstRunAt),
            notes: schedule.notes ?? '',
        });
    }

    closeEdit(): void {
        this.editingId.set(null);
    }

    /** Persists the edit; only the three PATCH-able fields are sent. */
    async saveEdit(): Promise<void> {
        const id = this.editingId();
        if (!id || this.saving()) {
            return;
        }
        clearServerErrors(this.editForm);
        this.actionError.set(null);
        if (this.editForm.invalid) {
            this.editForm.markAllAsTouched();
            return;
        }
        const v = this.editForm.getRawValue();
        this.saving.set(true);
        try {
            if (id === 'new') {
                await this._service.createScheduled({
                    recurrenceType: v.recurrenceType.trim(),
                    firstRunAt: new Date(v.firstRunAt),
                    notes: v.notes.trim() || null,
                });
            } else {
                await this._service.updateScheduled(id, {
                    recurrenceType: v.recurrenceType.trim(),
                    firstRunAt: new Date(v.firstRunAt),
                    notes: v.notes.trim() || null,
                });
            }
            this._snackBar.open(
                this._transloco.translate(
                    id === 'new'
                        ? 'scheduledOrders.created'
                        : 'scheduledOrders.saved'
                ),
                undefined,
                { duration: 3000 }
            );
            this.editingId.set(null);
            await this.reload();
        } catch (err) {
            const translate = (key: string): string =>
                this._transloco.translate(key);
            const { handled } = await applyApiErrorToForm(
                this.editForm,
                err,
                translate
            );
            this.actionError.set(
                handled
                    ? translate('errors.api.validation')
                    : await this._describe(
                          err,
                          id === 'new'
                              ? 'scheduledOrders.createError'
                              : 'scheduledOrders.saveError'
                      )
            );
        } finally {
            this.saving.set(false);
        }
    }

    private _describe(err: unknown, fallbackKey: string): Promise<string> {
        return describeApiError(
            err,
            (key) => this._transloco.translate(key),
            fallbackKey
        );
    }

    /** A schedule with a cancellation date no longer produces runs. */
    isCancelled(schedule: ScheduledOrder): boolean {
        return (
            !!schedule.cancelledAt ||
            (schedule.status ?? '').toLowerCase() === 'cancelled'
        );
    }

    /** i18n key for a schedule's recurrence label (falls back to generic title). */
    recurrenceKey(schedule: ScheduledOrder): string {
        const raw = (schedule.recurrenceType ?? '').toUpperCase();
        return isKnownRecurrence(raw)
            ? `scheduledOrders.recurrence.${raw}`
            : 'scheduledOrders.schedule';
    }
}

/** ISO instant → the `yyyy-MM-ddTHH:mm` a `datetime-local` input expects. */
function toLocalInput(value: string | null | undefined): string {
    if (!value) {
        return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const pad = (n: number): string => String(n).padStart(2, '0');
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
}
