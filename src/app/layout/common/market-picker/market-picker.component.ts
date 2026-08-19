import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    NgZone,
    OnDestroy,
    TemplateRef,
    ViewChild,
    ViewEncapsulation,
    booleanAttribute,
    inject,
    input,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@jsverse/transloco';
import {
    Market,
    MarketSelectionService,
} from 'app/core/market/market-selection.service';
import { whenSplashHidden } from 'app/core/splash/wait-for-splash';
import { CarouselComponent } from 'app/shared/carousel/carousel.component';

/**
 * Header market picker — the storefront's entry decision.
 *
 * Shopping is scoped to one market (see `MarketSelectionService`), so this is
 * the first thing a buyer chooses: the dialog opens by itself on first visit and
 * the catalog stays empty until a market is picked. Afterwards the button shows
 * the active market and reopens the dialog for switching.
 *
 * It replaces the delivery-address ("Địa chỉ nhà hàng") picker that used to sit
 * here — the address belongs to checkout, not to browsing.
 */
@Component({
    selector: 'market-picker',
    templateUrl: './market-picker.component.html',
    styleUrl: './market-picker.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: {
        // `max-w-full` so the trigger can never grow past the slot the header
        // gives it — the label inside truncates instead of being clipped.
        class: 'inline-flex min-w-0 max-w-full items-center',
    },
    imports: [
        CarouselComponent,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        TranslocoModule,
    ],
})
export class MarketPickerComponent implements AfterViewInit, OnDestroy {
    /**
     * `compact` — show the market's own name ("Thủ Đức"), not the framed
     * "Chợ đầu mối Thủ Đức".
     *
     * The phone header fits a logo, this trigger and the menu button into about
     * 360px, and the framing is the half that repeats on every market: it was
     * pushing the name — the half that identifies the chợ — out of the visible
     * box. What the control is for still reads from its tooltip.
     */
    readonly compact = input(false, { transform: booleanAttribute });

    @ViewChild('marketPickerPanel') private _panel: TemplateRef<unknown>;

    private _dialog = inject(MatDialog);
    private _ngZone = inject(NgZone);
    private _marketSelection = inject(MarketSelectionService);
    private _destroyRef = inject(DestroyRef);
    private _dialogRef: MatDialogRef<unknown> | null = null;

    readonly markets = this._marketSelection.markets;
    readonly selected = this._marketSelection.selected;
    readonly loading = this._marketSelection.loading;

    /**
     * How many chợ cards the carousel shows at once. A card stops being
     * readable under about 16rem — the same limit that used to cap the grid's
     * columns — and the dialog is at most 64rem wide, so three is the ceiling.
     * Fractional at the bottom end so the next card peeks: on a phone that peek
     * is the only thing saying the row goes on.
     */
    readonly cardsPerView = signal(3);

    constructor() {
        this._trackPerView();
    }

    ngAfterViewInit(): void {
        void this._marketSelection.ensureLoaded().then(() => {
            if (this._marketSelection.hasSelection()) {
                return;
            }
            // Wait for the splash to clear so the dialog never opens underneath
            // it. `whenSplashHidden` resolves from a MutationObserver outside
            // Angular, hence the explicit zone re-entry.
            void whenSplashHidden().then(() =>
                this._ngZone.run(() => this.openPanel())
            );
        });
    }

    ngOnDestroy(): void {
        this._dialogRef?.close();
    }

    /** Two-letter monogram from the first and last word of the name. */
    initials(name: string): string {
        const parts = name.split(/[_\s]+/).filter(Boolean);
        const first = parts[0]?.charAt(0) ?? '';
        const last = parts.length > 1 ? parts.at(-1)?.charAt(0) ?? '' : '';
        return (first + last).toUpperCase();
    }

    openPanel(): void {
        if (!this._panel || this._dialogRef) {
            return;
        }
        void this._marketSelection.ensureLoaded();
        this._dialogRef = this._dialog.open(this._panel, {
            // Three cards across at `lg`, so the dialog has to be wide enough
            // to hold them without squeezing each below readable width.
            width: '64rem',
            maxWidth: 'calc(100vw - 2rem)',
            // There is no input to land on any more; the first card is what a
            // keyboard user wants under the cursor.
            autoFocus: 'first-tabbable',
        });
        this._dialogRef.afterClosed().subscribe(() => {
            this._dialogRef = null;
        });
    }

    closePanel(): void {
        this._dialogRef?.close();
    }

    select(market: Market): void {
        this._marketSelection.select(market);
        this.closePanel();
    }

    /** Retry after a failed market load. */
    reload(): void {
        void this._marketSelection.reload();
    }

    /**
     * Keeps {@link cardsPerView} in step with the viewport — the dialog is
     * `min(64rem, 100vw - 2rem)` wide, so the viewport is what decides how many
     * 16rem cards fit. Two media queries rather than a resize listener: the
     * browser only wakes us when a threshold is actually crossed.
     */
    private _trackPerView(): void {
        const wide = window.matchMedia?.('(min-width: 1088px)');
        const medium = window.matchMedia?.('(min-width: 680px)');
        if (!wide || !medium) {
            return;
        }
        const apply = (): void =>
            this.cardsPerView.set(wide.matches ? 3 : medium.matches ? 2 : 1.1);
        apply();
        wide.addEventListener('change', apply);
        medium.addEventListener('change', apply);
        this._destroyRef.onDestroy(() => {
            wide.removeEventListener('change', apply);
            medium.removeEventListener('change', apply);
        });
    }
}
