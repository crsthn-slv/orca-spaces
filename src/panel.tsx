import {
  atom, Box, Button, Collapsible, EmptyState, Heading, IconButton, Input, plugin,
  read, Row, Select, set, Stack, Text, type PanelContext, type SpacesView
} from 'orca'

const view = atom<SpacesView | null>(null)
const draft = atom('draft', '')

const show = (v: SpacesView) => set(view, v)

export function setup(ctx: PanelContext): void {
  ctx.subscriptions.push(plugin.on('spaces.changed', show))
  void plugin.request('spaces.get').then(show)
}

export default function Panel() {
  const v = read(view)
  if (!v) return <Text muted>Loading…</Text>
  const options = [
    { value: '__all', label: 'Everywhere' },
    ...v.spaces.map((s) => ({ value: s.id, label: s.name }))
  ]
  const spaceOf = (pid: string) => v.spaces.find((s) => s.projectIds.includes(pid))?.id ?? '__all'

  return (
    <Stack gap="md">
      <Heading level={2}>Spaces</Heading>
      {/* Zen-style icon row: the first character of each name (an emoji works best). */}
      <Row gap="xs" wrap>
        <Button
          variant={v.active === null ? 'solid' : 'ghost'}
          tooltip={`All projects (${v.projects.length})`}
          onPress={() => pick(null)}
        >
          All
        </Button>
        {v.spaces.map((s) => (
          <Button
            key={s.id}
            variant={v.active === s.id ? 'solid' : 'ghost'}
            tooltip={`${s.name} (${s.projectIds.length})`}
            onPress={() => pick(s.id)}
          >
            {Array.from(s.name)[0] ?? '?'}
          </Button>
        ))}
      </Row>
      <Text weight="semibold">{v.spaces.find((s) => s.id === v.active)?.name ?? 'All projects'}</Text>

      <Row gap="xs">
        <Box grow>
          <Input
            label="New space"
            labelHidden
            placeholder="New space…"
            value={read(draft)}
            onChange={(t) => set(draft, t)}
            onSubmit={create}
          />
        </Box>
        <IconButton icon="add" label="Add space" onPress={() => create(read(draft))} />
      </Row>

      {v.spaces.length === 0 ? (
        <EmptyState
          icon="layers"
          title="No spaces yet"
          description="Create one, then assign projects to it below. Projects in no space show everywhere."
        />
      ) : (
        <Stack gap="xs">
          <Heading level={3}>Projects</Heading>
          {v.projects.map((p) => (
            <Row key={p.id} justify="between" gap="xs">
              <Box width="50%">
                <Text truncate>{p.name}</Text>
              </Box>
              <Box width="50%">
              <Select
                label={`Space for ${p.name}`}
                labelHidden
                value={spaceOf(p.id)}
                options={options}
                onChange={(val) =>
                  void plugin
                    .request('spaces.assign', { projectId: p.id, spaceId: val === '__all' ? null : val })
                    .then(show)
                }
              />
              </Box>
            </Row>
          ))}
        </Stack>
      )}

      {v.spaces.length > 0 && (
        <Collapsible title="Manage spaces">
          <Stack gap="xs">
            {v.spaces.map((s) => (
              <Row key={s.id} gap="xs">
                <Box grow>
                  <Input
                    label={`Rename ${s.name}`}
                    labelHidden
                    defaultValue={s.name}
                    onSubmit={(name) => void plugin.request('spaces.rename', { id: s.id, name }).then(show)}
                  />
                </Box>
                <IconButton
                  icon="delete"
                  label={`Delete ${s.name}`}
                  tone="danger"
                  onPress={() => void plugin.request('spaces.delete', { id: s.id }).then(show)}
                />
              </Row>
            ))}
            <Text muted size="xs">Deleting a space only un-groups its projects; nothing is removed.</Text>
          </Stack>
        </Collapsible>
      )}
    </Stack>
  )
}

/** Highlight the space at once; the worker's answer (a moment later) replaces it. */
function pick(id: string | null): void {
  const v = read(view)
  if (v) show({ ...v, active: id })
  void plugin.request('spaces.switch', { id }).then(show)
}

function create(name: string): void {
  if (!name.trim()) return
  set(draft, '')
  void plugin.request('spaces.create', { name }).then(show)
}
