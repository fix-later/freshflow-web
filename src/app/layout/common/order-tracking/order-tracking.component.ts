import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { DatePipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    OnDestroy,
    OnInit,
    TemplateRef,
    ViewChild,
    ViewContainerRef,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { OrderTrackingService } from 'app/layout/common/order-tracking/order-tracking.service';
import {
    normalizeOrderStatus,
    orderStatusPillClass,
} from 'app/modules/orders/orders.types';

/** Delay before the hover card closes, so moving the pointer from the
 * trigger into the card itself doesn't dismiss it. */
const CLOSE_DELAY_MS = 150;

/**
 * Header "Theo dõi đơn hàng" widget: hovering the trigger previews the
 * restaurant's latest order in a card; clicking it navigates to the order
 * management area.
 */
@Component({
    selector: 'order-tracking',
    templateUrl: './order-tracking.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatIconModule, RouterLink, TranslocoModule, DatePipe],
})
export class OrderTrackingComponent implements OnInit, OnDestroy {
    @ViewChild('orderTrackingOrigin', { read: ElementRef })
    private _origin: ElementRef<HTMLElement>;
    @ViewChild('orderTrackingPanel') private _panel: TemplateRef<unknown>;

    private readonly _overlay = inject(Overlay);
    private readonly _viewContainerRef = inject(ViewContainerRef);
    private _overlayRef: OverlayRef;
    private _closeTimeoutId: ReturnType<typeof setTimeout> | null = null;

    protected readonly orderTrackingService = inject(OrderTrackingService);
    readonly latestOrder = this.orderTrackingService.latestOrder;
    readonly statusPillClass = orderStatusPillClass;
    readonly statusKey = (status: string): string =>
        `orders.status.${normalizeOrderStatus(status) || 'unknown'}`;

    ngOnInit(): void {
        void this.orderTrackingService.ensureLoaded();
    }

    ngOnDestroy(): void {
        this._cancelScheduledClose();
        this._overlayRef?.dispose();
    }

    onTriggerEnter(): void {
        this._cancelScheduledClose();
        this._openPanel();
    }

    onTriggerLeave(): void {
        this._scheduleClose();
    }

    onPanelEnter(): void {
        this._cancelScheduledClose();
    }

    onPanelLeave(): void {
        this._scheduleClose();
    }

    private _openPanel(): void {
        if (!this._panel || !this._origin) {
            return;
        }
        if (!this._overlayRef) {
            this._createOverlay();
        }
        if (!this._overlayRef.hasAttached()) {
            this._overlayRef.attach(
                new TemplatePortal(this._panel, this._viewContainerRef)
            );
        }
    }

    private _closePanel(): void {
        this._overlayRef?.detach();
    }

    private _scheduleClose(): void {
        this._cancelScheduledClose();
        this._closeTimeoutId = setTimeout(
            () => this._closePanel(),
            CLOSE_DELAY_MS
        );
    }

    private _cancelScheduledClose(): void {
        if (this._closeTimeoutId !== null) {
            clearTimeout(this._closeTimeoutId);
            this._closeTimeoutId = null;
        }
    }

    private _createOverlay(): void {
        this._overlayRef = this._overlay.create({
            hasBackdrop: false,
            scrollStrategy: this._overlay.scrollStrategies.reposition(),
            positionStrategy: this._overlay
                .position()
                .flexibleConnectedTo(this._origin.nativeElement)
                .withLockedPosition(true)
                .withPush(true)
                .withPositions([
                    {
                        originX: 'start',
                        originY: 'bottom',
                        overlayX: 'start',
                        overlayY: 'top',
                    },
                    {
                        originX: 'start',
                        originY: 'top',
                        overlayX: 'start',
                        overlayY: 'bottom',
                    },
                ]),
        });
    }
}
