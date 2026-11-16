import { fileURLToPath } from 'node:url'

export const FIXTURES = fileURLToPath(new URL('./.fixtures/', import.meta.url))
export const fixture = (name: string) => `${FIXTURES}${name}`
export const CAMERA_TEXT = 'https://example.com/from-the-camera'
