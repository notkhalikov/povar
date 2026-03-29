import WebApp from '@twa-dev/sdk'

export default function App() {
  return (
    <div>
      <h1>Повар 🍽️</h1>
      <p>Пользователь: {WebApp.initDataUnsafe.user?.first_name ?? 'Гость'}</p>
    </div>
  )
}
