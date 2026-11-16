// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { pixelsFrom } from './scanner.ts'

describe('pixelsFrom', () => {
  it('scales large frames down and paints a white backdrop first', () => {
    const calls: string[] = []
    const context = {
      set fillStyle(v: string) {
        calls.push(`fill:${v}`)
      },
      fillRect: () => calls.push('fillRect'),
      drawImage: (_s: unknown, _x: number, _y: number, w: number, h: number) => calls.push(`draw:${w}x${h}`),
      getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)
    const pixels = pixelsFrom({} as CanvasImageSource, 4000, 2000, 1000)
    expect(pixels.width).toBe(1000)
    expect(pixels.height).toBe(500)
    expect(calls).toEqual(['fill:#ffffff', 'fillRect', 'draw:1000x500'])
  })

  it('fails clearly without a canvas', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    expect(() => pixelsFrom({} as CanvasImageSource, 10, 10)).toThrow(/Canvas/)
  })
})
