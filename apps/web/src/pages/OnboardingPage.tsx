import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const selectRole = async (role: 'chef' | 'customer') => {
    setLoading(true)
    const token = localStorage.getItem('token')

    try {
      await fetch(`${import.meta.env.VITE_API_URL}/users/me/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      })

      // Update local user
      const userStr = localStorage.getItem('user')
      if (userStr) {
        const user = JSON.parse(userStr)
        user.role = role
        user.isChef = role === 'chef'
        localStorage.setItem('user', JSON.stringify(user))
      }

      if (role === 'chef') {
        navigate('/chef-onboarding', { replace: true })
      } else {
        navigate('/catalog', { replace: true })
      }
    } catch (err) {
      console.error('Failed to set role:', err)
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
      padding: '32px 24px',
    }}>
      <span style={{ fontSize: 48, marginBottom: 24 }}>👋</span>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8, textAlign: 'center', color: '#1A1917' }}>
        Добро пожаловать!
      </h1>
      <p style={{ color: '#888', fontSize: 15, textAlign: 'center', marginBottom: 48 }}>
        Кто вы в Povarissimo?
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 320 }}>
        <button
          onClick={() => selectRole('customer')}
          disabled={loading}
          style={{
            padding: '20px 24px',
            borderRadius: 16,
            border: '2px solid #E8E6E1',
            backgroundColor: '#ffffff',
            cursor: loading ? 'not-allowed' : 'pointer',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            opacity: loading ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
          onMouseDown={(e) => {
            if (!loading) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F7F6F3'
            }
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ffffff'
          }}
        >
          <span style={{ fontSize: 36 }}>🍽️</span>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 17, color: '#1A1917' }}>
              Я ищу повара
            </p>
            <p style={{ margin: '4px 0 0', color: '#6B6966', fontSize: 13 }}>
              Хочу заказать домашнюю еду
            </p>
          </div>
        </button>

        <button
          onClick={() => selectRole('chef')}
          disabled={loading}
          style={{
            padding: '20px 24px',
            borderRadius: 16,
            border: '2px solid #D85A30',
            backgroundColor: '#FEF0EB',
            cursor: loading ? 'not-allowed' : 'pointer',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            opacity: loading ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
          onMouseDown={(e) => {
            if (!loading) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FEDDCC'
            }
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FEF0EB'
          }}
        >
          <span style={{ fontSize: 36 }}>👨‍🍳</span>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 17, color: '#D85A30' }}>
              Я повар
            </p>
            <p style={{ margin: '4px 0 0', color: '#6B6966', fontSize: 13 }}>
              Хочу готовить и зарабатывать
            </p>
          </div>
        </button>
      </div>
    </div>
  )
}
