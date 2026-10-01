import { createImage } from '../core/elements'
import { actions, getState, useStore } from '../store'
import { loadImage } from '../core/images'

export async function fileToDataUrl(file: File, maxDim = 2048): Promise<{ src: string; w: number; h: number }> {
  const raw = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file) })
  const img = await loadImage(raw)
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  if (scale >= 1 && file.size < 1.5e6) return { src: raw, w: img.naturalWidth, h: img.naturalHeight }
  const c = document.createElement('canvas')
  c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  const src = file.type === 'image/png' || file.type === 'image/webp' ? c.toDataURL('image/webp', 0.9) : c.toDataURL('image/jpeg', 0.88)
  await loadImage(src)
  return { src, w: c.width, h: c.height }
}

export async function addImageFile(file: File) {
  if (!file.type.startsWith('image/')) { actions.toast('Please choose an image file'); return }
  try {
    const { src, w, h } = await fileToDataUrl(file)
    const { project } = getState()
    const { width: W, height: H } = project.artboard
    const k = Math.min(1, (W * 0.6) / w, (H * 0.6) / h)
    const el = createImage(src, w * k, h * k, { x: W / 2, y: H / 2, name: file.name.replace(/\.[^.]+$/, '').slice(0, 28) || 'Image' }, project.duration)
    actions.addElements([el])
    useStore.setState({ tool: 'select' })
  } catch {
    actions.toast('Could not read that image')
  }
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}
