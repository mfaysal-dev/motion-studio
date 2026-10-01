const cache = new Map<string, HTMLImageElement>()
const listeners = new Set<() => void>()

export function onImageLoaded(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } }

/** Returns the decoded image if ready, otherwise starts loading and returns null. */
export function getImage(src: string): HTMLImageElement | null {
  if (!src || typeof Image === 'undefined') return null
  let img = cache.get(src)
  if (!img) {
    img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => listeners.forEach((l) => l())
    img.src = src
    cache.set(src, img)
  }
  return img.complete && img.naturalWidth > 0 ? img : null
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { cache.set(src, img); resolve(img) }
    img.onerror = reject
    img.src = src
  })
}
