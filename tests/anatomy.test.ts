import { describe, expect, test } from 'bun:test'
import { emphasis, groups, structures, tour } from '../src/anatomy'

describe('selection emphasis', () => {
  test('keeps every structure normal without a selection', () => {
    expect(structures.every((s) => emphasis(s.id, null) === 'normal')).toBe(true)
  })

  test('keeps the selection solid and ghosts everything else', () => {
    const states = structures.map((s) => emphasis(s.id, 'deltoid'))
    expect(states.filter((s) => s === 'selected')).toHaveLength(1)
    expect(emphasis('deltoid', 'deltoid')).toBe('selected')
    expect(emphasis('trapezius', 'deltoid')).toBe('ghosted')
  })
})

describe('muscle catalogue', () => {
  test('every structure has unique sources, matching parts and a region', () => {
    const sources = structures.flatMap((s) => s.sources)
    expect(new Set(sources).size).toBe(sources.length)
    for (const s of structures) {
      expect(s.parts).toHaveLength(s.sources.length)
      expect(groups).toContain(s.group)
    }
  })

  test('every region has muscles and every tour stop exists', () => {
    for (const g of groups) expect(structures.some((s) => s.group === g)).toBe(true)
    for (const stop of tour) expect(structures.some((s) => s.id === stop.id)).toBe(true)
  })
})
