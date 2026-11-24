import { assert, test } from 'orca/testing'
import { adopt, assign, diff, isVisible, step, type State } from './spaces'

const s: State = {
  spaces: [
    { id: 'a', name: 'Agência', projectIds: ['p1', 'p2'] },
    { id: 'b', name: 'Pessoal', projectIds: ['p3'] }
  ],
  active: 'a'
}

test('visibility: active space + unassigned', () => {
  assert.equal(isVisible(s, 'p1'), true)
  assert.equal(isVisible(s, 'p3'), false)
  assert.equal(isVisible(s, 'p9'), true) // in no space = everywhere
  assert.equal(isVisible({ ...s, active: null }, 'p3'), true)
})

test('diff only touches projects that change', () => {
  const out = diff(s, [{ id: 'p1' }, { id: 'p3' }, { id: 'p9', hidden: true }])
  assert.deepEqual(out.map((o) => o.id).sort(), ['p3', 'p9'])
})

test('step rings through All and spaces', () => {
  assert.equal(step(s, 1), 'b')
  assert.equal(step({ ...s, active: 'b' }, 1), null)
  assert.equal(step({ ...s, active: null }, -1), 'b')
})

test('assign moves a project, never duplicates', () => {
  assert.deepEqual(assign(s, 'p1', 'b').spaces.map((x) => x.projectIds), [['p2'], ['p3', 'p1']])
  assert.deepEqual(assign(s, 'p1', null).spaces[0].projectIds, ['p2'])
})

test('adopt: first run leaves everything everywhere, later imports join the active space', () => {
  const first = adopt(s, ['p1', 'p2', 'p3'])
  assert.deepEqual(first.known, ['p1', 'p2', 'p3'])
  assert.deepEqual(first.spaces, s.spaces)
  const later = adopt(first, ['p1', 'p2', 'p3', 'n1', 'n2'])
  assert.deepEqual(later.spaces[0].projectIds, ['p1', 'p2', 'n1', 'n2'])
  assert.deepEqual(adopt({ ...first, active: null }, ['p1', 'n1']).spaces, s.spaces)
})
