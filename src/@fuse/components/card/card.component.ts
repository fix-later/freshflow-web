import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';

import {
    Component,
    HostBinding,
    Input,
    OnChanges,
    SimpleChanges,
    ViewEncapsulation,
} from '@angular/core';
import { collapseOnLeave, expandOnEnter } from '@fuse/animations';
import { FuseCardFace } from '@fuse/components/card/card.types';

@Component({
    selector: 'fuse-card',
    templateUrl: './card.component.html',
    styleUrls: ['./card.component.scss'],
    encapsulation: ViewEncapsulation.None,
    exportAs: 'fuseCard',
    standalone: true,
    imports: [],
})
export class FuseCardComponent implements OnChanges {
    /* eslint-disable @typescript-eslint/naming-convention */
    static ngAcceptInputType_expanded: BooleanInput;
    static ngAcceptInputType_flippable: BooleanInput;
    static ngAcceptInputType_flat: BooleanInput;
    /* eslint-enable @typescript-eslint/naming-convention */

    @Input() expanded: boolean = false;
    @Input() face: FuseCardFace = 'front';
    @Input() flippable: boolean = false;

    /**
     * Storefront tile mode: drop the surface (no card background, radius or
     * shadow) so the card reads as a flat tile on the page — the product-grid
     * pattern in `specs/references`. Elevation still honours
     * `specs/design/TOKENS.md` (0–2, borders over shadow).
     */
    @Input() flat: boolean = false;

    // Expand/collapse animation handlers for the template
    protected readonly expandOnEnter = expandOnEnter;
    protected readonly collapseOnLeave = collapseOnLeave;

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Host binding for component classes
     */
    @HostBinding('class') get classList(): any {
        /* eslint-disable @typescript-eslint/naming-convention */
        return {
            'fuse-card-expanded': this.expanded,
            'fuse-card-face-back': this.flippable && this.face === 'back',
            'fuse-card-face-front': this.flippable && this.face === 'front',
            'fuse-card-flippable': this.flippable,
            'fuse-card-flat': this.flat,
        };
        /* eslint-enable @typescript-eslint/naming-convention */
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On changes
     *
     * @param changes
     */
    ngOnChanges(changes: SimpleChanges): void {
        // Expanded
        if ('expanded' in changes) {
            // Coerce the value to a boolean
            this.expanded = coerceBooleanProperty(
                changes.expanded.currentValue
            );
        }

        // Flippable
        if ('flippable' in changes) {
            // Coerce the value to a boolean
            this.flippable = coerceBooleanProperty(
                changes.flippable.currentValue
            );
        }

        // Flat
        if ('flat' in changes) {
            // Coerce the value to a boolean
            this.flat = coerceBooleanProperty(changes.flat.currentValue);
        }
    }
}
