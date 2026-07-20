import { DOCUMENT } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    OnInit,
    inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { FuseConfig, FuseConfigService } from '@fuse/services/config';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    standalone: true,
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [RouterOutlet],
})
export class AppComponent implements OnInit {
    private readonly _fuseConfigService = inject(FuseConfigService);
    private readonly _document = inject(DOCUMENT);
    private readonly _destroyRef = inject(DestroyRef);

    private _scheme?: string;
    private _transitionTimer?: ReturnType<typeof setTimeout>;

    ngOnInit(): void {
        // Cross-fade the whole page whenever the color scheme (dark / light)
        // changes, from wherever it is toggled.
        this._fuseConfigService.config$
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe((config: FuseConfig) => {
                if (this._scheme && this._scheme !== config.scheme) {
                    this._animateSchemeChange();
                }
                this._scheme = config.scheme;
            });
    }

    /**
     * Enable the theme cross-fade briefly around a scheme change: add the
     * transition class, then remove it once the fade has run.
     */
    private _animateSchemeChange(): void {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        const root = this._document.documentElement;
        root.classList.add('theme-transition');

        clearTimeout(this._transitionTimer);
        this._transitionTimer = setTimeout(
            () => root.classList.remove('theme-transition'),
            400
        );
    }
}
