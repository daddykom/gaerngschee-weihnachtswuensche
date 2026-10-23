import { EventActions } from './events.actions';
import { eventsFeature } from './events.feature';
import { initialState } from './events.state';

describe('eventsFeature', () => {
  it('stores the highest value received for an event', () => {
    const afterFirst = eventsFeature.reducer(
      initialState,
      EventActions.received({ key: 'order-status-change', value: 4 }),
    );
    const afterOlder = eventsFeature.reducer(
      afterFirst,
      EventActions.received({ key: 'order-status-change', value: 2 }),
    );

    expect(afterOlder.values).toEqual({ 'order-status-change': 4 });
  });
});
