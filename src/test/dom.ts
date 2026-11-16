import { vi } from 'vitest'

/** jsdom has no canvas or object URLs; stub them quietly so components can render. */
export function stubBrowserApis(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:stub'
  if (!URL.revokeObjectURL) URL.revokeObjectURL = () => undefined
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stub')
  vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined)
  window.scrollTo = () => undefined
}
