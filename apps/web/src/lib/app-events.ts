/**
 * Tiny, feature-agnostic domain event bus. Core mutations announce what happened after it
 * succeeded; optional layers subscribe. Core never depends on subscribers.
 */
export type AppEvent =
  | { type: 'application.created'; applicationId: string }
  | { type: 'application.deleted'; applicationId: string }
  | { type: 'status.changed'; applicationId: string; status: string }
  | { type: 'interview.created'; applicationId: string }
  | { type: 'contact.created'; applicationId: string };

type Listener = (event: AppEvent) => void;
const listeners = new Set<Listener>();

export function emitAppEvent(event: AppEvent): void {
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch (err) {
      // A faulty subscriber must never break the mutation that triggered it.
      console.error('app event listener failed', err);
    }
  }
}

/** Subscribe; returns the unsubscribe function. */
export function onAppEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
