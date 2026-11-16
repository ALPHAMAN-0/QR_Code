import { useId, useState } from 'react'
import { Icon } from '../../components/Icon.tsx'
import { logoFromFile } from '../../lib/files.ts'
import type { EccLevel, Symbology } from '../../lib/symbologies.ts'

export interface StyleState {
  foreground: string
  background: string
  transparent: boolean
  size: number
  /** null = the symbology's recommended quiet zone. */
  margin: number | null
  eclevel: EccLevel
  /** null = the symbology's default. */
  showText: boolean | null
  logo: { dataUrl: string; size: number } | null
}

export const DEFAULT_STYLE: StyleState = {
  foreground: '000000',
  background: 'FFFFFF',
  transparent: false,
  size: 1024,
  margin: null,
  eclevel: 'M',
  showText: null,
  logo: null,
}

export const SIZE_PRESETS = [
  { px: 256, label: 'Small (≈256 px)' },
  { px: 512, label: 'Medium (≈512 px)' },
  { px: 1024, label: 'Large (≈1024 px)' },
  { px: 2048, label: 'Print (≈2048 px)' },
]

const ECC_LABELS: Record<EccLevel, string> = { L: 'Low (7%)', M: 'Medium (15%)', Q: 'Quartile (25%)', H: 'High (30%)' }

interface Props {
  symbology: Symbology
  style: StyleState
  defaultMargin: number
  onChange: (next: StyleState) => void
}

export function StyleFields({ symbology, style, defaultMargin, onChange }: Props) {
  const ids = { fg: useId(), bg: useId(), size: useId(), margin: useId(), logo: useId(), logoSize: useId() }
  const [logoError, setLogoError] = useState('')
  const margin = style.margin ?? defaultMargin
  const set = (patch: Partial<StyleState>) => onChange({ ...style, ...patch })

  const onLogo = async (file: File | undefined) => {
    setLogoError('')
    if (!file) return
    try {
      set({ logo: { dataUrl: await logoFromFile(file), size: style.logo?.size ?? 0.22 } })
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : 'That image could not be used.')
    }
  }

  return (
    <div className="stack">
      <div className="grid-2">
        <div className="field">
          <label htmlFor={ids.fg}>Code color</label>
          <div className="color-row">
            <input id={ids.fg} type="color" value={`#${style.foreground}`} onChange={(e) => set({ foreground: e.target.value.slice(1).toUpperCase() })} />
            <span className="mono hex">
              #{style.foreground}
            </span>
          </div>
        </div>
        <div className="field">
          <label htmlFor={ids.bg}>Background</label>
          <div className="color-row">
            <input
              id={ids.bg}
              type="color"
              value={`#${style.background}`}
              disabled={style.transparent}
              onChange={(e) => set({ background: e.target.value.slice(1).toUpperCase() })}
            />
            <span className="mono hex">
              {style.transparent ? 'none' : `#${style.background}`}
            </span>
          </div>
        </div>
      </div>
      <div className="btn-row">
        <label className="check">
          <input type="checkbox" checked={style.transparent} onChange={(e) => set({ transparent: e.target.checked })} />
          Transparent background
        </label>
        <button type="button" className="btn btn-quiet" onClick={() => set({ foreground: style.background, background: style.foreground })}>
          Swap colors
        </button>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor={ids.size}>Image size</label>
          <select id={ids.size} className="select" value={style.size} onChange={(e) => set({ size: Number(e.target.value) })}>
            {SIZE_PRESETS.map((p) => (
              <option key={p.px} value={p.px}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={ids.margin}>
            Quiet zone: <output htmlFor={ids.margin}>{margin}</output> modules
          </label>
          <input id={ids.margin} type="range" min={0} max={20} value={margin} onChange={(e) => set({ margin: Number(e.target.value) })} />
        </div>
      </div>

      {symbology.eccLevels && (
        <fieldset className="segments">
          <legend>Error correction{style.logo && symbology.logo ? ': High is used with a logo' : ''}</legend>
          {symbology.eccLevels.map((level) => (
            <label key={level} className="segment">
              <input
                type="radio"
                name="ecc"
                value={level}
                checked={(style.logo && symbology.logo ? 'H' : style.eclevel) === level}
                disabled={Boolean(style.logo && symbology.logo)}
                onChange={() => set({ eclevel: level })}
              />
              <span>{ECC_LABELS[level]}</span>
            </label>
          ))}
        </fieldset>
      )}

      {symbology.showsText && (
        <label className="check">
          <input type="checkbox" checked={style.showText ?? true} onChange={(e) => set({ showText: e.target.checked })} />
          Show the value as text under the bars
        </label>
      )}

      {symbology.logo && (
        <div className="field">
          <span className="field-label">Logo in the middle</span>
          <div className="logo-row">
            {style.logo && <img className="logo-thumb" src={style.logo.dataUrl} alt="Current logo" />}
            <input
              id={ids.logo}
              className="sr-only file-proxy"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              onChange={(e) => {
                void onLogo(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <label className="btn" htmlFor={ids.logo}>
              <Icon name="image" /> {style.logo ? 'Change logo' : 'Add logo'}
            </label>
            {style.logo && (
              <button type="button" className="btn btn-quiet btn-danger" onClick={() => set({ logo: null })}>
                <Icon name="x" /> Remove
              </button>
            )}
          </div>
          {style.logo && (
            <div className="field">
              <label htmlFor={ids.logoSize}>
                Logo size: <output htmlFor={ids.logoSize}>{Math.round(style.logo.size * 100)}%</output>
              </label>
              <input
                id={ids.logoSize}
                type="range"
                min={10}
                max={30}
                value={Math.round(style.logo.size * 100)}
                onChange={(e) => set({ logo: { ...style.logo!, size: Number(e.target.value) / 100 } })}
              />
            </div>
          )}
          {logoError && (
            <p className="status status-bad" role="alert">
              <Icon name="alert" /> {logoError}
            </p>
          )}
        </div>
      )}

      <div className="btn-row">
        <button type="button" className="btn btn-quiet" onClick={() => onChange(DEFAULT_STYLE)}>
          Reset style
        </button>
      </div>
    </div>
  )
}
