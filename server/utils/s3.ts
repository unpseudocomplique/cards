import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

let s3Client: S3Client | null = null

function hasS3Config() {
  const config = useRuntimeConfig()

  return Boolean(config.bucketEndpoint && config.minioUser && config.minioPassword)
}

function assertS3Config() {
  if (hasS3Config()) {
    return
  }

  throw new Error('S3 configuration is incomplete')
}

function getS3Client() {
  if (s3Client) {
    return s3Client
  }

  const config = useRuntimeConfig()
  assertS3Config()

  const endpoint = String(config.bucketEndpoint).startsWith('http')
    ? String(config.bucketEndpoint)
    : `https://${config.bucketEndpoint}`

  s3Client = new S3Client({
    endpoint,
    region: 'DE',
    credentials: {
      accessKeyId: String(config.minioUser),
      secretAccessKey: String(config.minioPassword)
    },
    forcePathStyle: true
  })

  return s3Client
}

function getMimeType(filename: string) {
  const extension = filename.split('.').pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    pdf: 'application/pdf',
    zip: 'application/zip'
  }

  return mimeTypes[extension || ''] || 'application/octet-stream'
}

async function uploadLocalFile(buffer: Buffer, objectName: string) {
  const relativePath = join('uploads', objectName)
  const destination = join(process.cwd(), 'public', relativePath)

  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, buffer)

  return `/${relativePath.replace(/\\/g, '/')}`
}

async function deleteLocalFile(objectName: string) {
  const destination = join(process.cwd(), 'public', 'uploads', objectName)

  await rm(destination, { force: true })
}

export async function uploadFile(buffer: Buffer, objectName: string, contentType?: string) {
  if (!hasS3Config()) {
    if (process.env.NODE_ENV === 'production') {
      assertS3Config()
    }

    console.warn('S3 credentials missing, storing upload locally in public/uploads.')
    return uploadLocalFile(buffer, objectName)
  }

  const client = getS3Client()
  const config = useRuntimeConfig()
  const bucket = String(config.bucketName || 'quizwar')

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: objectName,
    Body: buffer,
    ContentType: contentType || getMimeType(objectName)
  }))

  return `${String(config.bucketPublicUrl || 'https://s3.quizwar.app').replace(/\/$/, '')}/${bucket}/${objectName}`
}

export async function deleteFile(objectName: string) {
  if (!hasS3Config()) {
    await deleteLocalFile(objectName)
    return
  }

  const client = getS3Client()
  const config = useRuntimeConfig()

  await client.send(new DeleteObjectCommand({
    Bucket: String(config.bucketName || 'quizwar'),
    Key: objectName
  }))
}

export function generateFileKey(prefix: string, filename: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const random = Math.random().toString(36).slice(2, 8)
  const extension = filename.split('.').pop()?.toLowerCase() || 'jpg'

  return `${prefix}/${timestamp}-${random}.${extension}`
}
