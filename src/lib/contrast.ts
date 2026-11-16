/** Color helpers that predict whether a styled code will still scan. */

export function normalizeHex(input: string): string | null {
  const value = input.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(value)) {
    return value
      .split('')
      .map((c) => c + c)
      .join('')
      .toUpperCase()
  }
  return /^[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : null
}

function luminance(hex: string): number {
  const channels = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two 6-digit hex colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

export interface ScanWarning {
  id: 'low-contrast' | 'inverted' | 'transparent-light'
  message: string
}

/** Scanners need dark bars on a light, high-contrast background. */
export function scanWarnings(foreground: string, background: string, transparent: boolean): ScanWarning[] {
  const warnings: ScanWarning[] = []
  if (transparent) {
    if (luminance(foreground) > 0.4) {
      warnings.push({
        id: 'transparent-light',
        message: 'Light bars on a transparent background vanish on white pages. Use a darker color.',
      })
    }
    return warnings
  }
  if (contrastRatio(foreground, background) < 4) {
    warnings.push({ id: 'low-contrast', message: 'Low contrast: some scanners will fail. Make the colors more different.' })
  }
  if (luminance(foreground) > luminance(background)) {
    warnings.push({ id: 'inverted', message: 'Light-on-dark codes are not supported by every scanner app.' })
  }
  return warnings
}
