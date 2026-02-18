import { useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}

/**
 * Returns `true` once the component has mounted on the client.
 *
 * Uses `useSyncExternalStore` so we never call `setState` inside an effect
 * for the common "is-client" hydration guard. During SSR the server snapshot
 * returns `false`; on the client the snapshot is `true`.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}
