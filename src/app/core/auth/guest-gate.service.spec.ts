import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { QuickSignInService } from 'app/layout/common/quick-sign-in/quick-sign-in.service';
import { GuestGateService } from './guest-gate.service';

/**
 * The gate decides whether an account-bound control acts or invites the visitor
 * to sign in. What matters is that a guest is never left with a control that
 * appears to do nothing, and that a signed-in user is never interrupted.
 */
describe('GuestGateService', () => {
    let gate: GuestGateService;
    let signedIn: ReturnType<typeof signal<boolean>>;
    let quickSignIn: jasmine.SpyObj<QuickSignInService>;
    let router: jasmine.SpyObj<Router>;

    beforeEach(() => {
        signedIn = signal(false);
        quickSignIn = jasmine.createSpyObj<QuickSignInService>(
            'QuickSignInService',
            ['open']
        );
        router = jasmine.createSpyObj<Router>('Router', ['navigate']);
        // `url` is a getter on the real Router; a plain property is enough here.
        Object.defineProperty(router, 'url', { value: '/catalog?featured=1' });

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [
                GuestGateService,
                {
                    provide: PermissionsService,
                    useValue: { isSignedIn: signedIn },
                },
                { provide: QuickSignInService, useValue: quickSignIn },
                { provide: Router, useValue: router },
            ],
        });
        gate = TestBed.inject(GuestGateService);
    });

    it('lets a signed-in user through without prompting', () => {
        signedIn.set(true);

        expect(gate.requireAccount()).toBe(true);
        expect(quickSignIn.open).not.toHaveBeenCalled();
        expect(router.navigate).not.toHaveBeenCalled();
    });

    it('stops a guest and opens the quick sign-in popup', () => {
        quickSignIn.open.and.returnValue(true);

        expect(gate.requireAccount()).toBe(false);
        expect(quickSignIn.open).toHaveBeenCalled();
        expect(router.navigate).not.toHaveBeenCalled();
    });

    it('falls back to the sign-in page, keeping the current URL, when no popup is mounted', () => {
        quickSignIn.open.and.returnValue(false);

        expect(gate.requireAccount()).toBe(false);
        expect(router.navigate).toHaveBeenCalledWith(['/sign-in'], {
            queryParams: { redirectURL: '/catalog?featured=1' },
        });
    });

    it('tracks the signed-in state rather than caching the first answer', () => {
        expect(gate.isSignedIn()).toBe(false);

        signedIn.set(true);

        expect(gate.isSignedIn()).toBe(true);
    });
});
