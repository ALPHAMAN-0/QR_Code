import { describe, expect, it } from 'vitest'
import { contrastRatio, normalizeHex, scanWarnings } from './contrast.ts'

describe('normalizeHex', () => {
  it.each([
    ['#000000', '000000'],
    ['abc', 'AABBCC'],
    ['#AbC', 'AABBCC'],
    ['  #ff8800 ', 'FF8800'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeHex(input)).toBe(expected)
  })

  it.each(['', '#12', 'zzzzzz', '#1234567'])('rejects %s', (input) => {
    expect(normalizeHex(input)).toBeNull()
  })
})

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colors', () => {
    expect(contrastRatio('000000', 'FFFFFF')).toBeCloseTo(21, 5)
    expect(contrastRatio('777777', '777777')).toBeCloseTo(1, 5)
  })

  it('is symmetric', () => {
    expect(contrastRatio('1A73E8', 'FFFFFF')).toBeCloseTo(contrastRatio('FFFFFF', '1A73E8'), 10)
  })
})

describe('scanWarnings', () => {
  it('has no warnings for dark on light', () => {
    expect(scanWarnings('111111', 'FFFFFF', false)).toEqual([])
  })

  it('warns about low contrast', () => {
    expect(scanWarnings('999999', 'BBBBBB', false)).toContainEqual(expect.objectContaining({ id: 'low-contrast' }))
  })

  it('warns when the code is lighter than its background', () => {
    expect(scanWarnings('FFFFFF', '000000', false)).toContainEqual(expect.objectContaining({ id: 'inverted' }))
  })

  it('warns about light codes on a transparent background', () => {
    expect(scanWarnings('EEEEEE', 'FFFFFF', true)).toContainEqual(expect.objectContaining({ id: 'transparent-light' }))
    expect(scanWarnings('111111', 'FFFFFF', true)).toEqual([])
  })
})
