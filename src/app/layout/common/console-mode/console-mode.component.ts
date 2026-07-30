import {
    ChangeDetectionStrategy,
    Component,
    inject,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import {
    ConsoleMode,
    ConsoleModeService,
} from 'app/core/navigation/console-mode.service';
import { NavigationService } from 'app/core/navigation/navigation.service';

/**
 * Admin-console job switch (Vận hành ↔ Quản trị).
 *
 * The single `admin` account covers both jobs, so instead of one nav holding
 * every section, the switch shows the sections for the job at hand. Switching
 * returns to the dashboard — the previous screen may not belong to the new job.
 */
@Component({
    selector: 'console-mode',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatButtonToggleModule,
        MatIconModule,
        MatTooltipModule,
        TranslocoModule,
    ],
    template: `
        <ng-container *transloco="let t">
            <mat-button-toggle-group
                class="console-mode-group"
                [hideSingleSelectionIndicator]="true"
                [value]="mode()"
                [attr.aria-label]="t('console.mode.label')"
            >
                <mat-button-toggle
                    [value]="'operations'"
                    [matTooltip]="t('console.mode.operationsHint')"
                    (click)="select('operations')"
                >
                    <mat-icon
                        class="icon-size-5"
                        [svgIcon]="'heroicons_outline:truck'"
                    ></mat-icon>
                    <span class="ml-2 hidden sm:inline">{{
                        t('console.mode.operations')
                    }}</span>
                </mat-button-toggle>
                <mat-button-toggle
                    [value]="'administration'"
                    [matTooltip]="t('console.mode.administrationHint')"
                    (click)="select('administration')"
                >
                    <mat-icon
                        class="icon-size-5"
                        [svgIcon]="'heroicons_outline:wrench-screwdriver'"
                    ></mat-icon>
                    <span class="ml-2 hidden sm:inline">{{
                        t('console.mode.administration')
                    }}</span>
                </mat-button-toggle>
            </mat-button-toggle-group>
        </ng-container>
    `,
    styles: [
        `
            .console-mode-group {
                border-radius: 9999px;
                height: 2.25rem;

                .mat-button-toggle-label-content {
                    display: flex;
                    align-items: center;
                    line-height: 2.25rem;
                    padding: 0 0.75rem;
                }
            }
        `,
    ],
})
export class ConsoleModeComponent {
    private _consoleMode = inject(ConsoleModeService);
    private _navigationService = inject(NavigationService);
    private _router = inject(Router);

    readonly mode = this._consoleMode.mode;

    /** Switch jobs: swap the nav, then land on the console dashboard. */
    select(mode: ConsoleMode): void {
        if (mode === this.mode()) {
            return;
        }

        this._consoleMode.set(mode);
        this._navigationService.get().subscribe();
        void this._router.navigate(['/admin']);
    }
}
