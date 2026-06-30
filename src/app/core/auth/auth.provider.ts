import {
    provideHttpClient,
    withInterceptors,
    withXhr,
} from '@angular/common/http';
import {
    ENVIRONMENT_INITIALIZER,
    EnvironmentProviders,
    Provider,
    inject,
} from '@angular/core';
import { authInterceptor } from 'app/core/auth/auth.interceptor';
import { AuthService } from 'app/core/auth/auth.service';
import { LayoutPerRoleService } from 'app/core/auth/layout-per-role.service';

export const provideAuth = (): Array<Provider | EnvironmentProviders> => {
    return [
        provideHttpClient(withXhr(), withInterceptors([authInterceptor])),
        {
            provide: ENVIRONMENT_INITIALIZER,
            useValue: () => {
                inject(AuthService);
                // Eagerly start the role → layout sync effect.
                inject(LayoutPerRoleService);
            },
            multi: true,
        },
    ];
};
