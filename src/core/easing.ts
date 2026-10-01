export type EasingFn = (t: number) => number

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t)

function bounceOut(t: number) {
  const n1 = 7.5625, d1 = 2.75
  if (t < 1 / d1) return n1 * t * t
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
  return n1 * (t -= 2.625 / d1) * t + 0.984375
}

/** Cubic bezier easing (CSS-style), solved with Newton + bisection. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t
  const sy = (t: number) => ((ay * t + by) * t + cy) * t
  const dsx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    x = clamp01(x)
    if (x === 0 || x === 1) return x
    let t = x
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x
      if (Math.abs(err) < 1e-6) return sy(t)
      const d = dsx(t)
      if (Math.abs(d) < 1e-6) break
      t -= err / d
    }
    let lo = 0, hi = 1
    t = x
    for (let i = 0; i < 40; i++) {
      const v = sx(t)
      if (Math.abs(v - x) < 1e-6) break
      if (v < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return sy(t)
  }
}

const c1 = 1.70158, c3 = c1 + 1, c2 = c1 * 1.525
const c4 = (2 * Math.PI) / 3, c5 = (2 * Math.PI) / 4.5

export const EASINGS: Record<string, EasingFn> = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeInQuart: (t) => t ** 4,
  easeOutQuart: (t) => 1 - Math.pow(1 - t, 4),
  easeInOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2),
  easeInExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  easeInSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  easeInBack: (t) => c3 * t ** 3 - c1 * t * t,
  easeOutBack: (t) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
  easeInOutBack: (t) =>
    t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2,
  easeInElastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4)),
  easeOutElastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1),
  easeInOutElastic: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1,
  easeInBounce: (t) => 1 - bounceOut(1 - t),
  easeOutBounce: bounceOut,
  easeInOutBounce: (t) => (t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2),
  smooth: cubicBezier(0.25, 0.1, 0.25, 1),
  snappy: cubicBezier(0.2, 0.9, 0.1, 1),
  anticipate: cubicBezier(0.68, -0.55, 0.27, 1.55),
  step: (t) => (t < 1 ? 0 : 1),
}

export const EASING_NAMES = Object.keys(EASINGS)

const bezierCache = new Map<string, EasingFn>()

/** Resolve an easing by name or `cubic-bezier(a,b,c,d)` string. Unknown → linear. */
export function getEasing(name: string | undefined): EasingFn {
  if (!name) return EASINGS.linear
  const named = EASINGS[name]
  if (named) return named
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(name.trim())
  if (m) {
    const cached = bezierCache.get(name)
    if (cached) return cached
    const nums = m[1].split(',').map((s) => parseFloat(s))
    if (nums.length === 4 && nums.every((n) => Number.isFinite(n))) {
      const fn = cubicBezier(nums[0], nums[1], nums[2], nums[3])
      bezierCache.set(name, fn)
      return fn
    }
  }
  return EASINGS.linear
}

export function ease(name: string | undefined, t: number): number {
  return getEasing(name)(clamp01(t))
}
