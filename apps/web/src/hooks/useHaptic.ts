export function useHaptic() {
  return {
    light:   () => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'),
    medium:  () => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium'),
    success: () => window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success'),
    error:   () => window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error'),
  }
}
