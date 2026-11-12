import { useState } from 'react'
import AuthFetch from '@/api-client/auth'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await AuthFetch.passwordResetRequest(email)
      setMessage(
        result?.data?.message ||
          '入力されたメールアドレスにアカウントがある場合、再設定手順を送信しました'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-sm">
      <p className="mb-4 text-sm text-gray-600">
        パスキーでログインできない場合の復旧です。完了すると、登録済みのパスキーはすべて無効になります。
      </p>
      {message ? (
        <p className="text-sm text-gray-800">{message}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-700">メールアドレス</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-gray-800 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-gray-700 focus:ring-4 focus:ring-gray-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            復旧メールを送信
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <a href="/login" className="text-blue-700 underline">
          ログインに戻る
        </a>
      </p>
    </div>
  )
}
