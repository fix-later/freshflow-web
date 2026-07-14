import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './dashboard.component';
import { RestaurantsAdminComponent } from './restaurants/restaurants-admin.component';
import { UserDetailComponent } from './users/user-detail.component';
import { UsersListComponent } from './users/users-list.component';

export default [
    {
        path: '',
        component: AdminDashboardComponent,
    },
    {
        path: 'users',
        component: UsersListComponent,
    },
    {
        path: 'users/:userId',
        component: UserDetailComponent,
    },
    {
        path: 'restaurants',
        component: RestaurantsAdminComponent,
    },
] as Routes;
