import type { TextElement } from './types'
import { linear, radial, solid } from './elements'

export interface TextStyle { id: string; name: string; sample?: string; bg: string; style: Partial<TextElement> }

const off = { enabled: false }
const S = (color: string, width: number) => ({ enabled: true, color, width })
const sh = (color: string, blur: number, offsetX = 0, offsetY = 0) => ({ enabled: true, color, blur, offsetX, offsetY })
const gl = (color: string, blur: number, strength = 2) => ({ enabled: true, color, blur, strength })
const ex = (color: string, depth: number, angle = 45) => ({ enabled: true, color, depth, angle })

/** Reset values so every preset fully defines the look. */
const RESET: Partial<TextElement> = {
  stroke: { ...off, color: '#000000', width: 4 },
  outline2: { ...off, color: '#000000', width: 6 },
  shadow: { ...off, color: 'rgba(0,0,0,0.5)', blur: 20, offsetX: 0, offsetY: 10 },
  glow: { ...off, color: '#ffffff', blur: 20, strength: 2 },
  extrude: { ...off, color: '#000000', depth: 10, angle: 45 },
  rgbSplit: 0, letterSpacing: 0, italic: false, transform: 'none', warp: 'none',
}

const P = (id: string, name: string, bg: string, style: Partial<TextElement>, sample?: string): TextStyle => ({ id, name, bg, sample, style: { ...RESET, ...style } })

export const TEXT_STYLES: TextStyle[] = [
  P('neon-pink', 'Neon Pink', '#12051c', { fontFamily: 'Monoton', fontWeight: 400, fill: solid('#ffe3f6'), glow: gl('#ff2bd6', 28, 3), stroke: S('#ff6be6', 1) }),
  P('neon-cyan', 'Neon Cyan', '#03121a', { fontFamily: 'Audiowide', fontWeight: 400, fill: solid('#e6fdff'), glow: gl('#00e5ff', 26, 3) }),
  P('neon-tube', 'Neon Tube', '#0c0816', { fontFamily: 'Pacifico', fontWeight: 400, fill: { type: 'none' }, stroke: S('#fff36b', 3), glow: gl('#ffb800', 22, 3) }),
  P('gold-luxe', 'Gold Luxe', '#141008', { fontFamily: 'Cinzel', fontWeight: 900, fill: linear(180, '#fff3b0', '#e2b13c', '#9a6b12', '#f7d774'), shadow: sh('rgba(0,0,0,0.6)', 12, 0, 6), letterSpacing: 4 }),
  P('chrome', 'Chrome', '#0d0f14', { fontFamily: 'Russo One', fontWeight: 400, fill: linear(180, '#ffffff', '#c9d1db', '#5b6573', '#e9eef5', '#8a96a6'), stroke: S('#1b2230', 2), shadow: sh('rgba(0,0,0,0.7)', 8, 0, 6) }),
  P('retro-80s', 'Retro 80s', '#1a0b2e', { fontFamily: 'Bungee', fontWeight: 400, fill: linear(180, '#fffb96', '#ff71ce', '#b967ff'), extrude: ex('#2d0f5e', 14, 60), stroke: S('#ffffff', 1.5), italic: false }),
  P('3d-block', '3D Block', '#ffd23f', { fontFamily: 'Archivo Black', fontWeight: 400, fill: solid('#ffffff'), extrude: ex('#e4572e', 18, 45), stroke: S('#1d1d1d', 3) }),
  P('comic-pop', 'Comic Pop', '#2ec4f1', { fontFamily: 'Bangers', fontWeight: 400, fill: solid('#ffe14d'), stroke: S('#111111', 6), shadow: sh('#111111', 0, 8, 8), letterSpacing: 2 }),
  P('sticker', 'Sticker', '#7c5cff', { fontFamily: 'Luckiest Guy', fontWeight: 400, fill: solid('#ff4f8b'), stroke: S('#ffffff', 10), shadow: sh('rgba(0,0,0,0.35)', 14, 0, 8) }),
  P('outline', 'Outline Only', '#101018', { fontFamily: 'Anton', fontWeight: 400, fill: { type: 'none' }, stroke: S('#ffffff', 3), transform: 'uppercase', letterSpacing: 6 }),
  P('double-outline', 'Double Outline', '#0f172a', { fontFamily: 'Righteous', fontWeight: 400, fill: solid('#fef08a'), stroke: S('#0f172a', 5), outline2: S('#f472b6', 6) }),
  P('fire', 'Fire', '#140600', { fontFamily: 'Black Ops One', fontWeight: 400, fill: linear(180, '#fff7ae', '#ffb703', '#fb5607', '#c1121f'), glow: gl('#ff6a00', 30, 2) }),
  P('ice', 'Ice', '#06131f', { fontFamily: 'Orbitron', fontWeight: 900, fill: linear(160, '#ffffff', '#bde0fe', '#5aa9e6'), stroke: S('#e0f2ff', 1), glow: gl('#7dd3fc', 18, 1) }),
  P('candy', 'Candy', '#ffe5f1', { fontFamily: 'Fredoka', fontWeight: 700, fill: linear(90, '#ff7eb3', '#ff758c', '#ffb86b'), stroke: S('#ffffff', 6), shadow: sh('rgba(255,94,148,0.45)', 0, 0, 8) }),
  P('long-shadow', 'Long Shadow', '#ff6b6b', { fontFamily: 'Bebas Neue', fontWeight: 400, fill: solid('#ffffff'), extrude: ex('#c44545', 40, 45), letterSpacing: 2 }),
  P('glitch', 'Glitch', '#07070c', { fontFamily: 'Rubik Mono One', fontWeight: 400, fill: solid('#ffffff'), rgbSplit: 5, transform: 'uppercase' }),
  P('cyberpunk', 'Cyberpunk', '#0b0b12', { fontFamily: 'Chakra Petch', fontWeight: 700, fill: solid('#fcee0a'), shadow: sh('#00f0ff', 0, -5, 0), extrude: ex('#ff003c', 6, 0), transform: 'uppercase', italic: true }),
  P('holographic', 'Holographic', '#0e0e1a', { fontFamily: 'Syne', fontWeight: 800, fill: linear(120, '#a1ffce', '#faffd1', '#fbc2eb', '#a6c1ee', '#a1ffce') }),
  P('matrix', 'Matrix', '#000800', { fontFamily: 'Space Mono', fontWeight: 700, fill: solid('#39ff14'), glow: gl('#00ff41', 16, 2), letterSpacing: 3 }),
  P('horror', 'Horror', '#0a0000', { fontFamily: 'Creepster', fontWeight: 400, fill: linear(180, '#ff1f1f', '#7a0000'), shadow: sh('rgba(255,0,0,0.6)', 24, 0, 0), letterSpacing: 3 }),
  P('vintage', 'Vintage', '#f3e9d2', { fontFamily: 'Abril Fatface', fontWeight: 400, fill: solid('#c8553d'), outline2: S('#2d3047', 4), stroke: S('#f3e9d2', 3), shadow: sh('#2d3047', 0, 6, 6) }),
  P('elegant', 'Elegant Serif', '#faf7f2', { fontFamily: 'Playfair Display', fontWeight: 700, italic: true, fill: solid('#1c1917'), letterSpacing: 1 }),
  P('script-gold', 'Script Gold', '#161616', { fontFamily: 'Great Vibes', fontWeight: 400, fill: linear(180, '#f9e29c', '#d4a537', '#f9e29c'), shadow: sh('rgba(0,0,0,0.6)', 10, 0, 4) }),
  P('brush-marker', 'Marker', '#ffffff', { fontFamily: 'Permanent Marker', fontWeight: 400, fill: solid('#111111') }),
  P('brutalist', 'Brutalist', '#e9e9e2', { fontFamily: 'Archivo Black', fontWeight: 400, fill: solid('#111111'), shadow: sh('#ff4d00', 0, 10, 10), transform: 'uppercase', letterSpacing: -2 }),
  P('minimal', 'Minimal Wide', '#0d0d0d', { fontFamily: 'Montserrat', fontWeight: 300, fill: solid('#f5f5f5'), letterSpacing: 18, transform: 'uppercase' }),
  P('sunset', 'Sunset', '#1d0f2b', { fontFamily: 'Poppins', fontWeight: 900, fill: linear(180, '#ffcf71', '#ff6b6b', '#7f2ccb'), shadow: sh('rgba(255,107,107,0.5)', 30, 0, 10) }),
  P('ocean', 'Ocean', '#021b2e', { fontFamily: 'Oswald', fontWeight: 700, fill: linear(180, '#9be7ff', '#2b9eb3', '#0b3c5d'), stroke: S('#d7f9ff', 1.5), transform: 'uppercase' }),
  P('forest', 'Forest', '#0f1d14', { fontFamily: 'Alfa Slab One', fontWeight: 400, fill: linear(180, '#d8f3dc', '#52b788', '#1b4332'), extrude: ex('#081c15', 8, 90) }),
  P('bubblegum', 'Bubblegum', '#b8f2e6', { fontFamily: 'Luckiest Guy', fontWeight: 400, fill: solid('#ff8fab'), stroke: S('#ffffff', 5), extrude: ex('#e05780', 10, 90) }),
  P('rainbow', 'Rainbow', '#121212', { fontFamily: 'Fredoka', fontWeight: 700, fill: linear(90, '#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93') }),
  P('pixel', 'Pixel Arcade', '#120458', { fontFamily: 'Press Start 2P', fontWeight: 400, fill: solid('#fdfd96'), shadow: sh('#ff00a0', 0, 5, 5), letterSpacing: 2 }),
  P('stripes', 'Striped', '#fff8e7', { fontFamily: 'Bowlby One', fontWeight: 400, fill: { type: 'pattern', pattern: 'stripes', scale: 0.6, colors: ['#ff4f5e', '#ffffff'] }, stroke: S('#1f2937', 4) }),
  P('polka', 'Polka', '#2b2d42', { fontFamily: 'Ultra', fontWeight: 400, fill: { type: 'pattern', pattern: 'dots', scale: 0.5, colors: ['#ffd166', '#ef476f'] }, stroke: S('#ffffff', 3) }),
  P('halftone', 'Halftone Pop', '#fef3c7', { fontFamily: 'Bangers', fontWeight: 400, fill: { type: 'pattern', pattern: 'halftone', scale: 0.7, colors: ['#ef4444', '#7f1d1d'] }, stroke: S('#111827', 5), shadow: sh('#111827', 0, 6, 6) }),
  P('embossed', 'Emboss', '#8d99ae', { fontFamily: 'Roboto Slab', fontWeight: 900, fill: solid('#8d99ae'), shadow: sh('rgba(255,255,255,0.65)', 1, -2, -2), extrude: ex('#4a5568', 3, 45) }),
  P('glass', 'Frosted Glass', '#3a0ca3', { fontFamily: 'Space Grotesk', fontWeight: 700, fill: linear(180, 'rgba(255,255,255,0.95)', 'rgba(255,255,255,0.35)'), stroke: S('rgba(255,255,255,0.8)', 1), shadow: sh('rgba(0,0,0,0.3)', 24, 0, 12) }),
  P('lava', 'Lava Glow', '#0d0000', { fontFamily: 'Faster One', fontWeight: 400, fill: radial('#fff1a8', '#ff7b00', '#d00000'), glow: gl('#ff3d00', 32, 2) }),
  P('arc-badge', 'Arc Badge', '#14213d', { fontFamily: 'Staatliches', fontWeight: 400, fill: solid('#fca311'), warp: 'arc', warpAmount: 140, letterSpacing: 6, transform: 'uppercase' }),
  P('wavy', 'Wavy Fun', '#fff1e6', { fontFamily: 'Fredoka', fontWeight: 700, fill: solid('#6930c3'), stroke: S('#ffffff', 5), shadow: sh('#ff6392', 0, 6, 6), warp: 'wave', warpAmount: 50 }),
  P('bangla-neon', 'Bangla Neon', '#090014', { fontFamily: 'Galada', fontWeight: 400, fill: solid('#fff0fb'), glow: gl('#c026d3', 26, 3) }, 'শুভ নববর্ষ'),
]

export function styleSampleFont(s: TextStyle) { return s.style.fontFamily ?? 'Inter' }
