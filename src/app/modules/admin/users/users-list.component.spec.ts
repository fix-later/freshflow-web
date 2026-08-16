import { AdminUserRow } from '../admin.types';
import { filterStaffTabUsers } from './users-list.component';

const row = (id: string, places: string[], isActive = true): AdminUserRow => ({
    id,
    email: `${id}@freshflow.vn`,
    phone: `090-${id}`,
    role: 'driver',
    places,
    placeLabel: places.length ? places.join(', ') : 'Chưa phân công',
    isActive,
});

const users = [
    row('driver-1', ['Hub Thủ Đức']),
    row('driver-2', []),
    row('driver-3', ['Hub Bình Điền'], false),
];

const filters = {
    search: '',
    isActive: '',
    place: '',
    assignment: '',
};

describe('Admin users staff-tab filters', () => {
    it('filters by the hub or market shown in Đang thuộc', () => {
        expect(
            filterStaffTabUsers(users, {
                ...filters,
                place: 'Hub Thủ Đức',
            }).map((user) => user.id)
        ).toEqual(['driver-1']);
    });

    it('separates assigned and unassigned users', () => {
        expect(
            filterStaffTabUsers(users, {
                ...filters,
                assignment: 'unassigned',
            }).map((user) => user.id)
        ).toEqual(['driver-2']);
        expect(
            filterStaffTabUsers(users, {
                ...filters,
                assignment: 'assigned',
            }).map((user) => user.id)
        ).toEqual(['driver-1', 'driver-3']);
    });

    it('searches assignment names and combines with account status', () => {
        expect(
            filterStaffTabUsers(users, {
                ...filters,
                search: 'bình điền',
                isActive: 'false',
            }).map((user) => user.id)
        ).toEqual(['driver-3']);
    });
});
