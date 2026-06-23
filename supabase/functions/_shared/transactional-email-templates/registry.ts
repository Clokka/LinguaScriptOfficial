import { template as friendMessage } from './friend-message-notification.tsx'
import { template as reviewReminder } from './review-reminder.tsx'
import { template as streakRescue } from './streak-rescue.tsx'
import { template as friendRequestReceived } from './friend-request-received.tsx'
import { template as friendRequestAccepted } from './friend-request-accepted.tsx'
import { template as weeklyProgress } from './weekly-progress.tsx'
import { template as monthlyRecap } from './monthly-recap.tsx'
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
  'review-reminder': reviewReminder,
  'streak-rescue': streakRescue,
  'friend-request-received': friendRequestReceived,
  'friend-request-accepted': friendRequestAccepted,
  'weekly-progress': weeklyProgress,
  'monthly-recap': monthlyRecap,
}
