// Pure logic, no host calls: easy to test.
export type Space = { id: string; name: string; projectIds: string[] }
export type State = { spaces: Space[]; active: string | null; known?: string[] }

export const EMPTY: State = { spaces: [], active: null }

/** A project is visible when "All" is active, when it belongs to the active space, or when it
 *  belongs to no space at all (those are "everywhere", like Zen's Essentials). */
export function isVisible(state: State, projectId: string): boolean {
  if (state.active === null) return true
  const owners = state.spaces.filter((s) => s.projectIds.includes(projectId))
  return owners.length === 0 || owners.some((s) => s.id === state.active)
}

/** Rows to flip so the sidebar matches `state`: the same project can be listed once per host
 *  (this Mac, an SSH server), and each host's copy is hidden on its own. */
export function diff<T extends { id: string; hidden?: boolean }>(
  state: State,
  rows: T[]
): (T & { hidden: boolean })[] {
  return rows
    .map((r) => ({ ...r, hidden: !isVisible(state, r.id), was: !!r.hidden }))
    .filter((r) => r.hidden !== r.was)
    .map(({ was: _was, ...r }) => r as T & { hidden: boolean })
}

/** Next/previous in the ring: All -> space 1 -> ... -> last -> All. */
export function step(state: State, by: 1 | -1): string | null {
  const ring: (string | null)[] = [null, ...state.spaces.map((s) => s.id)]
  const i = ring.indexOf(state.active)
  return ring[(i + by + ring.length) % ring.length]
}

/** Move a project to one space (or to none). A project lives in at most one space. */
export function assign(state: State, projectId: string, spaceId: string | null): State {
  return {
    ...state,
    spaces: state.spaces.map((s) => {
      const rest = s.projectIds.filter((id) => id !== projectId)
      return s.id === spaceId ? { ...s, projectIds: [...rest, projectId] } : { ...s, projectIds: rest }
    })
  }
}

/** Projects Orca has not shown us before. On the first run everything already there stays
 *  "everywhere"; after that, a newly imported project (or a whole imported folder of repos)
 *  lands in the active space instead of leaking into every space. */
export function adopt(state: State, ids: string[]): State {
  if (!state.known) return { ...state, known: ids }
  const fresh = ids.filter((id) => !state.known!.includes(id))
  if (fresh.length === 0) return state
  const next = { ...state, known: [...state.known, ...fresh] }
  const active = state.active
  return active === null ? next : fresh.reduce<State>((st, id) => assign(st, id, active), next)
}
