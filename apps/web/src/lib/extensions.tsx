/**
 * Generic extension points for optional layers. Core renders named slots and mounts registered
 * routes; with nothing registered everything here renders nothing.
 */
import { type ComponentType, Fragment, useSyncExternalStore } from 'react';
import type { RouteObject } from 'react-router';

export type SlotName = 'header.right' | 'overview.top' | 'application.detail.top';

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

/** An extra way of looking at all applications, shown next to Table and Timeline in the view switch. */
export interface ApplicationView {
  id: string;
  label: string;
  path: string;
  /** Hook deciding whether the view is offered right now (e.g. a user setting). Always shown when omitted. */
  useVisible?: () => boolean;
}

const views: ApplicationView[] = [];

/** Adds a view to the applications view switch. Must happen before the first render (see main.tsx). */
export function registerApplicationView(view: ApplicationView) {
  views.push(view);
  return () => {
    const i = views.indexOf(view);
    if (i >= 0) views.splice(i, 1);
  };
}

/** The registered views that are currently visible. */
export function useApplicationViews(): ApplicationView[] {
  // The registry is filled once at start-up, so the number of hooks called here is stable.
  return views.filter((v) =>
    // biome-ignore lint/correctness/useHookAtTopLevel: fixed-length registry, see above
    v.useVisible ? v.useVisible() : true,
  );
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
