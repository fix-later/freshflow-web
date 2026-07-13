import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
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
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    exportAs: 'favorites',
    standalone: true,
    imports: [MatIconModule, MatTooltipModule, TranslocoModule],
})
export class FavoritesComponent {
    protected readonly favoritesService = inject(FavoritesService);
    readonly count = this.favoritesService.count;
}
