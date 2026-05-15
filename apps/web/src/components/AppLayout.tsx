import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: React.ReactNode;
  showNav?: boolean;
}

export function AppLayout({ children, showNav = true }: AppLayoutProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <main style={{ flex: 1, paddingBottom: showNav ? 'calc(64px + env(safe-area-inset-bottom))' : 0 }}>
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}
