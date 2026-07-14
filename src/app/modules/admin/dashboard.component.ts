import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';

interface DashboardCard {
    icon: string;
    link: string;
    titleKey: string;
    descriptionKey: string;
}

/** Admin landing — quick links into every Admin console module. */
@Component({
    selector: 'admin-dashboard',
    templateUrl: './dashboard.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatIconModule, RouterLink, TranslocoModule],
})
export class AdminDashboardComponent {
    readonly cards: DashboardCard[] = [
        {
            icon: 'heroicons_outline:users',
            link: '/admin/users',
            titleKey: 'admin.dashboard.users.title',
            descriptionKey: 'admin.dashboard.users.description',
        },
        {
            icon: 'heroicons_outline:building-storefront',
            link: '/admin/restaurants',
            titleKey: 'admin.dashboard.restaurants.title',
            descriptionKey: 'admin.dashboard.restaurants.description',
        },
    ];
}
