import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
} from '@angular/core';

@Component({
    selector: 'example',
    standalone: true,
    templateUrl: './example.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    encapsulation: ViewEncapsulation.None,
})
export class ExampleComponent {
    /**
     * Constructor
     */
    constructor() {}
}
