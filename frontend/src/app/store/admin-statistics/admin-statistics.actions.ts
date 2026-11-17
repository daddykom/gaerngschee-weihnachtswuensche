import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { AdminStatistics } from '../../shared/models/admin-statistics.model';

export const AdminStatisticsActions = createActionGroup({
  source: 'Admin Statistics',
  events: {
    'Page Entered': emptyProps(),
    'Retry Clicked': emptyProps(),
    'Statistics Loaded': props<{ statistics: AdminStatistics }>(),
    'Statistics Load Failed': props<{ errorCode: string }>(),
  },
});
