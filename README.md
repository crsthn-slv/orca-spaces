# Spaces for Orca

Zen-browser-style **spaces** for [Orca](https://onorca.dev): group your projects and switch the
sidebar between groups with one click or a shortcut.

- **Space = a group of projects.** Switching hides the projects of the other spaces, the same as
  "Hide Project" in the sidebar. Nothing is removed and everything keeps running.
- **Everywhere:** a project that is in no space shows in every space (like Zen's Essentials).
- **New projects** (or a freshly imported folder of repos) join the space you are in.
- **Switcher:** a button row in the status bar (the active space is highlighted; use an emoji at the
  start of a space's name to get a Zen-like icon), plus a right-sidebar panel to create, rename,
  delete spaces and pick a space per project.
- **Shortcuts:** `Mod+Alt+1..9` go to space N, `Mod+Alt+0` show all, `Mod+Alt+]` / `Mod+Alt+[`
  next / previous. Also in the command palette.
- **Paired Orca servers** (SSH hosts): their repos are listed too and follow the spaces.

## Install

```sh
orca plugin install <owner>/orca-spaces
```

Orca shows the access it asks for and prints the `--approve <fingerprint>` command to confirm.

### Access it needs

| Capability | Why |
| --- | --- |
| `workspace:read` | list your projects |
| `workspace:write` | hide / show projects (`project.setHidden`) |
| `storage:own` | remember your spaces |
| runs the `orca` CLI | hide / show repos on paired servers, which the plugin API cannot see (macOS path `/Applications/Orca.app/...`, falls back to `orca` on `PATH`) |

## Limits

- Orca's **project groups** (a parent folder imported as one group) are not projects in the plugin
  API, so the group row cannot be hidden. Import the repos separately instead.
- The switcher cannot live at the bottom of the left sidebar: Orca's plugin API does not offer
  sidebar cards yet.
- Hiding on a paired server needs that server's Orca to be recent (`orca environment update`),
  and it hides the repo for every client connected to that server.
- Each hide makes Orca refresh its sidebar; with very many projects a switch takes a moment.

## Develop

```sh
orca plugin test .
orca plugin validate .
orca plugin dev watch .
```

MIT licensed.
