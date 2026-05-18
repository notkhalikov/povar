declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string
        initDataUnsafe: {
          user?: {
            id: number
            first_name: string
            last_name?: string
            username?: string
            photo_url?: string
            language_code?: string
          }
          auth_date: number
          hash: string
        }
        ready(): void
        expand(): void
        close(): void
        MainButton: {
          text: string
          show(): void
          hide(): void
          enable(): void
          disable(): void
          setText(text: string): void
          onClick(callback: () => void): void
          offClick(callback: () => void): void
          showProgress(leaveActive: boolean): void
          hideProgress(): void
        }
        BackButton: {
          show(): void
          hide(): void
          onClick(callback: () => void): void
          offClick(callback: () => void): void
        }
      }
    }
  }
}

export {}
