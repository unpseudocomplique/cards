/**
 * Warm the browser cache with card faces in the background, a few at a time,
 * so a card played by someone else flies in with its face already drawn.
 */
export function preloadImages(urls: string[], concurrency = 3): () => void {
  let cancelled = false
  const queue = [...new Set(urls)]

  function next() {
    if (cancelled) {
      return
    }
    const url = queue.shift()
    if (!url) {
      return
    }
    const image = new Image()
    image.decoding = 'async'
    image.onload = image.onerror = () => next()
    image.src = url
  }

  for (let i = 0; i < concurrency; i++) {
    next()
  }
  return () => {
    cancelled = true
  }
}
