import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * Returns false during server rendering and hydration, then true on the
 * client. Use it to skip rendering client-only UI without a setState-in-effect.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
