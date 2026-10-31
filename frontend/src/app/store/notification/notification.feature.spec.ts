import { NotificationActions } from './notification.actions';
import { notificationReducer } from './notification.feature';
import { initialState } from './notification.state';

describe('notificationReducer', () => {
  const notification = {
    variant: 'info' as const,
    titleKey: 'app.test.title',
    messageKey: 'app.test.message',
  };

  it('preserves a notification on the explicitly configured exact route', () => {
    const state = notificationReducer(
      initialState,
      NotificationActions.show({ ...notification, preserveOnRoutes: ['/bestellung'] }),
    );

    const result = notificationReducer(
      state,
      NotificationActions.navigationCompleted({ url: '/bestellung?year=2026' }),
    );

    expect(result.current).not.toBeNull();
    expect(result.current?.messageKey).toBe('app.test.message');
  });

  it('clears a notification when navigation leaves the configured route', () => {
    const state = notificationReducer(
      initialState,
      NotificationActions.show({ ...notification, preserveOnRoutes: ['/bestellung'] }),
    );

    const result = notificationReducer(
      state,
      NotificationActions.navigationCompleted({ url: '/login' }),
    );

    expect(result).toEqual(initialState);
  });

  it('does not preserve a parent-route notification on an unlisted child route', () => {
    const state = notificationReducer(
      initialState,
      NotificationActions.show({ ...notification, preserveOnRoutes: ['/bestellung'] }),
    );

    const result = notificationReducer(
      state,
      NotificationActions.navigationCompleted({ url: '/bestellung/wunsch/neu' }),
    );

    expect(result).toEqual(initialState);
  });

  it('preserves a notification when the child route is explicitly configured', () => {
    const state = notificationReducer(
      initialState,
      NotificationActions.show({ ...notification, preserveOnRoutes: ['/bestellung/wunsch/neu'] }),
    );

    const result = notificationReducer(
      state,
      NotificationActions.navigationCompleted({ url: '/bestellung/wunsch/neu' }),
    );

    expect(result.current).not.toBeNull();
  });
});
