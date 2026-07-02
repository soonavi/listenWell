import { RotateCcw } from 'lucide-react'

// A professional graphic equalizer: vertical faders per band, a dB grid, and a
// live response curve plotted over the faders. `gains` is an array of dB values
// (one per band, clamped to ±12). `onChange(index, value)` updates one band.

const FADER_H = 150 // px — the draggable travel of each fader
const GAIN_MAX = 12

const clampGain = (g) => Math.max(-GAIN_MAX, Math.min(GAIN_MAX, g))
const gainToPct = (g) => ((GAIN_MAX - clampGain(g)) / (GAIN_MAX * 2)) * 100 // 0 = top
const fmt = (g) => `${g > 0 ? '+' : ''}${Number.isInteger(g) ? g : g.toFixed(1)}`

// Catmull-Rom → cubic bézier for a smooth response curve through the band points
function smoothPath(points) {
  if (points.length < 2) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}

export default function Equalizer({ bands, gains, onChange, onReset }) {
  const n = bands.length
  const points = bands.map((_, i) => ({ x: ((i + 0.5) / n) * 100, y: gainToPct(gains[i] ?? 0) }))
  const linePath = smoothPath(points)
  const areaPath = linePath ? `${linePath} L 100 100 L 0 100 Z` : ''
  const gridDb = [12, 6, 0, -6, -12]
  const isFlat = gains.every((g) => (g ?? 0) === 0)

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-semibold text-gray-300">Equalizer</span>
        <button
          type="button"
          onClick={onReset}
          disabled={isFlat}
          className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-violet-300 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> Flat
        </button>
      </div>

      <div className="flex gap-2">
        {/* dB scale */}
        <div className="relative shrink-0 w-6 text-right" style={{ height: FADER_H }}>
          {gridDb.map((db) => (
            <span
              key={db}
              className="absolute right-0 -translate-y-1/2 text-[9px] tabular-nums text-gray-600"
              style={{ top: `${gainToPct(db)}%` }}
            >
              {db > 0 ? `+${db}` : db}
            </span>
          ))}
        </div>

        {/* Fader area with curve overlay */}
        <div className="relative flex-1">
          {/* Response curve + grid */}
          <svg
            className="absolute inset-x-0 top-0 pointer-events-none"
            style={{ height: FADER_H }}
            width="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="eq-line" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#22d3ee" />
                <stop offset="1" stopColor="#8b5cf6" />
              </linearGradient>
              <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="rgba(139,92,246,0.28)" />
                <stop offset="1" stopColor="rgba(139,92,246,0)" />
              </linearGradient>
            </defs>
            {gridDb.map((db) => (
              <line
                key={db}
                x1="0"
                x2="100"
                y1={gainToPct(db)}
                y2={gainToPct(db)}
                stroke={db === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}
                strokeWidth={db === 0 ? 0.6 : 0.4}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {areaPath && <path d={areaPath} fill="url(#eq-fill)" />}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="url(#eq-line)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/* Faders */}
          <div className="relative flex items-start justify-between" style={{ height: FADER_H }}>
            {bands.map((band, i) => {
              const value = clampGain(gains[i] ?? 0)
              return (
                <div key={band.freq} className="flex flex-col items-center" style={{ width: `${100 / n}%`, height: FADER_H }}>
                  <div className="eq-fader-wrap" style={{ height: FADER_H }}>
                    <input
                      type="range"
                      min={-GAIN_MAX}
                      max={GAIN_MAX}
                      step={0.5}
                      value={value}
                      onChange={(e) => onChange(i, Number(e.target.value))}
                      onDoubleClick={() => onChange(i, 0)}
                      aria-label={`${band.label} Hz gain`}
                      aria-valuetext={`${fmt(value)} decibels`}
                      className="eq-fader"
                      style={{ width: FADER_H }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Value + frequency labels */}
          <div className="flex items-start justify-between mt-1.5">
            {bands.map((band, i) => {
              const value = clampGain(gains[i] ?? 0)
              return (
                <div key={band.freq} className="flex flex-col items-center gap-0.5" style={{ width: `${100 / n}%` }}>
                  <span className={`text-[10px] tabular-nums font-medium ${value === 0 ? 'text-gray-500' : 'text-violet-300'}`}>{fmt(value)}</span>
                  <span className="text-[9px] text-gray-600 tabular-nums">{band.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-gray-600 mt-2.5 text-center">Drag a fader · double-click to zero it</p>
    </div>
  )
}
