import AuthFetch from '@/api-client/auth'

type Props = {
  appearance?: 'header' | 'menu'
}

const appearanceClass = {
  header:
    'cursor-pointer rounded px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white',
  menu: 'block w-full cursor-pointer px-4 py-2 text-left text-gray-700 hover:bg-gray-100'
} as const

export default function LogoutButton({ appearance = 'header' }: Props) {
  async function handleLogout() {
    const result = await AuthFetch.logout()
    if (!result || !result.response.ok) {
      alert(result?.data?.error || 'ログアウトに失敗しました')
      return
    }
    window.location.href = '/login'
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      className={appearanceClass[appearance]}
    >
      ログアウト
    </button>
  )
}
