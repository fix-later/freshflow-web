import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    OnInit,
    ViewEncapsulation,
    effect,
    inject,
    signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@jsverse/transloco';
import { FavoritesService } from 'app/layout/common/favorites/favorites.service';

/**
 * Header trigger for the favorites drawer. The drawer panel itself
 * (`<favorites-drawer>`) renders at the layout root; open-state is shared
 * via FavoritesService. Full wishlist page is reached from a button inside
 * the drawer (`/wishlist`).
 */
@Component({
    selector: 'favorites',
    templateUrl: './favorites.component.html',
    styleUrls: ['../header-icon-motion.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    exportAs: 'favorites',
    standalone: true,
    imports: [MatIconModule, MatTooltipModule, TranslocoModule],
})
export class FavoritesComponent implements OnInit {
    private readonly _destroyRef = inject(DestroyRef);
    protected readonly favoritesService = inject(FavoritesService);

    readonly count = this.favoritesService.count;
    readonly popping = signal(false);

    private _baselineReady = false;
    private _prevCount = 0;
    private _popTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        this._destroyRef.onDestroy(() => {
            if (this._popTimer) {
                clearTimeout(this._popTimer);
            }
        });

        effect(() => {
            const loaded = this.favoritesService.loaded();
            const count = this.count();
            if (!loaded) {
                return;
            }
            if (!this._baselineReady) {
                this._baselineReady = true;
                this._prevCount = count;
                return;
            }
            if (count > this._prevCount) {
                this.popping.set(true);
                if (this._popTimer) {
                    clearTimeout(this._popTimer);
                }
                this._popTimer = setTimeout(() => this.popping.set(false), 250);
            }
            this._prevCount = count;
        });
    }

    ngOnInit(): void {
        // Eagerly-rendered header trigger — load once so the badge count and
        // drawer are ready regardless of how the user reaches the catalog.
        void this.favoritesService.ensureLoaded();
    }
}
