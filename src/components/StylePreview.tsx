import { useEffect, useRef } from 'react'
import type { TextElement } from '../core/types'
import { createText } from '../core/elements'
import { drawElement, staticEval } from '../core/render'
import { ensureFont, onFontLoaded } from '../core/fonts'
import { layoutText } from '../core/text'

/** Renders a text style with the real canvas engine, so previews match the editor exactly. */
export function StylePreview({ style, text, bg, width = 132, height = 72 }: { style: Partial<TextElement>; text: string; bg: string; width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const paint = () => {
      const c = ref.current
      if (!c) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      c.width = width * dpr; c.height = height * dpr
      const ctx = c.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height)
      const el = createText({ ...style, text, fontSize: 100, x: 0, y: 0 })
      const L = layoutText(el)
      const k = Math.min((width * 0.82) / Math.max(1, L.width + (el.extrude.enabled ? el.extrude.depth : 0)), (height * 0.7) / Math.max(1, L.height))
      el.fontSize = 100 * k
      el.x = width / 2; el.y = height / 2
      const scaleFx = k
      el.stroke = { ...el.stroke, width: el.stroke.width * scaleFx * 2.2 }
      el.outline2 = { ...el.outline2, width: el.outline2.width * scaleFx * 2.2 }
      el.shadow = { ...el.shadow, blur: el.shadow.blur * scaleFx * 2, offsetX: el.shadow.offsetX * scaleFx * 2, offsetY: el.shadow.offsetY * scaleFx * 2 }
      el.glow = { ...el.glow, blur: el.glow.blur * scaleFx * 2.4 }
      el.extrude = { ...el.extrude, depth: el.extrude.depth * scaleFx * 2.2 }
      el.letterSpacing = el.letterSpacing * scaleFx
      el.rgbSplit = el.rgbSplit * scaleFx * 2
      drawElement(ctx, el, staticEval(el, 0))
    }
    ensureFont(style.fontFamily ?? 'Inter', style.fontWeight ?? 400, !!style.italic)
    paint()
    return onFontLoaded(paint)
  }, [style, text, bg, width, height])
  return <canvas ref={ref} style={{ width, height }} className="block rounded-[10px]" />
}
