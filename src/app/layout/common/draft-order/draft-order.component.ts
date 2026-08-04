import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@jsverse/transloco';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';

/**
 * Header trigger for the draft-order drawer. The drawer panel itself
 * (`<draft-order-drawer>`) renders at the layout root, decoupled from the
 * header so the header's pin/slide animation can't reposition it; both share
 * open-state through DraftOrderService.
 */
@Component({
    selector: 'draft-order',
    templateUrl: './draft-order.component.html',
    styleUrls: ['../header-icon-motion.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    exportAs: 'draftOrder',
    standalone: true,
    imports: [MatIconModule, MatTooltipModule, TranslocoModule],
})
export class DraftOrderComponent {
    protected readonly draftOrderService = inject(DraftOrderService);
    readonly count = this.draftOrderService.totalQuantity;
}
