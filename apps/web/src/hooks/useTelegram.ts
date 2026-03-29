import WebApp from '@twa-dev/sdk'

export function useTelegram() {
  return {
    webApp: WebApp,
    user: WebApp.initDataUnsafe.user,
    colorScheme: WebApp.colorScheme,
    initData: WebApp.initData,
  }
}
