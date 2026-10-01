import type { DesignElement, Project, TextElement, PresetClip } from './types'
import { createShape, createText, emptyProject, linear, radial, solid, createPath } from './elements'
import { TEXT_STYLES } from './styles'
import { makeClip } from './animate'

const style = (id: string) => TEXT_STYLES.find((s) => s.id === id)!.style

function txt(id: string, text: string, x: number, y: number, fontSize: number, extra: Partial<TextElement> = {}, d = 6) {
  return createText({ ...style(id), text, x, y, fontSize, name: text.split('\n')[0].slice(0, 24), ...extra }, d)
}
function anim<T extends DesignElement>(el: T, a: { enter?: [string, number?, number?]; exit?: [string, number?]; emphasis?: [string, number?]; start?: number; end?: number }): T {
  const clip = (kind: 'enter' | 'exit' | 'emphasis', id: string, delay = 0, dur?: number): PresetClip => {
    const c = makeClip(kind, id)
    return { ...c, delay, duration: dur ?? c.duration }
  }
  if (a.enter) el.anim.enter = clip('enter', a.enter[0], a.enter[1] ?? 0, a.enter[2])
  if (a.exit) el.anim.exit = clip('exit', a.exit[0], 0, a.exit[1])
  if (a.emphasis) el.anim.emphasis = clip('emphasis', a.emphasis[0], a.emphasis[1] ?? 0)
  if (a.start !== undefined) el.anim.start = a.start
  if (a.end !== undefined) el.anim.end = a.end
  return el
}

export interface TemplateDef { id: string; name: string; size: string; build: () => Project }

function neon(): Project {
  const p = emptyProject(1280, 720, 'Neon Nights')
  p.artboard.background = radial('#2a0a3d', '#0b0314', '#05010a')
  const ring = createShape('ellipse', { x: 640, y: 330, width: 560, height: 560, fill: { type: 'none' }, stroke: { enabled: true, color: '#ff5ce1', width: 4 }, glow: { enabled: true, color: '#ff2bd6', blur: 30, strength: 2 }, opacity: 0.55, name: 'Ring' })
  const ring2 = createShape('ellipse', { x: 640, y: 330, width: 640, height: 640, fill: { type: 'none' }, stroke: { enabled: true, color: '#00e5ff', width: 2, dash: 14 }, glow: { enabled: true, color: '#00e5ff', blur: 18, strength: 1 }, opacity: 0.5, name: 'Dashed ring' })
  const title = txt('neon-pink', 'NEON NIGHTS', 640, 300, 128)
  const sub = txt('neon-cyan', 'LIVE • FRIDAY 9PM', 640, 470, 46, { letterSpacing: 10 })
  const s1 = createShape('star', { x: 240, y: 150, width: 60, height: 60, fill: solid('#fff36b'), glow: { enabled: true, color: '#ffb800', blur: 20, strength: 2 }, name: 'Star' })
  const s2 = createShape('star', { x: 1060, y: 560, width: 44, height: 44, fill: solid('#7df9ff'), glow: { enabled: true, color: '#00e5ff', blur: 20, strength: 2 }, name: 'Star 2' })
  p.elements = [
    anim(ring2, { enter: ['zoomIn', 0, 1], emphasis: ['spin', 0] }),
    anim(ring, { enter: ['revealCenter', 0.1, 1], emphasis: ['breathe'] }),
    anim(title, { enter: ['letterFade', 0.3, 1.4], emphasis: ['flicker', 1.8], exit: ['fadeIn', 0.6] }),
    anim(sub, { enter: ['slideUp', 1.1], exit: ['slideUp', 0.5] }),
    anim(s1, { enter: ['spinIn', 1.4], emphasis: ['pulse'] }),
    anim(s2, { enter: ['spinIn', 1.6], emphasis: ['float'] }),
  ]
  p.elements[3].anim.emphasis = undefined
  return p
}

function sale(): Project {
  const p = emptyProject(1080, 1920, 'Mega Sale Story')
  p.artboard.background = linear(160, '#ff9a3c', '#ff4f6d', '#a12bff')
  const burst = createShape('star', { x: 540, y: 1360, width: 560, height: 560, sides: 16, innerRatio: 0.82, fill: solid('#ffe14d'), stroke: { enabled: true, color: '#111', width: 8 }, shadow: { enabled: true, color: 'rgba(0,0,0,0.35)', blur: 0, offsetX: 14, offsetY: 14 }, name: 'Burst' })
  const mega = txt('3d-block', 'MEGA', 540, 520, 300)
  const saleT = txt('comic-pop', 'SALE!', 540, 820, 280, { rotation: -6 })
  const off = txt('sticker', '50%\nOFF', 540, 1360, 150, { fill: solid('#111111'), stroke: { enabled: false, color: '#fff', width: 0 }, shadow: { enabled: false, color: '#000', blur: 0, offsetX: 0, offsetY: 0 }, lineHeight: 0.95 })
  const cta = createShape('rect', { x: 540, y: 1720, width: 640, height: 130, radius: 65, fill: solid('#111111'), name: 'Button' })
  const ctaT = txt('minimal', 'SHOP NOW', 540, 1720, 52, { fontWeight: 700, letterSpacing: 12 })
  const arrow = createShape('arrow', { x: 540, y: 1080, width: 220, height: 60, rotation: 90, stroke: { enabled: true, color: '#ffffff', width: 14 }, name: 'Arrow' })
  p.elements = [
    anim(burst, { enter: ['popIn', 0.6], emphasis: ['spin', 0] }),
    anim(mega, { enter: ['dropIn', 0], emphasis: ['rubberBand', 1] }),
    anim(saleT, { enter: ['letterPop', 0.3, 1] , emphasis: ['tada', 1.5] }),
    anim(off, { enter: ['zoomIn', 0.8], emphasis: ['heartbeat', 1.4] }),
    anim(arrow, { enter: ['slideDown', 1], emphasis: ['bounce'] }),
    anim(cta, { enter: ['wipeLeft', 1.3] }),
    anim(ctaT, { enter: ['letterFade', 1.6] }),
  ]
  p.elements[0].anim.emphasis!.duration = 14
  return p
}

function quote(): Project {
  const p = emptyProject(1080, 1080, 'Daily Quote')
  p.artboard.background = solid('#f6f1e9')
  const mark = txt('elegant', '“', 540, 260, 320, { fill: solid('#e76f51'), italic: false })
  const q = txt('elegant', 'Design is not just\nwhat it looks like —\nit\u2019s how it moves.', 540, 560, 76, { lineHeight: 1.25, fontWeight: 600 })
  const line = createShape('line', { x: 540, y: 800, width: 120, height: 20, stroke: { enabled: true, color: '#e76f51', width: 6 }, name: 'Divider' })
  const by = txt('minimal', 'KINETICA STUDIO', 540, 870, 30, { fill: solid('#264653'), fontWeight: 600, letterSpacing: 10 })
  p.artboard.background = linear(180, '#fbf7f0', '#efe6d8')
  p.elements = [
    anim(mark, { enter: ['popIn', 0], emphasis: ['float'] }),
    anim(q, { enter: ['typewriter', 0.4, 2.4] }),
    anim(line, { enter: ['wipeLeft', 2.9] }),
    anim(by, { enter: ['letterFade', 3.2] }),
  ]
  return p
}

function launch(): Project {
  const p = emptyProject(1080, 1080, 'Launch Day')
  p.artboard.background = solid('#07070d')
  const b1 = createShape('ellipse', { x: 260, y: 260, width: 620, height: 620, fill: radial('#7c5cff', 'rgba(124,92,255,0)'), blendMode: 'screen', name: 'Blob violet' })
  const b2 = createShape('ellipse', { x: 840, y: 820, width: 700, height: 700, fill: radial('#00d4ff', 'rgba(0,212,255,0)'), blendMode: 'screen', name: 'Blob cyan' })
  const b3 = createShape('ellipse', { x: 820, y: 240, width: 420, height: 420, fill: radial('#ff4fd8', 'rgba(255,79,216,0)'), blendMode: 'screen', name: 'Blob pink' })
  const t1 = txt('holographic', 'LAUNCH', 540, 470, 150)
  const t2 = txt('outline', 'DAY  ·  10.10', 540, 640, 72)
  const pill = createShape('rect', { x: 540, y: 820, width: 420, height: 90, radius: 45, fill: { type: 'none' }, stroke: { enabled: true, color: 'rgba(255,255,255,0.6)', width: 2 }, name: 'Pill' })
  const pillT = txt('minimal', 'JOIN THE WAITLIST', 540, 820, 26, { fontWeight: 500, letterSpacing: 6 })
  p.elements = [
    anim(b1, { enter: ['fadeIn', 0, 1.5], emphasis: ['float'] }),
    anim(b2, { enter: ['fadeIn', 0.2, 1.5], emphasis: ['breathe'] }),
    anim(b3, { enter: ['fadeIn', 0.4, 1.5], emphasis: ['float', 0.6] }),
    anim(t1, { enter: ['letterScatter', 0.3, 1.6] }),
    anim(t2, { enter: ['blurIn', 1.4] }),
    anim(pill, { enter: ['revealCenter', 1.9] }),
    anim(pillT, { enter: ['fadeIn', 2.2] }),
  ]
  return p
}

function retro(): Project {
  const p = emptyProject(1080, 1080, 'Retro Wave')
  p.artboard.background = linear(180, '#1a0533', '#3d0a5c', '#ff3d81')
  const sun = createShape('ellipse', { x: 540, y: 560, width: 520, height: 520, fill: linear(180, '#fff275', '#ff8c42', '#ff3c8e'), glow: { enabled: true, color: '#ff8c42', blur: 60, strength: 1 }, name: 'Sun' })
  const elements: DesignElement[] = [anim(sun, { enter: ['riseUp', 0, 1.6] })]
  for (let i = 0; i < 5; i++) {
    const bar = createShape('rect', { x: 540, y: 640 + i * 44, width: 560, height: 8 + i * 4, radius: 0, fill: solid('#3d0a5c'), name: `Sun stripe ${i + 1}` })
    elements.push(anim(bar, { enter: ['wipeLeft', 0.6 + i * 0.1] }))
  }
  const ground = createShape('rect', { x: 540, y: 960, width: 1080, height: 240, radius: 0, fill: linear(180, '#1a0533', '#000000'), name: 'Ground' })
  elements.push(ground)
  for (let i = 0; i < 9; i++) {
    const ln = createShape('line', { x: 540 + (i - 4) * 180, y: 960, width: 260, height: 20, rotation: 90 + (i - 4) * 12, stroke: { enabled: true, color: '#ff4fd8', width: 2 }, glow: { enabled: true, color: '#ff4fd8', blur: 10, strength: 1 }, name: `Grid ${i + 1}` })
    elements.push(anim(ln, { enter: ['fadeIn', 0.8 + i * 0.05] }))
  }
  const title = txt('retro-80s', 'RETRO', 540, 300, 210, { italic: true })
  const wave = txt('chrome', 'WAVE', 540, 470, 150, { italic: true, fontFamily: 'Orbitron', fontWeight: 900 })
  elements.push(anim(title, { enter: ['letterDrop', 1, 1.3] }), anim(wave, { enter: ['skewIn', 1.8], emphasis: ['glitch', 2.5] }))
  p.elements = elements
  return p
}

function bangla(): Project {
  const p = emptyProject(1080, 1080, 'Shubho Noboborsho')
  p.artboard.background = radial('#3b0a45', '#12021a')
  const t = txt('bangla-neon', 'শুভ নববর্ষ', 540, 470, 170)
  const en = txt('script-gold', 'Happy New Year', 540, 650, 96)
  const flower: DesignElement[] = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    flower.push(anim(createShape('ellipse', { x: 540 + Math.cos(a) * 420, y: 540 + Math.sin(a) * 420, width: 40, height: 40, fill: solid(i % 2 ? '#ffd166' : '#ef476f'), glow: { enabled: true, color: i % 2 ? '#ffd166' : '#ef476f', blur: 20, strength: 1 }, name: `Light ${i + 1}` }), { enter: ['popIn', 0.1 * i], emphasis: ['pulse', 0.1 * i] }))
  }
  p.elements = [...flower, anim(t, { enter: ['letterRise', 0.4, 1.4], emphasis: ['flicker', 2] }), anim(en, { enter: ['wipeLeft', 1.6, 1.2] })]
  return p
}

function logo(): Project {
  const p = emptyProject(1920, 1080, 'Logo Reveal')
  p.duration = 5
  p.artboard.background = solid('#0b0b10')
  const mk = (e: DesignElement) => { e.anim.end = 5; return e }
  const ring = mk(createShape('ellipse', { x: 960, y: 440, width: 300, height: 300, fill: linear(135, '#7c5cff', '#00d4ff'), name: 'Mark' }))
  const inner = mk(createShape('star', { x: 960, y: 440, width: 150, height: 150, sides: 4, innerRatio: 0.32, fill: solid('#0b0b10'), name: 'Mark cut' }))
  const name = mk(txt('minimal', 'KINETICA', 960, 720, 110, { fontWeight: 600, letterSpacing: 30 }, 5))
  const tag = mk(txt('minimal', 'design  ·  motion  ·  story', 960, 820, 34, { fontWeight: 400, letterSpacing: 8, fill: solid('#8b8ba7'), transform: 'none' }, 5))
  const scribble = mk(createPath({ x: 960, y: 900, width: 520, height: 40, baseW: 520, baseH: 40, points: Array.from({ length: 30 }, (_, i) => ({ x: (i / 29) * 520, y: 20 + Math.sin(i * 0.9) * 14 })), stroke: { enabled: true, color: '#7c5cff', width: 6 }, fill: linear(90, '#7c5cff', '#00d4ff'), name: 'Swoosh' }, 5))
  p.elements = [
    anim(ring, { enter: ['elasticIn', 0, 1.2], emphasis: ['spin', 1.2] }),
    anim(inner, { enter: ['spinIn', 0.3, 1.2] }),
    anim(name, { enter: ['letterSpin', 0.9, 1.4] }),
    anim(tag, { enter: ['fadeIn', 1.9] }),
    anim(scribble, { enter: ['wipeLeft', 2.2, 1] }),
  ]
  p.elements[0].anim.emphasis!.duration = 6
  p.elements[0].anim.emphasis!.loop = true
  return p
}

function poster(): Project {
  const p = emptyProject(2480, 3508, 'Music Festival A4')
  p.artboard.background = linear(200, '#0d1b2a', '#1b263b', '#e0e1dd')
  const els: DesignElement[] = []
  const colors = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#8338ec']
  for (let i = 0; i < 5; i++) {
    els.push(anim(createShape('polygon', { x: 1240, y: 1500, width: 2200 - i * 380, height: 2200 - i * 380, sides: 6, rotation: i * 8, fill: { type: 'none' }, stroke: { enabled: true, color: colors[i], width: 26 }, name: `Hex ${i + 1}` }), { enter: ['rotateIn', i * 0.15], emphasis: ['swing', 0] }))
  }
  els.push(anim(txt('3d-block', 'SOUND\nWAVE', 1240, 1500, 420, { lineHeight: 0.95, extrude: { enabled: true, color: '#8338ec', depth: 30, angle: 45 } }), { enter: ['zoomIn', 0.8] }))
  els.push(anim(txt('minimal', 'SUMMER FESTIVAL 2026', 1240, 2900, 110, { fill: solid('#0d1b2a'), fontWeight: 700, letterSpacing: 24 }), { enter: ['slideUp', 1.2] }))
  els.push(anim(txt('minimal', 'DHAKA  ·  AUG 14–16', 1240, 3080, 80, { fill: solid('#1b263b'), fontWeight: 500, letterSpacing: 14 }), { enter: ['fadeIn', 1.5] }))
  p.elements = els
  return p
}

function typeLab(): Project {
  const p = emptyProject(1920, 1080, 'Type Lab')
  p.artboard.background = radial('#1b1033', '#0a0814', '#050409')
  const items: [string, string, number, number, number, Partial<TextElement>?][] = [
    ['retro-80s', 'RETRO', 400, 230, 150],
    ['neon-cyan', 'Neon', 960, 210, 150],
    ['gold-luxe', 'LUXE', 1520, 230, 140],
    ['comic-pop', 'POW!', 400, 540, 170, { rotation: -8 }],
    ['chrome', 'CHROME', 940, 540, 105],
    ['3d-block', 'BLOCK', 1530, 540, 125],
    ['arc-badge', 'curved text', 400, 860, 84],
    ['wavy', 'wavy fun', 960, 870, 110],
    ['fire', 'FIRE', 1520, 860, 150],
  ]
  const enters = ['letterDrop', 'letterFade', 'letterRise', 'popIn', 'wipeLeft', 'dropIn', 'letterSpin', 'letterPop', 'blurIn']
  const emph = [undefined, 'flicker', undefined, 'tada', 'glitch', 'float', 'swing', 'wave', 'pulse']
  p.elements = items.map(([id, text, x, y, fs, extra], i) =>
    anim(txt(id, text, x, y, fs, extra ?? {}), { enter: [enters[i], 0.15 * i], emphasis: emph[i] ? [emph[i]!, 1.8] : undefined }))
  return p
}

export const TEMPLATES: TemplateDef[] = [
  { id: 'typelab', name: 'Type Lab', size: 'Video 1080p', build: typeLab },
  { id: 'neon', name: 'Neon Nights', size: 'YouTube thumbnail', build: neon },
  { id: 'sale', name: 'Mega Sale', size: 'Story 9:16', build: sale },
  { id: 'launch', name: 'Launch Day', size: 'Instagram post', build: launch },
  { id: 'retro', name: 'Retro Wave', size: 'Instagram post', build: retro },
  { id: 'quote', name: 'Daily Quote', size: 'Instagram post', build: quote },
  { id: 'bangla', name: 'শুভ নববর্ষ', size: 'Instagram post', build: bangla },
  { id: 'logo', name: 'Logo Reveal', size: 'Video 1080p', build: logo },
  { id: 'poster', name: 'Festival Poster', size: 'A4 print', build: poster },
]
