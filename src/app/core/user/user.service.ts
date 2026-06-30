import { Injectable } from '@angular/core';
import { profileApi } from 'api';
import { User, UserRole } from 'app/core/user/user.types';
import { from, Observable, ReplaySubject, tap } from 'rxjs';

/** Shape of `GET /api/v1/profile/me` (`data`); responses are untyped in the spec. */
interface ProfileMeData {
    id: string;
    email: string;
    role: UserRole;
    fullName?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
}

function unwrap<T>(body: unknown): T | undefined {
    if (body && typeof body === 'object' && 'data' in body) {
        return (body as { data?: T }).data;
    }
    return body as T;
}

/** Maps the backend profile payload to the app `User` model. */
function toUser(data: ProfileMeData): User {
    return {
        id: data.id,
        email: data.email,
        role: data.role,
        fullName: data.fullName ?? null,
        phone: data.phone ?? null,
        avatarUrl: data.avatarUrl ?? null,
        name: data.fullName || data.email,
        avatar: data.avatarUrl ?? undefined,
    };
}

@Injectable({ providedIn: 'root' })
export class UserService {
    private _user: ReplaySubject<User> = new ReplaySubject<User>(1);
    private _current: User | null = null;

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    set user(value: User) {
        this._current = value;
        this._user.next(value);
    }

    get user$(): Observable<User> {
        return this._user.asObservable();
    }

    /** Last known user snapshot (synchronous), or `null` when signed out. */
    get current(): User | null {
        return this._current;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /** Merge a partial update into the current user (e.g. approval status). */
    patch(partial: Partial<User>): void {
        if (this._current) {
            this.user = { ...this._current, ...partial };
        }
    }

    /** Get the current signed-in user from the backend (`GET /profile/me`). */
    get(): Observable<User> {
        return from(this._get()).pipe(tap((u) => (this.user = u)));
    }

    private async _get(): Promise<User> {
        const res = await profileApi.apiV1ProfileMeGetRaw();
        const data = unwrap<ProfileMeData>(await res.raw.json());
        if (!data) {
            throw new Error('Failed to load profile');
        }
        return toUser(data);
    }

    /** Update the signed-in user's profile (`PUT /profile/me`). */
    update(user: User): Observable<User> {
        return from(this._update(user)).pipe(tap((u) => (this.user = u)));
    }

    private async _update(user: User): Promise<User> {
        await profileApi.apiV1ProfileMePut({
            updateMyProfileRequest: {
                fullName: user.fullName ?? user.name ?? null,
                phone: user.phone ?? null,
                avatarUrl: user.avatarUrl ?? null,
            },
        });
        const merged = { ...(this._current ?? user), ...user };
        return merged;
    }
}
