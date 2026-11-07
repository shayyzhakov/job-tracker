/**
 * Generic extension points for optional layers. Core renders named slots and mounts registered
 * routes; with nothing registered everything here renders nothing.
 */
import { type ComponentType, Fragment, useSyncExternalStore } from 'react';
import type { RouteObject } from 'react-router';

export type SlotName =
  | 'header.right'
  | 'overview.top'
  | 'applications.views'
  | 'application.detail.top';

export interface SlotProps {
  /** Free-form context passed by the slot host (e.g. the current application's id). */
  [key: string]: unknown;
}

type Entry = { id: string; Component: ComponentType<SlotProps> };

const slots = new Map<SlotName, Entry[]>();
const routes: RouteObject[] = [];
const subscribers = new Set<() => void>();
let version = 0;

const notify = () => {
  version++;
  for (const s of subscribers) s();
};

/** Registers a component into a slot. Re-registering the same id replaces it. Returns an unregister fn. */
export function registerSlot(name: SlotName, id: string, Component: ComponentType<SlotProps>) {
  slots.set(name, [...(slots.get(name) ?? []).filter((e) => e.id !== id), { id, Component }]);
  notify();
  return () => {
    slots.set(
      name,
      (slots.get(name) ?? []).filter((e) => e.id !== id),
    );
    notify();
  };
}

/** Adds a route under the app layout. Must happen before the router is created. */
export function registerRoute(route: RouteObject) {
  routes.push(route);
  return () => {
    const i = routes.indexOf(route);
    if (i >= 0) routes.splice(i, 1);
  };
}

export const getRegisteredRoutes = (): RouteObject[] => [...routes];

const subscribe = (cb: () => void) => {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
};

export function Slot({ name, ...props }: { name: SlotName } & SlotProps) {
  useSyncExternalStore(subscribe, () => version);
  const entries = slots.get(name);
  if (!entries?.length) return null;
  return (
    <>
      {entries.map(({ id, Component }) => (
        <Fragment key={id}>
          <Component {...props} />
        </Fragment>
      ))}
    </>
  );
}
