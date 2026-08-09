import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    output,
    ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule } from '@jsverse/transloco';
import { activeLang } from 'app/core/i18n/active-lang';
import { BusinessKind } from '../storefront-landing.types';
import { StorefrontStubService } from '../storefront-stub.service';

/**
 * Section 6: "Mai bán gì?".
 *
 * The buyer names what their kitchen sells, and the page answers with the
 * basket for it. Emits upward to the shell rather than reaching into section 5,
 * so either section can be removed without breaking the other.
 *
 * Every value here is stub data (see `StorefrontStubService`), including the
 * ingredient counts, which are properties of the placeholder rather than
 * measurements of anything.
 */
@Component({
    selector: 'tomorrow-menu',
    templateUrl: './tomorrow-menu.component.html',
    styleUrls: ['./tomorrow-menu.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatIconModule, TranslocoModule],
})
export class TomorrowMenuComponent {
    private _stub = inject(StorefrontStubService);

    private readonly _lang = activeLang();
    readonly isVi = computed(() => this._lang() === 'vi');

    readonly kinds = this._stub.businessKinds();

    readonly kindSelected = output<string>();

    kindLabel(kind: BusinessKind): string {
        return this.isVi() ? kind.name : kind.nameEn;
    }
}
