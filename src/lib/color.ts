export function toHex(c: string): string {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c
  if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + c.slice(1).split('').map((x) => x + x).join('')
  const m = /rgba?\(([^)]+)\)/.exec(c)
  if (m) {
    const [r, g, b] = m[1].split(',').map((s) => parseFloat(s))
    return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v || 0))).toString(16).padStart(2, '0')).join('')
  }
  return '#ffffff'
}
