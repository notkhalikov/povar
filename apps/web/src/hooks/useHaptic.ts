import WebApp from '@twa-dev/sdk'

export function useHaptic() {
  return {
    light:   () => { try { WebApp.HapticFeedback.impactOccurred('light') } catch {} },
    medium:  () => { try { WebApp.HapticFeedback.impactOccurred('medium') } catch {} },
    success: () => { try { WebApp.HapticFeedback.notificationOccurred('success') } catch {} },
    error:   () => { try { WebApp.HapticFeedback.notificationOccurred('error') } catch {} },
  }
}
