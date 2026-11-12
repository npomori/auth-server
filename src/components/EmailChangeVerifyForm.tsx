import { useState } from 'react'
import AuthFetch from '@/api-client/auth'

type Props = {
  token: string
}

export default function EmailChangeVerifyForm({ token }: Props) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleVerify() {
    setLoading(true)
    try {
      const result = await AuthFetch.verifyEmailChange(token)
      if (!result || !result.response.ok) {
        alert(result?.data?.error || '確認リンクが無効です')
        return
      }
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-sm">
      {done ? (
        <p className="text-sm text-gray-700">
          受信を確認しました。メールアドレスは、管理者が確定するまで変わりません。このページではログインしません。
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-600">
            このアドレスでメールを受け取れることを確認します。ボタンを押してもログインせず、メールアドレスはまだ変わりません。
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleVerify()}
            className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-gray-800 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-gray-700 focus:ring-4 focus:ring-gray-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            受信を確認する
          </button>
        </>
      )}
    </div>
  )
}
