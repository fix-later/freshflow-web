import { DatePipe, DecimalPipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { apiErrorMessage } from 'app/core/api/envelope';
import { RestaurantScheduledOrdersService } from './scheduled-orders.service';
import {
    ScheduledOrder,
    ScheduledOrderInstance,
} from './scheduled-orders.types';

/**
 * Recurring orders — list, inspect the runs a schedule has produced, and stop
 * future runs.
 *
 * Creating a schedule is not offered here; see the note on
 * `RestaurantScheduledOrdersService` for why the backend contract is not yet
 * clear enough to build that form against.
 */
@Component({
    selector: 'scheduled-orders',
    templateUrl: './scheduled-orders.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        DatePipe,
        DecimalPipe,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatSlideToggleModule,
        MatSnackBarModule,
        MatTooltipModule,
        TranslocoModule,
    ],
})
export class ScheduledOrdersComponent implements OnInit {
    private readonly _service = inject(RestaurantScheduledOrdersService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

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
        try {
            const { items } = await this._service.listScheduled(
                1,
                this.includeCancelled()
            );
            this.schedules.set(items);
        } catch {
            this.schedules.set([]);
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
        } catch {
            this.instances.set([]);
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
            const message = await apiErrorMessage(error);
            this._snackBar.open(
                message ??
                    this._transloco.translate('scheduledOrders.cancelError'),
                undefined,
                { duration: 5000 }
            );
        }
    }

    /** A schedule with a cancellation date no longer produces runs. */
    isCancelled(schedule: ScheduledOrder): boolean {
        return (
            !!schedule.cancelledAt ||
            (schedule.status ?? '').toLowerCase() === 'cancelled'
        );
    }
}
