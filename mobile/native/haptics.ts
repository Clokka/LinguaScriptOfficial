import * as Haptics from 'expo-haptics';

export const tapLight = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
export const tapMedium = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
export const tapHeavy = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
export const success = () =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
export const warning = () =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
export const error = () =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
export const selection = () => Haptics.selectionAsync().catch(() => {});
