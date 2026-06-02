// Client-side image optimizer — shrinks an uploaded image before it ever touches
// Supabase storage, so the whiteboard stays snappy and we don't burn through
// storage quotas. Downscales to a max dimension, re-encodes to WebP (falling back
// to JPEG), and iterates quality down if the result is still over a target size.

const MAX_DIM = 1600          // longest edge, px
const TARGET_BYTES = 320 * 1024 // aim for ~320KB per image
const MIN_QUALITY = 0.5

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality))
}

// Returns { blob, width, height, type }. Throws on non-images.
export async function optimizeImage(file, { maxDim = MAX_DIM, targetBytes = TARGET_BYTES } = {}) {
  if (!file || !file.type?.startsWith('image/')) throw new Error('That file isn’t an image.')

  const img = await loadImage(file)
  let { width, height } = img
  const scale = Math.min(1, maxDim / Math.max(width, height))
  width = Math.round(width * scale)
  height = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, width, height)

  // Prefer WebP; some browsers fall back to PNG silently — detect and use JPEG then.
  let type = 'image/webp'
  const probe = canvas.toDataURL('image/webp')
  if (!probe.startsWith('data:image/webp')) type = 'image/jpeg'

  let quality = 0.82
  let blob = await canvasToBlob(canvas, type, quality)
  // Step quality down until we hit the target (or the floor).
  while (blob && blob.size > targetBytes && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.12)
    blob = await canvasToBlob(canvas, type, quality)
  }
  if (!blob) throw new Error('Could not process that image.')
  return { blob, width, height, type }
}
