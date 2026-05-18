import { useLocation, useNavigate } from 'react-router-dom';

const TABS = [
  {
    label: 'Повара',
    path: '/catalog',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M2 9.5L11 2.5L20 9.5V20H14.5V14H7.5V20H2V9.5Z"
          stroke={active ? '#D85A30' : '#9E9B97'} strokeWidth="1.5"
          strokeLinejoin="round" fill="none"/>
      </svg>
    ),
  },
  {
    label: 'Запросы',
    path: '/requests',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M4 4h14a2 2 0 012 2v8a2 2 0 01-2 2H6l-4 4V6a2 2 0 012-2z"
          stroke={active ? '#D85A30' : '#9E9B97'} strokeWidth="1.5"
          strokeLinejoin="round" fill="none"/>
      </svg>
    ),
  },
  {
    label: 'Заказы',
    path: '/orders',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="4" width="16" height="15" rx="2"
          stroke={active ? '#D85A30' : '#9E9B97'} strokeWidth="1.5"/>
        <path d="M8 4V2M14 4V2M3 10h16"
          stroke={active ? '#D85A30' : '#9E9B97'} strokeWidth="1.5"
          strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: 'Профиль',
    path: '/profile',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="8" r="4"
          stroke={active ? '#D85A30' : '#9E9B97'} strokeWidth="1.5"/>
        <path d="M3 19c0-3.9 3.6-7 8-7s8 3.1 8 7"
          stroke={active ? '#D85A30' : '#9E9B97'} strokeWidth="1.5"
          strokeLinecap="round"/>
      </svg>
    ),
  },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  function isActive(path: string) {
    return location.pathname.startsWith(path);
  }

  return (
    <nav style={{
      display: 'flex',
      height: 64,
      flexShrink: 0,
      backgroundColor: '#ffffff',
      borderTop: '1px solid #E8E6E1',
    }}>
      {TABS.map(tab => {
        const active = isActive(tab.path);
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              padding: '8px 0 12px',
              color: active ? '#D85A30' : '#9E9B97',
              fontSize: 10,
              fontWeight: active ? 500 : 400,
              cursor: 'pointer',
            }}
          >
            {tab.icon(active)}
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
