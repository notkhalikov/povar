const LIGHT_THEME: Record<string, string> = {
  '--tg-theme-bg-color': '#ffffff',
  '--tg-theme-secondary-bg-color': '#F7F6F3',
  '--tg-theme-text-color': '#1A1917',
  '--tg-theme-hint-color': '#6B6966',
  '--tg-theme-button-color': '#D85A30',
  '--tg-theme-button-text-color': '#ffffff',
  '--tg-theme-header-bg-color': '#ffffff',
  '--tg-theme-section-bg-color': '#F7F6F3',
  '--tg-theme-section-header-text-color': '#6B6966',
  '--tg-theme-subtitle-text-color': '#6B6966',
  '--tg-theme-link-color': '#D85A30',
  '--tg-theme-destructive-text-color': '#E24B4A',
  '--tg-color-scheme': 'light',
};

let observing = false;

function applyTheme() {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(LIGHT_THEME)) {
    root.style.setProperty(key, value);
  }
}

export function forceLightTheme() {
  // Apply immediately
  applyTheme();

  if (observing) return;
  observing = true;

  // Re-apply every time Telegram touches the root style attribute
  const observer = new MutationObserver(() => {
    // Pause observer to avoid infinite loop
    observer.disconnect();
    applyTheme();
    // Resume watching
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style'],
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style'],
  });

  // Also hook into Telegram's themeChanged event
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.onEvent('themeChanged', applyTheme);
      // Force Telegram header colors
      tg.setHeaderColor('#ffffff');
      tg.setBackgroundColor('#ffffff');
    }
  } catch (e) {
    // Not in Telegram context, ignore
  }
}
