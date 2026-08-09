import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule } from '@jsverse/transloco';

/** One step of the real operation, keyed to a translation and an icon. */
interface ProcessStep {
    key: string;
    icon: string;
}

/**
 * Section 8: "Freshflow đi chợ thế nào?".
 *
 * The actual operational sequence, not a trust badge row. "Uy tín, chất lượng,
 * nhanh chóng" tells a buyer nothing they cannot read on any competitor's page;
 * naming the five things that physically happen to their order does.
 *
 * The steps mirror the system's real flow: an order is placed, orders are
 * batched for procurement, an agent buys at the market, the hub checks and
 * sorts, a route delivers.
 */
@Component({
    selector: 'freshflow-process',
    templateUrl: './freshflow-process.component.html',
    styleUrls: ['./freshflow-process.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatIconModule, TranslocoModule],
})
export class FreshflowProcessComponent {
    readonly steps: readonly ProcessStep[] = [
        { key: 'order', icon: 'heroicons_outline:clipboard-document-list' },
        { key: 'batch', icon: 'heroicons_outline:squares-plus' },
        { key: 'buy', icon: 'heroicons_outline:shopping-bag' },
        { key: 'hub', icon: 'heroicons_outline:clipboard-document-check' },
        { key: 'deliver', icon: 'heroicons_outline:truck' },
    ];
}
