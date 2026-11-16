import type { Content, ContentType } from '../../lib/payloads.ts'

export type ContentValues = { [K in ContentType]: Extract<Content, { type: K }> }

export const CONTENT_TYPES: ReadonlyArray<{ type: ContentType; label: string; icon: import('../../components/Icon.tsx').IconName }> = [
  { type: 'url', label: 'Link', icon: 'link' },
  { type: 'text', label: 'Text', icon: 'text' },
  { type: 'wifi', label: 'Wi-Fi', icon: 'wifi' },
  { type: 'contact', label: 'Contact', icon: 'user' },
  { type: 'email', label: 'Email', icon: 'mail' },
  { type: 'phone', label: 'Phone', icon: 'phone' },
  { type: 'sms', label: 'SMS', icon: 'message' },
  { type: 'location', label: 'Location', icon: 'pin' },
  { type: 'event', label: 'Event', icon: 'calendar' },
]

export const EMPTY_CONTENT: ContentValues = {
  url: { type: 'url', url: '' },
  text: { type: 'text', text: '' },
  wifi: { type: 'wifi', ssid: '', password: '', security: 'WPA', hidden: false },
  contact: {
    type: 'contact',
    firstName: '',
    lastName: '',
    organization: '',
    title: '',
    phone: '',
    email: '',
    website: '',
    street: '',
    city: '',
    region: '',
    postcode: '',
    country: '',
    note: '',
  },
  email: { type: 'email', to: '', subject: '', body: '' },
  phone: { type: 'phone', number: '' },
  sms: { type: 'sms', number: '', message: '' },
  location: { type: 'location', latitude: '', longitude: '' },
  event: { type: 'event', title: '', location: '', start: '', end: '', allDay: false, description: '' },
}

/** True while the user has not typed anything yet (booleans and selects don't count). */
export function isBlank(content: Content): boolean {
  return Object.entries(content).every(([key, value]) => key === 'type' || typeof value !== 'string' || value.trim() === '' || key === 'security')
}
