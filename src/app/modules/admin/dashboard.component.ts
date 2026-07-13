import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
} from '@angular/core';

/** Placeholder admin landing — the console modules land here module by module. */
@Component({
    selector: 'admin-dashboard',
    template: `
        <div class="flex w-full flex-col p-6 md:p-8">
            <h1 class="text-3xl font-bold tracking-tight">Tổng quan</h1>
            <p class="text-secondary mt-2">
                Bảng điều khiển quản trị FreshFlow. Các phân hệ sẽ được bổ sung.
            </p>
        </div>
    `,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
})
export class AdminDashboardComponent {}
