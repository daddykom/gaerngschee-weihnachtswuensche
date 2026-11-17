import { AdminStatisticsActions } from './admin-statistics.actions';
import { adminStatisticsFeature, selectAdminStatistics } from './admin-statistics.feature';

describe('admin statistics state', () => {
  const statistics = {
    year: 2026,
    orderCount: 2,
    wishCount: 5,
    availableCount: 1,
    pendingConfirmationCount: 1,
    reservedCount: 1,
    receivedCount: 1,
    completedCount: 1,
  };

  it('transitions through explicit request states and discards stale counts on reload', () => {
    const reducer = adminStatisticsFeature.reducer;
    expect(reducer(undefined, { type: 'unknown' })).toEqual({ request: { status: 'initial' } });
    const loading = reducer(undefined, AdminStatisticsActions.pageEntered());
    expect(loading).toEqual({ request: { status: 'loading' } });
    const loaded = reducer(loading, AdminStatisticsActions.statisticsLoaded({ statistics }));
    expect(selectAdminStatistics.projector(loaded.request)).toEqual(statistics);
    const retry = reducer(loaded, AdminStatisticsActions.retryClicked());
    expect(selectAdminStatistics.projector(retry.request)).toBeNull();
    const error = reducer(
      retry,
      AdminStatisticsActions.statisticsLoadFailed({ errorCode: 'FAILED' }),
    );
    expect(error).toEqual({ request: { status: 'error', errorCode: 'FAILED' } });
    expect(selectAdminStatistics.projector(error.request)).toBeNull();
    expect(loaded.request).toEqual({ status: 'loaded', statistics });
  });
});
