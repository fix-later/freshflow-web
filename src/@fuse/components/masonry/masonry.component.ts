import { NgTemplateOutlet } from '@angular/common';
import {
    AfterViewInit,
    Component,
    Input,
    OnChanges,
    SimpleChanges,
    TemplateRef,
    ViewEncapsulation,
} from '@angular/core';

@Component({
    selector: 'fuse-masonry',
    templateUrl: './masonry.component.html',
    encapsulation: ViewEncapsulation.None,
    exportAs: 'fuseMasonry',
    standalone: true,
    imports: [NgTemplateOutlet],
    styles: [
        `
            /*
             * Equal-width columns that keep their natural height, so tiles of
             * different heights flow without leaving holes under the short ones
             * (a wrapping flex row would align them into ragged rows instead).
             */
            .fuse-masonry-columns {
                display: grid;
                align-items: start;
            }

            /* Each column stacks its items with the same gap as the grid. */
            .fuse-masonry-columns > * {
                display: flex;
                flex-direction: column;
                gap: inherit;
                min-width: 0;
            }
        `,
    ],
})
export class FuseMasonryComponent implements OnChanges, AfterViewInit {
    @Input() columnsTemplate: TemplateRef<any>;
    @Input() columns: number = 1;
    @Input() items: any[] = [];

    /** Any CSS gap value — applies between columns and between items. */
    @Input() gap: string = '1.5rem';

    distributedColumns: any[] = [];

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On changes
     *
     * @param changes
     */
    ngOnChanges(changes: SimpleChanges): void {
        // Columns
        if ('columns' in changes) {
            // Distribute the items
            this._distributeItems();
        }

        // Items
        if ('items' in changes) {
            // Distribute the items
            this._distributeItems();
        }
    }

    /**
     * After view init
     */
    ngAfterViewInit(): void {
        // Distribute the items for the first time
        this._distributeItems();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Distribute items into columns
     */
    private _distributeItems(): void {
        // A column count is required to distribute into — guard against 0/NaN
        // from an unresolved responsive binding, which would divide by zero.
        const columns = Math.max(1, Math.floor(this.columns) || 1);

        // Return an empty array if there are no items
        if (this.items.length === 0) {
            this.distributedColumns = [];
            return;
        }

        // Prepare the distributed columns array
        this.distributedColumns = Array.from(Array(columns), () => ({
            items: [],
        }));

        // Distribute the items to columns
        for (let i = 0; i < this.items.length; i++) {
            this.distributedColumns[i % columns].items.push(this.items[i]);
        }
    }
}
