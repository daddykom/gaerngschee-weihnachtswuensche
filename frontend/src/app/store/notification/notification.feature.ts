import { createFeature, createReducer, on } from '@ngrx/store';
import { NotificationActions } from './notification.actions';
import { initialState } from './notification.state';

const normalizePath = (url: string): string => url.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/';

const isPreservedOnRoute = (url: string, preserveOnRoutes: string[]): boolean => {
  const currentPath = normalizePath(url);

  return preserveOnRoutes.some((route) => {
    const preservedPath = normalizePath(route);
    return currentPath === preservedPath;
  });
};

export const notificationFeature = createFeature({
  name: 'notification',
  reducer: createReducer(
    initialState,
    on(NotificationActions.show, (state, notification) => ({
      current: {
        ...notification,
        params: notification.params ?? {},
        preserveOnRoutes: notification.preserveOnRoutes ?? [],
      },
    })),
    on(NotificationActions.navigationCompleted, (state, { url }) =>
      state.current !== null && !isPreservedOnRoute(url, state.current.preserveOnRoutes)
        ? initialState
        : state,
    ),
    on(NotificationActions.clear, () => initialState),
  ),
});

export const {
  name: notificationFeatureName,
  reducer: notificationReducer,
  selectCurrent: selectNotification,
} = notificationFeature;
