import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * Generic storefront placeholder page. Title/description come from route
 * `data` (see app.routes.ts), so one component serves every stub page
 * until the real content lands.
 */
@Component({
    selector: 'placeholder-page',
    template: `
        <div class="ff-page flex flex-col">
            <h1 class="text-3xl font-bold tracking-tight">{{ title }}</h1>
            <p class="text-secondary mt-2">{{ description }}</p>
        </div>
    `,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
})
export class PlaceholderPageComponent {
    private _route = inject(ActivatedRoute);

    readonly title: string = this._route.snapshot.data['title'] ?? '';
    readonly description: string =
        this._route.snapshot.data['description'] ??
        'Nội dung đang được cập nhật.';
}
