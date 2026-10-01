export interface FontDef { family: string; category: 'Sans' | 'Serif' | 'Display' | 'Script' | 'Mono' | 'Bangla'; weights: number[] }

const W = (a: number, b: number) => [100, 200, 300, 400, 500, 600, 700, 800, 900].filter((w) => w >= a && w <= b)

export const FONTS: FontDef[] = [
  { family: 'Inter', category: 'Sans', weights: W(100, 900) },
  { family: 'Poppins', category: 'Sans', weights: W(100, 900) },
  { family: 'Montserrat', category: 'Sans', weights: W(100, 900) },
  { family: 'Space Grotesk', category: 'Sans', weights: W(300, 700) },
  { family: 'Syne', category: 'Sans', weights: W(400, 800) },
  { family: 'Oswald', category: 'Sans', weights: W(200, 700) },
  { family: 'Fredoka', category: 'Sans', weights: W(300, 700) },
  { family: 'Teko', category: 'Sans', weights: W(300, 700) },
  { family: 'Chakra Petch', category: 'Sans', weights: W(300, 700) },
  { family: 'Bebas Neue', category: 'Display', weights: [400] },
  { family: 'Anton', category: 'Display', weights: [400] },
  { family: 'Archivo Black', category: 'Display', weights: [400] },
  { family: 'Bungee', category: 'Display', weights: [400] },
  { family: 'Bangers', category: 'Display', weights: [400] },
  { family: 'Luckiest Guy', category: 'Display', weights: [400] },
  { family: 'Righteous', category: 'Display', weights: [400] },
  { family: 'Monoton', category: 'Display', weights: [400] },
  { family: 'Orbitron', category: 'Display', weights: W(400, 900) },
  { family: 'Audiowide', category: 'Display', weights: [400] },
  { family: 'Russo One', category: 'Display', weights: [400] },
  { family: 'Black Ops One', category: 'Display', weights: [400] },
  { family: 'Staatliches', category: 'Display', weights: [400] },
  { family: 'Rubik Mono One', category: 'Display', weights: [400] },
  { family: 'Alfa Slab One', category: 'Display', weights: [400] },
  { family: 'Abril Fatface', category: 'Display', weights: [400] },
  { family: 'Ultra', category: 'Display', weights: [400] },
  { family: 'Bowlby One', category: 'Display', weights: [400] },
  { family: 'Zen Dots', category: 'Display', weights: [400] },
  { family: 'Press Start 2P', category: 'Display', weights: [400] },
  { family: 'Creepster', category: 'Display', weights: [400] },
  { family: 'Nosifer', category: 'Display', weights: [400] },
  { family: 'Faster One', category: 'Display', weights: [400] },
  { family: 'Playfair Display', category: 'Serif', weights: W(400, 900) },
  { family: 'DM Serif Display', category: 'Serif', weights: [400] },
  { family: 'Cinzel', category: 'Serif', weights: W(400, 900) },
  { family: 'Cormorant Garamond', category: 'Serif', weights: W(300, 700) },
  { family: 'Lora', category: 'Serif', weights: W(400, 700) },
  { family: 'Roboto Slab', category: 'Serif', weights: W(100, 900) },
  { family: 'Pacifico', category: 'Script', weights: [400] },
  { family: 'Lobster', category: 'Script', weights: [400] },
  { family: 'Dancing Script', category: 'Script', weights: W(400, 700) },
  { family: 'Great Vibes', category: 'Script', weights: [400] },
  { family: 'Sacramento', category: 'Script', weights: [400] },
  { family: 'Kaushan Script', category: 'Script', weights: [400] },
  { family: 'Permanent Marker', category: 'Script', weights: [400] },
  { family: 'Caveat', category: 'Script', weights: W(400, 700) },
  { family: 'Satisfy', category: 'Script', weights: [400] },
  { family: 'JetBrains Mono', category: 'Mono', weights: W(100, 800) },
  { family: 'Space Mono', category: 'Mono', weights: [400, 700] },
  { family: 'Major Mono Display', category: 'Mono', weights: [400] },
  { family: 'Hind Siliguri', category: 'Bangla', weights: W(300, 700) },
  { family: 'Noto Sans Bengali', category: 'Bangla', weights: W(100, 900) },
  { family: 'Galada', category: 'Bangla', weights: [400] },
  { family: 'Tiro Bangla', category: 'Bangla', weights: [400] },
]

/** Google Fonts CSS2 URLs (split in chunks so one bad family can't break all). */
export function googleFontUrls(): string[] {
  const parts = FONTS.map((f) => {
    const fam = f.family.replace(/ /g, '+')
    if (f.weights.length === 1 && f.weights[0] === 400) return `family=${fam}`
    return `family=${fam}:wght@${f.weights.join(';')}`
  })
  const urls: string[] = []
  for (let i = 0; i < parts.length; i += 10) urls.push(`https://fonts.googleapis.com/css2?${parts.slice(i, i + 10).join('&')}&display=swap`)
  return urls
}

export function closestWeight(family: string, weight: number): number {
  const f = FONTS.find((x) => x.family === family)
  if (!f) return weight
  return f.weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), f.weights[0])
}

const loaded = new Set<string>()
const listeners = new Set<() => void>()
export function onFontLoaded(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } }

export function ensureFont(family: string, weight: number, italic = false) {
  if (typeof document === 'undefined' || !document.fonts) return
  const key = `${family}|${weight}|${italic}`
  if (loaded.has(key)) return
  loaded.add(key)
  document.fonts
    .load(`${italic ? 'italic ' : ''}${weight} 40px "${family}"`, 'AaBb অআ')
    .then(() => listeners.forEach((l) => l()))
    .catch(() => {})
}
