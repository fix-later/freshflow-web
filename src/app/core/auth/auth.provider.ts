import {
    provideHttpClient,
    withInterceptors,
    withXhr,
} from '@angular/common/http';
import {
    EnvironmentProviders,
    Provider,
    inject,
    provideEnvironmentInitializer,
} from '@angular/core';
import { authInterceptor } from 'app/core/auth/auth.interceptor';
import { AuthService } from 'app/core/auth/auth.service';
import { QuickSignInService } from 'app/layout/common/quick-sign-in/quick-sign-in.service';
import { setSignInPrompt } from 'contract';

export const provideAuth = (): Array<Provider | EnvironmentProviders> => {
    return [
        provideHttpClient(withXhr(), withInterceptors([authInterceptor])),
        provideEnvironmentInitializer(() => {
            inject(AuthService);
            // Guest requests hitting protected APIs open the quick sign-in
            // popup instead of a hard redirect (contract/client.ts).
            const quickSignIn = inject(QuickSignInService);
            setSignInPrompt(() => quickSignIn.open());
        }),
    ];
};
