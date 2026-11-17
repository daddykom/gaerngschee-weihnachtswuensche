import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { AdminStatisticsActions } from './admin-statistics.actions';
import { AdminStatisticsState, initialState } from './admin-statistics.state';

export const adminStatisticsFeature = createFeature({
  name: 'adminStatistics',
  reducer: createReducer<AdminStatisticsState>(
    initialState,
    on(AdminStatisticsActions.pageEntered, AdminStatisticsActions.retryClicked, () => ({
      request: { status: 'loading' },
    })),
    on(AdminStatisticsActions.statisticsLoaded, (_state, { statistics }) => ({
      request: { status: 'loaded', statistics },
    })),
    on(AdminStatisticsActions.statisticsLoadFailed, (_state, { errorCode }) => ({
      request: { status: 'error', errorCode },
    })),
  ),
  extraSelectors: ({ selectRequest }) => ({
    selectStatistics: createSelector(selectRequest, (request) =>
      request.status === 'loaded' ? request.statistics : null,
    ),
  }),
});

export const {
  selectRequest: selectAdminStatisticsRequest,
  selectStatistics: selectAdminStatistics,
} = adminStatisticsFeature;
