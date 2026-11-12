import { useState } from 'react'
import AuthFetch from '@/api-client/auth'

type Props = {
  token: string
}

export default function MagicLinkForm({ token }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleConsume() {
    setLoading(true)
    try {
      const result = await AuthFetch.magicConsume(token)
      if (!result || !result.response.ok) {
        alert(result?.data?.error || 'ログイン用リンクが無効です')
        return
      }
      window.location.href = result.data?.redirectTo || '/setup-passkey'
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-sm">
      <p className="mb-4 text-sm text-gray-600">招待リンクからログインし、パスキーを登録します。</p>
      <button
        type="button"
        disabled={loading}
        onClick={() => void handleConsume()}
        className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-gray-800 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-gray-700 focus:ring-4 focus:ring-gray-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        ログインしてパスキーを登録します
      </button>
    </div>
  )
}
