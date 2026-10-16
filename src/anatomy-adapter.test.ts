import { describe, expect, test } from 'bun:test'
import {
  anatomyTree,
  assertAnatomyMapping,
  groupIds,
  hiddenFromVisibility,
  normalizeVisibility,
  sceneIdsForNode,
  visibilityFromHidden,
} from './anatomy-adapter'
import { groups, structures } from './anatomy'

describe('anatomy tree adapter', () => {
  test('groups every structure exactly once under interface group rows', () => {
    expect(groupIds).toEqual(groups.map((g) => `group-${g.toLowerCase().replace(/ /g, '-')}`))
    expect(anatomyTree.flatMap((group) => group.children!.map(({ id }) => id)).sort()).toEqual(
      structures.map(({ id }) => id).sort(),
    )
  })

  test('marks group rows as non-selectable and colours leaves like their meshes', () => {
    for (const group of anatomyTree) {
      expect(group.selectable).toBe(false)
      expect(group.color).toBeUndefined()
      for (const leaf of group.children!) {
        expect(leaf.selectable).toBeUndefined()
        expect(leaf.color).toBe(structures.find(({ id }) => id === leaf.id)!.color)
      }
    }
  })

  test('maps group rows to their scene leaves and leaves to themselves', () => {
    expect(sceneIdsForNode('group-upper-arm')).toEqual([
      'biceps-brachii',
      'brachialis',
      'coracobrachialis',
      'triceps-brachii',
      'anconeus',
    ])
    expect(sceneIdsForNode('soleus')).toEqual(['soleus'])
    expect(sceneIdsForNode('unknown')).toEqual([])
    expect(sceneIdsForNode(null)).toEqual([])
  })

  test('treats missing visibility entries as visible', () => {
    const visibility = normalizeVisibility({ trapezius: false })
    expect(visibility.trapezius).toBe(false)
    expect(visibility.deltoid).toBe(true)
    expect(Object.keys(visibility)).toHaveLength(structures.length)
  })

  test('round-trips the hidden set through the tree visibility map', () => {
    const hidden = new Set(['trapezius', 'soleus'])
    const visibility = visibilityFromHidden(hidden)
    expect(visibility).toEqual({ trapezius: false, soleus: false })
    expect(hiddenFromVisibility(visibility)).toEqual(hidden)
    expect(hiddenFromVisibility({ deltoid: true })).toEqual(new Set())
  })

  test('rejects missing, unknown, and duplicate leaves', () => {
    expect(() => assertAnatomyMapping()).not.toThrow()
    const [first, ...rest] = anatomyTree
    expect(() => assertAnatomyMapping(rest)).toThrow(/missing=frontalis/)
    expect(() =>
      assertAnatomyMapping([
        ...anatomyTree,
        { id: 'deltoid-tuberosity', label: 'Deltoid tuberosity' },
      ]),
    ).toThrow(/unknown=deltoid-tuberosity/)
    expect(() =>
      assertAnatomyMapping([...anatomyTree, { id: 'g', label: 'Again', children: [first] }]),
    ).toThrow(/duplicates=frontalis/)
  })
})
