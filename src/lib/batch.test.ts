import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, it, vi } from 'vitest'
import { BATCH_LIMIT, batchFileName, buildZip, generateBatch, parseBatchLines } from './batch.ts'

describe('parseBatchLines', () => {
  it('trims lines and drops blanks', () => {
    expect(parseBatchLines(' a \n\n b\r\n  \nc')).toEqual({ values: ['a', 'b', 'c'], truncated: false })
  })

  it(`stops at ${BATCH_LIMIT} values`, () => {
    const input = Array.from({ length: BATCH_LIMIT + 3 }, (_, i) => `v${i}`).join('\n')
    const result = parseBatchLines(input)
    expect(result.values).toHaveLength(BATCH_LIMIT)
    expect(result.truncated).toBe(true)
  })
})

describe('batchFileName', () => {
  it('pads the index and makes the value safe for file systems', () => {
    expect(batchFileName(0, 'https://example.com/a?b=c', 'png', 120)).toBe('001-https-example-com-a-b-c.png')
    expect(batchFileName(41, '../../etc/passwd', 'svg', 9)).toBe('42-etc-passwd.svg')
  })

  it('falls back to "code" when nothing safe remains and caps length', () => {
    expect(batchFileName(2, '日本語', 'png', 5)).toBe('3-code.png')
    expect(batchFileName(0, 'x'.repeat(200), 'png', 5).length).toBeLessThanOrEqual(50)
  })
})

describe('buildZip', () => {
  it('produces a ZIP containing every file', () => {
    const zip = buildZip([
      { name: 'a.txt', data: new TextEncoder().encode('alpha') },
      { name: 'b.txt', data: new TextEncoder().encode('beta') },
    ])
    const files = unzipSync(zip)
    expect(Object.keys(files).sort()).toEqual(['a.txt', 'b.txt'])
    expect(strFromU8(files['a.txt']!)).toBe('alpha')
  })
})

describe('generateBatch', () => {
  it('renders each value, reports progress, and collects failures with line numbers', async () => {
    const render = vi.fn(async (value: string) => {
      if (value === 'bad') throw new Error('Too long')
      return new TextEncoder().encode(value)
    })
    const onProgress = vi.fn()
    const result = await generateBatch(['one', 'bad', 'three'], render, 'png', onProgress)
    expect(result.files.map((f) => f.name)).toEqual(['1-one.png', '3-three.png'])
    expect(result.errors).toEqual([{ line: 2, value: 'bad', message: 'Too long' }])
    expect(onProgress).toHaveBeenLastCalledWith(3, 3)
  })
})
