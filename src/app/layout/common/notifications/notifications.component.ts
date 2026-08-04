import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { DatePipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    OnDestroy,
    OnInit,
    TemplateRef,
    ViewChild,
    ViewContainerRef,
    ViewEncapsulation,
    booleanAttribute,
    effect,
    inject,
    input,
    signal,
} from '@angular/core';
import { MatButton, MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { NotificationsService } from 'app/layout/common/notifications/notifications.service';
import { NotificationView } from 'app/layout/common/notifications/notifications.types';

@Component({
    selector: 'notifications',
    templateUrl: './notifications.component.html',
    styleUrls: ['../header-icon-motion.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    exportAs: 'notifications',
    standalone: true,
    imports: [
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        DatePipe,
        TranslocoModule,
    ],
})
export class NotificationsComponent implements OnInit, OnDestroy {
    @ViewChild('notificationsOrigin') private _notificationsOrigin: MatButton;
    @ViewChild('notificationsPanel')
    private _notificationsPanel: TemplateRef<any>;

    private readonly _destroyRef = inject(DestroyRef);
    private readonly _overlay = inject(Overlay);
    private readonly _viewContainerRef = inject(ViewContainerRef);
    protected readonly notificationsService = inject(NotificationsService);
    private readonly _transloco = inject(TranslocoService);

    /** Storefront-only: hover scale + bell nudge on unread increase. */
    readonly microMotion = input(false, { transform: booleanAttribute });

    readonly items = this.notificationsService.items;
    readonly unreadCount = this.notificationsService.unreadCount;
    readonly hasMore = this.notificationsService.hasMore;
    readonly nudging = signal(false);
    /**
     * Localized reason the last notifications call failed. The panel showing
     * "no notifications" after a failed read would be a lie — every rejection
     * the API can answer with (400 bad cursor, 401, offline) says so here.
     */
    readonly loadError = signal<string | null>(null);

    private _overlayRef: OverlayRef;
    private _baselineReady = false;
    private _prevUnread = 0;
    private _nudgeTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        effect(() => {
            const err = this.notificationsService.error();
            if (!err) {
                this.loadError.set(null);
                return;
            }
            void describeApiError(
                err,
                (key) => this._transloco.translate(key),
                'notifications.loadError'
            ).then((message) => this.loadError.set(message));
        });

        this._destroyRef.onDestroy(() => {
            if (this._nudgeTimer) {
                clearTimeout(this._nudgeTimer);
            }
        });

        effect(() => {
            if (!this.microMotion()) {
                return;
            }
            const loaded = this.notificationsService.loaded();
            const unread = this.unreadCount();
            if (!loaded) {
                return;
            }
            if (!this._baselineReady) {
                this._baselineReady = true;
                this._prevUnread = unread;
                return;
            }
            if (unread > this._prevUnread) {
                this.nudging.set(true);
                if (this._nudgeTimer) {
                    clearTimeout(this._nudgeTimer);
                }
                this._nudgeTimer = setTimeout(
                    () => this.nudging.set(false),
                    300
                );
            }
            this._prevUnread = unread;
        });
    }

    ngOnInit(): void {
        // Eagerly-rendered header trigger — load once so the badge count and
        // panel are ready regardless of which page the user lands on.
        void this.notificationsService.ensureLoaded();
    }

    ngOnDestroy(): void {
        this._overlayRef?.dispose();
    }

    openPanel(): void {
        if (!this._notificationsPanel || !this._notificationsOrigin) {
            return;
        }
        if (!this._overlayRef) {
            this._createOverlay();
        }
        this._overlayRef.attach(
            new TemplatePortal(this._notificationsPanel, this._viewContainerRef)
        );
    }

    closePanel(): void {
        this._overlayRef.detach();
    }

    open(notification: NotificationView): void {
        void this.notificationsService.markRead(notification.id);
    }

    /** Retry action on the error state. */
    reload(): void {
        this.loadError.set(null);
        void this.notificationsService.reload();
    }

    loadMore(): void {
        void this.notificationsService.loadMore();
    }

    trackByFn(_: number, item: NotificationView): string {
        return item.id;
    }

    private _createOverlay(): void {
        this._overlayRef = this._overlay.create({
            hasBackdrop: true,
            backdropClass: 'fuse-backdrop-on-mobile',
            scrollStrategy: this._overlay.scrollStrategies.block(),
            positionStrategy: this._overlay
                .position()
                .flexibleConnectedTo(
                    this._notificationsOrigin._elementRef.nativeElement
                )
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
                    {
                        originX: 'end',
                        originY: 'bottom',
                        overlayX: 'end',
                        overlayY: 'top',
                    },
                    {
                        originX: 'end',
                        originY: 'top',
                        overlayX: 'end',
                        overlayY: 'bottom',
                    },
                ]),
        });

        this._overlayRef.backdropClick().subscribe(() => {
            this._overlayRef.detach();
        });
    }
}
