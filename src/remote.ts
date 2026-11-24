// Projects on paired Orca servers (SSH-deployed) are invisible to the plugin host API, which
// only sees this machine. The `orca` CLI does reach them, so hide/show them through it.
import { execFile } from 'node:child_process'

const BIN = '/Applications/Orca.app/Contents/Resources/bin/orca' // ponytail: macOS install path; falls back to PATH
const run = (args: string[]): Promise<any> =>
  new Promise((resolve, reject) => {
    const go = (bin: string, retry: boolean) =>
      execFile(bin, [...args, '--json'], { timeout: 20_000, maxBuffer: 8e6 }, (err, out) => {
        if (err && retry && err.code === 'ENOENT') return go('orca', false)
        if (err) return reject(err)
        try {
          const r = JSON.parse(out)
          r.ok ? resolve(r.result) : reject(new Error(r.error?.message ?? 'orca failed'))
        } catch (e) {
          reject(e)
        }
      })
    go(BIN, true)
  })

export type RemoteRepo = { id: string; env: string; repo: string; name: string; hidden: boolean }

/** Repos of every paired server that answers. A server that is offline is skipped. */
export async function listRemote(): Promise<RemoteRepo[]> {
  const envs: { id: string; name: string }[] = (await run(['environment', 'list']).catch(() => ({ environments: [] })))
    .environments
  const rows = await Promise.all(
    envs.map(async (e) => {
      try {
        const { repos } = await run(['repo', 'list', '--environment', e.id])
        return (repos as { id: string; displayName: string; hiddenAt?: number | null }[]).map((r) => ({
          id: `${e.id}:${r.id}`,
          env: e.id,
          repo: r.id,
          name: `${r.displayName} (${e.name})`,
          hidden: !!r.hiddenAt
        }))
      } catch {
        return []
      }
    })
  )
  return rows.flat()
}

export const setRemoteHidden = (r: RemoteRepo, hidden: boolean) =>
  run(['repo', hidden ? 'hide' : 'unhide', '--environment', r.env, '--repo', `id:${r.repo}`])
