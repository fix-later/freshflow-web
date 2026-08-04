import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
} from '@angular/core';
import { AccountShellComponent } from 'app/modules/restaurant/account-shell/account-shell.component';
import { OrdersListComponent } from './orders-list.component';

/**
 * `/orders` — the restaurant's own order history, one of the three routes
 * wrapped in `account-shell` (with `/profile`, `/settings`).
 */
@Component({
    selector: 'orders-history-page',
    templateUrl: './orders-history-page.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex w-full min-w-0 flex-auto flex-col' },
    imports: [AccountShellComponent, OrdersListComponent],
})
export class OrdersHistoryPageComponent {}
