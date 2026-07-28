import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
} from '@angular/core';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { CategoriesComponent } from './categories.component';

/** Admin ▸ Catalog ▸ Categories ▸ New — full-page create form. */
@Component({
    selector: 'admin-categories-create',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
        pageMode="create"
    ></admin-resource-crud>`,
})
export class CategoriesCreateComponent extends CategoriesComponent {}
