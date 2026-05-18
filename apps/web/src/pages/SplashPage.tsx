export default function SplashPage() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
    }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: 20,
        backgroundColor: '#FEF0EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
      }}>
        <span style={{ fontSize: 40 }}>🍳</span>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
        Povarissimo
      </h1>
      <p style={{ color: '#aaa', fontSize: 14 }}>Загрузка...</p>
    </div>
  )
}
