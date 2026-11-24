// Spaces = named groups of projects. Switching hides the other groups' projects with
// project.setHidden (the same as "Hide Project" in the sidebar). State lives in orca.storage.
import type { SpacesView } from 'orca'
import type { OrcaWorkerApi } from 'orca/worker'
import './protocol'
import { listRemote, setRemoteHidden, type RemoteRepo } from './remote'
import { adopt, assign, diff, EMPTY, step, type State } from './spaces'

const KEY = 'state'
const SLOTS = 8 // status bar items: slot0 = All, slot1..7 = spaces (manifest max is 8)

export default function activate(orca: OrcaWorkerApi): void {
  // One at a time: a switch and a panel refresh must not interleave their setHidden calls.
  let queue: Promise<unknown> = Promise.resolve()
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn)
    queue = run.catch(() => undefined)
    return run
  }

  const load = async (): Promise<State> => {
    const v = (await orca.storage.get(KEY)) as State | null
    return v && Array.isArray(v.spaces) ? v : EMPTY
  }

  const listProjects = async () => (await orca.host.call('project.list', {})).projects

  // Server repos, as the last background sync saw them. The CLI round trips (list ~0.2-0.45 s,
  // hide ~0.2-0.5 s) stay off the switch path; local setHidden takes ~40 ms for 18 projects.
  let remote: RemoteRepo[] = []
  let remoteQueue: Promise<unknown> = Promise.resolve()
  const syncRemote = () => {
    // ponytail: one run per commit, chained; each reads the latest state, so the last one wins.
    remoteQueue = remoteQueue.then(async () => {
      const fresh = await listRemote()
      const changed = fresh.map((r) => r.id + r.name).join() !== remote.map((r) => r.id + r.name).join()
      remote = fresh
      const state = await load()
      // One failing must not break the rest.
      await Promise.all(diff(state, fresh).map((d) => setRemoteHidden(d, d.hidden).catch(() => undefined)))
      // New or renamed server repo: re-commit so it is adopted and listed in the panel.
      if (changed) await commit((s) => s)
    }).catch(() => undefined)
  }

  const bar: string[] = [] // last statusBar.update sent per slot; only changed slots are re-sent
  const view = async (state: State, projects: Awaited<ReturnType<typeof listProjects>>) => {
    // All at once: every setHidden / status update is independent.
    const jobs: Promise<unknown>[] = diff(state, projects).map((d) =>
      orca.host.call('project.setHidden', { projectId: d.id, hostId: d.hostId ?? undefined, hidden: d.hidden })
    )
    // Zen-style switcher: a row of buttons in the status bar, the active one highlighted.
    for (let i = 0; i < SLOTS; i++) {
      const space = i === 0 ? null : state.spaces[i - 1]
      const active = i === 0 ? state.active === null : space?.id === state.active
      const label = i === 0 ? 'All' : (space?.name ?? '')
      const item = {
        id: `slot${i}`,
        visible: i === 0 || !!space,
        // inactive: just the first character (an emoji works); active: the full name
        text: active ? label : (Array.from(label)[0] ?? ''),
        tone: active ? ('accent' as const) : ('neutral' as const),
        tooltip: label
      }
      const key = JSON.stringify(item)
      if (bar[i] !== key) jobs.push(orca.host.call('statusBar.update', item).then(() => (bar[i] = key)))
    }
    await Promise.all(jobs)
    return {
      spaces: state.spaces,
      active: state.active,
      projects: [
        ...new Map(
          [...projects.map((p) => ({ id: p.id, name: p.name })), ...remote.map((r) => ({ id: r.id, name: r.name }))].map(
            (p) => [p.id, p]
          )
        ).values()
      ]
    }
  }

  /** Save, apply to the sidebar, tell open panels. */
  const commit = (change: (s: State) => State): Promise<SpacesView> =>
    serial(async () => {
      const projects = await listProjects()
      const state = adopt(change(await load()), [...new Set([...projects.map((p) => p.id), ...remote.map((r) => r.id)])])
      await orca.storage.set(KEY, state)
      const v = await view(state, projects)
      orca.panels.post('spaces.changed', v)
      syncRemote()
      return v
    })

  orca.panels.handle('spaces.get', () => commit((s) => s))
  orca.panels.handle('spaces.switch', ({ id }) => commit((s) => ({ ...s, active: id })))
  orca.panels.handle('spaces.create', ({ name }) =>
    commit((s) => {
      const id = Math.random().toString(36).slice(2, 8)
      return { spaces: [...s.spaces, { id, name: name.trim() || 'Space', projectIds: [] }], active: id }
    })
  )
  orca.panels.handle('spaces.rename', ({ id, name }) =>
    commit((s) => ({
      ...s,
      spaces: s.spaces.map((x) => (x.id === id ? { ...x, name: name.trim() || x.name } : x))
    }))
  )
  orca.panels.handle('spaces.delete', ({ id }) =>
    commit((s) => ({
      spaces: s.spaces.filter((x) => x.id !== id),
      active: s.active === id ? null : s.active
    }))
  )
  orca.panels.handle('spaces.assign', ({ projectId, spaceId }) =>
    commit((s) => assign(s, projectId, spaceId))
  )

  // Palette commands / shortcuts. A string result is shown in Orca as feedback.
  const goto = (pick: (s: State) => string | null) => async () => {
    const v = await commit((s) => ({ ...s, active: pick(s) }))
    return `Space: ${v.spaces.find((s) => s.id === v.active)?.name ?? 'All'}`
  }
  orca.commands.register('spaces.next', goto((s) => step(s, 1)))
  orca.commands.register('spaces.prev', goto((s) => step(s, -1)))
  orca.commands.register('spaces.all', goto(() => null))
  for (let n = 1; n <= 9; n++) {
    orca.commands.register(`spaces.go${n}`, goto((s) => s.spaces[n - 1]?.id ?? s.active))
  }

  // Orca has no "project added" event: poll cheaply and adopt new projects into the active space.
  setInterval(async () => {
    try {
      const known = (await load()).known
      if ((await listProjects()).some((p) => !known?.includes(p.id))) await commit((s) => s)
    } catch {
      // Orca busy or closing; the next tick tries again.
    }
  }, 20_000)

  // Re-apply on start so the sidebar matches the saved space after a restart.
  void commit((s) => s)
}
