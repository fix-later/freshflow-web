import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { BusinessProfileFormComponent } from './business-profile/business-profile-form.component';

/**
 * Restaurant self-service profile area (route `/profile`, M2). Hosts the
 * business-profile editor; the delivery-addresses section is added in US2.
 */
@Component({
    selector: 'restaurant-profile',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.scss'],
    imports: [TranslocoModule, BusinessProfileFormComponent],
})
export class ProfileComponent {}
