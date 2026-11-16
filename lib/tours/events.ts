/**
 * Tiny app event bus for tour steps with `advanceOn: { event }`. Components emit domain events
 * (`tourEvents.emit('queue.added')`), the tour engine listens while such a step is shown.
 */
/** Emitted in lib/network/cocktailTracking.ts. */
export const TOUR_EVENTS = ['queue.added', 'statistic.added'] as const;

export type TourEventName = (typeof TOUR_EVENTS)[number];

type Listener = () => void;

const listeners = new Map<TourEventName, Set<Listener>>();

export const tourEvents = {
  emit(name: TourEventName) {
    listeners.get(name)?.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('tourEvents -> listener failed', name, error);
      }
    });
  },
  /** Returns an unsubscribe function. */
  on(name: TourEventName, listener: Listener): () => void {
    const set = listeners.get(name) ?? new Set<Listener>();
    set.add(listener);
    listeners.set(name, set);
    return () => {
      set.delete(listener);
    };
  },
};
