import imageCompression from 'browser-image-compression'

export type CompressionOptions = {
  maxSizeMB?: number
  maxWidthOrHeight?: number
  quality?: number
}

const defaultOptions = {
  maxSizeMB: 2,
  maxWidthOrHeight: 1920,
  quality: 0.86
}

export function useImageCompression() {
  const toast = useToast()

  function validateImageType(file: File) {
    return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  }

  async function processImage(file: File, options: CompressionOptions = {}) {
    if (!validateImageType(file)) {
      toast.add({
        title: 'Format non supporté',
        description: 'Utilisez JPEG, PNG ou WebP.',
        color: 'error'
      })
      return null
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.add({
        title: 'Image trop volumineuse',
        description: 'Le fichier dépasse 50 Mo.',
        color: 'error'
      })
      return null
    }

    const settings = { ...defaultOptions, ...options }
    const compressedBlob = await imageCompression(file, {
      maxSizeMB: settings.maxSizeMB,
      maxWidthOrHeight: settings.maxWidthOrHeight,
      initialQuality: settings.quality,
      useWebWorker: true,
      fileType: file.type
    })

    return new File([compressedBlob], file.name, {
      type: file.type,
      lastModified: Date.now()
    })
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) {
      return `${bytes} o`
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} Ko`
    }

    return `${(bytes / 1024 / 1024).toFixed(2)} Mo`
  }

  return {
    processImage,
    formatFileSize
  }
}
