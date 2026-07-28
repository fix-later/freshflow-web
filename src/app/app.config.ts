import { provideHttpClient, withXhr } from '@angular/common/http';
import {
    ApplicationConfig,
    inject,
    provideAppInitializer,
} from '@angular/core';
import { LuxonDateAdapter } from '@angular/material-luxon-adapter';
import {
    DateAdapter,
    MAT_DATE_FORMATS,
    MAT_DATE_LOCALE,
} from '@angular/material/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import {
    PreloadAllModules,
    provideRouter,
    withInMemoryScrolling,
    withPreloading,
} from '@angular/router';
import { provideFuse } from '@fuse';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { appRoutes } from 'app/app.routes';
import { provideAuth } from 'app/core/auth/auth.provider';
import { TranslocoMatPaginatorIntl } from 'app/core/i18n/transloco-mat-paginator-intl';
import { provideIcons } from 'app/core/icons/icons.provider';
import { mockApiServices } from 'app/mock-api';
import { firstValueFrom } from 'rxjs';
import { TranslocoHttpLoader } from './core/transloco/transloco.http-loader';

/**
 * Material + Luxon formats — dd/MM/yyyy for dates (VI), HH:mm for times.
 * Time keys are required by MatTimepicker (`display.timeInput`,
 * `display.timeOptionLabel`, `parse.timeInput`).
 */
const VI_DATE_FORMATS = {
    parse: {
        dateInput: 'dd/MM/yyyy',
        timeInput: 'HH:mm',
    },
    display: {
        dateInput: 'dd/MM/yyyy',
        timeInput: 'HH:mm',
        timeOptionLabel: 'HH:mm',
        monthYearLabel: 'MMMM yyyy',
        dateA11yLabel: 'DD',
        monthYearA11yLabel: 'MMMM yyyy',
    },
};

export const appConfig: ApplicationConfig = {
    providers: [
        provideHttpClient(withXhr()),
        provideRouter(
            appRoutes,
            withPreloading(PreloadAllModules),
            withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })
        ),

        // Material Date Adapter (Vietnamese by default)
        { provide: MAT_DATE_LOCALE, useValue: 'vi' },
        {
            provide: DateAdapter,
            useClass: LuxonDateAdapter,
        },
        {
            provide: MAT_DATE_FORMATS,
            useValue: VI_DATE_FORMATS,
        },
        { provide: MatPaginatorIntl, useClass: TranslocoMatPaginatorIntl },

        // Transloco Config
        provideTransloco({
            config: {
                availableLangs: [
                    {
                        id: 'en',
                        label: 'English',
                    },
                    {
                        id: 'vi',
                        label: 'Tiếng Việt',
                    },
                ],
                defaultLang: 'vi',
                fallbackLang: 'vi',
                reRenderOnLangChange: true,
                prodMode: true,
            },
            loader: TranslocoHttpLoader,
        }),
        // Preload the default language before the app starts to prevent empty/jumping content
        provideAppInitializer(() => {
            const translocoService = inject(TranslocoService);
            const dateAdapter = inject(DateAdapter);
            const defaultLang = translocoService.getDefaultLang();
            translocoService.setActiveLang(defaultLang);
            dateAdapter.setLocale(defaultLang);

            return firstValueFrom(translocoService.load(defaultLang));
        }),

        // Fuse
        provideAuth(),
        provideIcons(),
        provideFuse({
            mockApi: {
                delay: 0,
                services: mockApiServices,
            },
            fuse: {
                layout: 'enterprise',
                scheme: 'light',
                screens: {
                    sm: '600px',
                    md: '960px',
                    lg: '1280px',
                    xl: '1440px',
                },
                theme: 'theme-default',
                themes: [
                    {
                        id: 'theme-default',
                        name: 'Default',
                    },
                    {
                        id: 'theme-brand',
                        name: 'Brand',
                    },
                    {
                        id: 'theme-teal',
                        name: 'Teal',
                    },
                    {
                        id: 'theme-rose',
                        name: 'Rose',
                    },
                    {
                        id: 'theme-purple',
                        name: 'Purple',
                    },
                    {
                        id: 'theme-amber',
                        name: 'Amber',
                    },
                ],
            },
        }),
    ],
};
