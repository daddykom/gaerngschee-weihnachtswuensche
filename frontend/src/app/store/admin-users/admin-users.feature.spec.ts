import { AdminUser } from '../../shared/services/admin-users.service';
import { AdminUsersActions } from './admin-users.actions';
import { adminUsersFeature } from './admin-users.feature';
import { initialState } from './admin-users.state';

describe('admin user filters', () => {
  const users: AdminUser[] = (['admin', 'user', 'wunschbesteller', 'wunscherfueller'] as const).map(
    (group) => ({
      id: group,
      email: `${group}@example.com`,
      group,
      required_password_reset: false,
      created_at: null,
      updated_at: null,
    }),
  );

  it('shows all groups with empty filters', () => {
    expect(adminUsersFeature.selectFilteredUsers.projector(users, initialState.filters)).toEqual(
      users,
    );
  });

  it('matches email substrings ignoring case and surrounding whitespace', () => {
    expect(
      adminUsersFeature.selectFilteredUsers.projector(users, {
        email: '  ADMIN@EXAMPLE  ',
        group: '',
      }),
    ).toEqual([users[0]]);
  });

  it.each(['admin', 'user', 'wunschbesteller', 'wunscherfueller'] as const)(
    'filters the %s group',
    (group) => {
      expect(adminUsersFeature.selectFilteredUsers.projector(users, { email: '', group })).toEqual(
        users.filter((user) => user.group === group),
      );
    },
  );

  it('combines both filters and returns no results for a mismatch', () => {
    expect(
      adminUsersFeature.selectFilteredUsers.projector(users, {
        email: '@example.com',
        group: 'wunschbesteller',
      }),
    ).toEqual([users[2]]);
    expect(
      adminUsersFeature.selectFilteredUsers.projector(users, { email: 'admin', group: 'user' }),
    ).toEqual([]);
  });

  it('updates only changed fields immutably and retains filters when the list reloads', () => {
    const state = adminUsersFeature.reducer(
      initialState,
      AdminUsersActions.filtersChanged({ changes: { email: 'example' } }),
    );
    const filtered = adminUsersFeature.reducer(
      state,
      AdminUsersActions.filtersChanged({ changes: { group: 'user' } }),
    );
    expect(filtered.filters).toEqual({ email: 'example', group: 'user' });
    expect(initialState.filters).toEqual({ email: '', group: '' });
    expect(
      adminUsersFeature.reducer(filtered, AdminUsersActions.loadSuccess({ users })).filters,
    ).toEqual(filtered.filters);
  });
});
