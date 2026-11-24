// The worker is plain Node, but the plugin ships no @types/node: declare only what remote.ts uses.
declare module 'node:child_process' {
  export function execFile(
    file: string,
    args: string[],
    options: { timeout?: number; maxBuffer?: number },
    callback: (error: (Error & { code?: string }) | null, stdout: string) => void
  ): unknown
}
