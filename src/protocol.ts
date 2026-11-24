// Panel <-> worker contract. Shared by src/panel.tsx and src/worker.ts.
export {}

declare module 'orca' {
  interface PluginRequests {
    /** Current spaces plus every project (re-applies visibility, so new projects get picked up). */
    'spaces.get': { output: SpacesView }
    /** Switch to a space; null = "All" (nothing hidden). */
    'spaces.switch': { input: { id: string | null }; output: SpacesView }
    'spaces.create': { input: { name: string }; output: SpacesView }
    'spaces.rename': { input: { id: string; name: string }; output: SpacesView }
    'spaces.delete': { input: { id: string }; output: SpacesView }
    /** Put a project in a space; null = everywhere (like Zen's Essentials). */
    'spaces.assign': { input: { projectId: string; spaceId: string | null }; output: SpacesView }
  }
  interface PluginPanelEvents {
    'spaces.changed': SpacesView
  }
  interface SpacesView {
    spaces: { id: string; name: string; projectIds: string[] }[]
    active: string | null
    projects: { id: string; name: string }[]
  }
}
