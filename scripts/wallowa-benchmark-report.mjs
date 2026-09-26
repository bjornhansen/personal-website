import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const METRICS = [
  { key: 'gpuMs', label: 'GPU ms (median)', read: (s) => s.gpuMs?.median },
  { key: 'gpuP95Ms', label: 'GPU ms (p95)', read: (s) => s.gpuMs?.p95 },
  { key: 'gpuMeanMs', label: 'GPU ms (mean)', read: (s) => s.gpuMs?.mean },
  { key: 'gpuBusyPct', label: 'GPU busy % (mean ms × FPS)', read: (s) => {
    const ms = s.gpuMs?.mean ?? s.gpuMs?.median
    return ms == null || s.renderedFps == null ? null : ms * s.renderedFps / 10
  } },
  { key: 'cpuMs', label: 'CPU ms (median)', read: (s) => s.cpuTotalMs?.median },
  { key: 'fps', label: 'Rendered FPS', read: (s) => s.renderedFps },
  { key: 'intervalP95Ms', label: 'Interval ms (p95)', read: (s) => s.intervalMs?.p95 },
  { key: 'intervalP99Ms', label: 'Interval ms (p99)', read: (s) => s.intervalMs?.p99 },
  { key: 'missedPct', label: 'Missed budget %', read: (s) => s.missedRatio == null ? null : s.missedRatio * 100, absolute: true },
  { key: 'calls', label: 'Draw calls (median)', read: (s) => s.calls?.median },
  { key: 'triangles', label: 'Triangles (median)', read: (s) => s.triangles?.median },
]

const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const spread = (values) => {
  const finite = values.filter(Number.isFinite)
  if (!finite.length) return null
  return { median: median(finite), min: Math.min(...finite), max: Math.max(...finite), n: finite.length }
}

export function analyze(summaries) {
  const valid = summaries.filter((s) => s.valid && s.summary)
  const labels = [...new Set(valid.map((s) => s.label))]
  const runs = Object.fromEntries(labels.map((label) => {
    const members = valid.filter((s) => s.label === label)
    return [label, Object.fromEntries(METRICS.map((m) => [m.key, spread(members.map((s) => m.read(s.summary)))]))]
  }))

  const groups = [...new Set(valid.map((s) => s.group ?? s.label))].filter((g) => g !== 'baseline')
  const comparisons = groups.map((group) => {
    const pairs = [...new Set(valid.filter((s) => s.group === group).map((s) => s.pair))].flatMap((pair) => {
      const base = valid.find((s) => s.group === group && s.pair === pair && s.label === 'baseline')
      const variant = valid.find((s) => s.group === group && s.pair === pair && s.label === group)
      return base && variant ? [{ pair, base: base.summary, variant: variant.summary }] : []
    })
    const baselineNoise = Object.fromEntries(METRICS.map((m) => {
      const s = spread(pairs.map((p) => m.read(p.base)))
      return [m.key, s && s.median ? (100 * (s.max - s.min)) / Math.abs(s.median) : null]
    }))
    const deltas = Object.fromEntries(METRICS.map((m) => {
      const values = pairs.map(({ base, variant }) => {
        const b = m.read(base)
        const v = m.read(variant)
        if (!Number.isFinite(b) || !Number.isFinite(v)) return null
        if (m.absolute) return v - b
        return b === 0 ? null : (100 * (v - b)) / Math.abs(b)
      }).filter(Number.isFinite)
      const s = spread(values)
      const consistent = values.length >= 2 && !(values.some((d) => d < 0) && values.some((d) => d > 0))
      return [m.key, s && { ...s, consistent, unit: m.absolute ? 'pp' : '%' }]
    }))
    return { group, pairs: pairs.length, baselineNoise, deltas }
  })

  return {
    runs,
    comparisons,
    counts: { total: summaries.length, valid: valid.length, invalid: summaries.length - valid.length },
    invalid: summaries.filter((s) => !s.valid).map((s) => ({ file: s.file, reasons: s.invalidReasons })),
  }
}

const fmt = (n, digits = 2) => n == null ? '—' : Math.abs(n) >= 1000 ? Math.round(n).toLocaleString('en-US') : n.toFixed(digits)
const fmtSpread = (s) => s ? `${fmt(s.median)} (${fmt(s.min)}–${fmt(s.max)}, n=${s.n})` : '—'
const fmtDelta = (d) => d ? `${d.median > 0 ? '+' : ''}${fmt(d.median, 1)}${d.unit} (${fmt(d.min, 1)}…${fmt(d.max, 1)})${d.consistent ? '' : ' ?'}` : '—'

export function formatReport(report, title = 'Wallowa benchmark report') {
  const lines = [`# ${title}`, '', `Runs: ${report.counts.valid} valid, ${report.counts.invalid} invalid.`, '']
  const labels = Object.keys(report.runs)
  if (labels.length) {
    lines.push('## Per-label run summaries', '', 'Median across runs (min–max). Each run is summarized independently; frames are not pooled.', '')
    lines.push(`| Metric | ${labels.join(' | ')} |`, `| --- |${labels.map(() => ' --- |').join('')}`)
    for (const m of METRICS) lines.push(`| ${m.label} | ${labels.map((l) => fmtSpread(report.runs[l][m.key])).join(' | ')} |`)
    lines.push('')
  }
  if (report.comparisons.length) {
    lines.push('## Paired deltas (variant − baseline)', '', 'Median paired change (min…max). `?` marks pairs that disagree on direction. Baseline noise is the min–max spread of the paired baselines as a % of their median.', '')
    lines.push('| Variant | Pairs | GPU busy | GPU mean | GPU median | GPU p95 | CPU median | FPS | Interval p95 | Missed | Baseline GPU noise |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    for (const c of report.comparisons) {
      const d = c.deltas
      lines.push(`| ${c.group} | ${c.pairs} | ${fmtDelta(d.gpuBusyPct)} | ${fmtDelta(d.gpuMeanMs)} | ${fmtDelta(d.gpuMs)} | ${fmtDelta(d.gpuP95Ms)} | ${fmtDelta(d.cpuMs)} | ${fmtDelta(d.fps)} | ${fmtDelta(d.intervalP95Ms)} | ${fmtDelta(d.missedPct)} | ${c.baselineNoise.gpuMs == null ? '—' : `${fmt(c.baselineNoise.gpuMs, 1)}%`} |`)
    }
    lines.push('')
  }
  if (report.invalid.length) {
    lines.push('## Invalid runs', '')
    for (const run of report.invalid) lines.push(`- ${run.file}: ${(run.reasons ?? []).join(', ')}`)
    lines.push('')
  }
  return lines.join('\n')
}

export async function writeReport(directory) {
  const summaries = JSON.parse(await readFile(resolve(directory, 'summary.json'), 'utf8'))
  const report = analyze(summaries)
  const first = summaries[0]
  const markdown = formatReport(report, `Wallowa benchmark report · ${first?.experiment ?? 'unknown'} · ${first?.scenario ?? 'unknown'}`)
  await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2))
  await writeFile(resolve(directory, 'report.md'), markdown)
  return markdown
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directories = process.argv.slice(2)
  if (!directories.length) {
    console.error('Usage: npm run bench:wallowa:report -- <results-dir> [...]')
    process.exit(1)
  }
  for (const directory of directories) console.log(await writeReport(directory))
}
