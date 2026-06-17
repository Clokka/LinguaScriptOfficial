import { template as friendMessage } from './friend-message-notification.tsx'
import type { ComponentType } from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: (data: any) => string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'friend-message-notification': friendMessage,
}
