import { useEffect, useState } from 'react'
import AdminEmailChangeSection from '@/components/AdminEmailChangeSection'
import InitialsAvatar from '@/components/InitialsAvatar'
import AdminFetch from '@/api-client/admin'
import {
  assignableRoles,
  canChangeUserEmail,
  canManageUsers,
  isUserRole,
  roleLabel
} from '@/lib/user-role'
import type { UserRole } from '@/types/models'

type UserRow = {
  id: string
  email: string
  name: string
  role: string
  disabledAt: string | null
  createdAt: string
  credentialCount: number
}

export default function AdminUsersSection({ actorRole }: { actorRole: UserRole }) {
  const roles = assignableRoles(actorRole)
  const [users, setUsers] = useState<UserRow[]>([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [loading, setLoading] = useState(false)

  async function load() {
    const result = await AdminFetch.getUsers()
    if (!result || !result.response.ok || !Array.isArray(result.data)) {
      alert((result?.data as { error?: string })?.error || 'ユーザー一覧の取得に失敗しました')
      return
    }
    setUsers(result.data as UserRow[])
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await AdminFetch.createUser({ email, name, role })
      if (!result || !result.response.ok) {
        alert(result?.data?.error || '招待に失敗しました')
        return
      }
      setEmail('')
      setName('')
      setRole('user')
      alert('ユーザーを作成し、ログイン用リンクをメール送信しました')
      await load()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleInvite} className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">ユーザーを招待</h2>
        <div className="mb-3 grid gap-3 md:grid-cols-2">
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
          <div>
            <label className="mb-1 block text-sm text-gray-700">名前</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-sm text-gray-700">ロール</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            {roles.map((value) => (
              <option key={value} value={value}>
                {roleLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-primary-700 hover:bg-primary-800 focus:ring-primary-300 inline-flex cursor-pointer items-center justify-center rounded-lg px-3 py-2 text-center text-sm font-medium text-white focus:ring-4 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          ログイン用リンクを送って招待
        </button>
      </form>

      {canManageUsers(actorRole) && (
        <AdminEmailChangeSection
          users={users.filter((user) => canChangeUserEmail(actorRole, user.role))}
          onChanged={load}
        />
      )}

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">ユーザー一覧</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-4 font-medium text-gray-500">名前</th>
                <th className="p-4 font-medium text-gray-500">メール</th>
                <th className="p-4 font-medium text-gray-500">ロール</th>
                <th className="p-4 font-medium text-gray-500">状態</th>
                <th className="p-4 font-medium text-gray-500">パスキー</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={user.name} className="h-8 w-8" />
                      <span className="font-semibold text-gray-900">{user.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-gray-700">{user.email}</td>
                  <td className="p-4">
                    {actorRole === 'admin' ? (
                      <UserRoleEditor user={user} onChanged={load} />
                    ) : isUserRole(user.role) ? (
                      roleLabel(user.role)
                    ) : (
                      user.role
                    )}
                  </td>
                  <td className="p-4">
                    {actorRole === 'admin' ? (
                      <UserDisabledEditor user={user} onChanged={load} />
                    ) : (
                      <StatusMark disabled={Boolean(user.disabledAt)} />
                    )}
                  </td>
                  <td className="p-4 text-gray-900">{user.credentialCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function UserRoleEditor({ user, onChanged }: { user: UserRow; onChanged: () => Promise<void> }) {
  const [role, setRole] = useState<UserRole>(isUserRole(user.role) ? user.role : 'user')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isUserRole(user.role)) setRole(user.role)
  }, [user.role])

  async function changeRole() {
    if (role === user.role) return
    if (!confirm(`${user.name} のロールを${roleLabel(role)}に変更します`)) return
    setLoading(true)
    try {
      const result = await AdminFetch.updateUserRole(user.id, role)
      if (!result || !result.response.ok) {
        alert(result?.data?.error || 'ロールの変更に失敗しました')
        if (isUserRole(user.role)) setRole(user.role)
        return
      }
      await onChanged()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={`${user.name}のロール`}
        value={role}
        onChange={(e) => setRole(e.target.value as UserRole)}
        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
      >
        {assignableRoles('admin').map((value) => (
          <option key={value} value={value}>
            {roleLabel(value)}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={loading || role === user.role}
        onClick={() => void changeRole()}
        className="bg-primary-700 hover:bg-primary-800 focus:ring-primary-300 inline-flex cursor-pointer items-center justify-center rounded-lg px-3 py-1 text-center text-sm font-medium text-white focus:ring-4 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        変更
      </button>
    </div>
  )
}

function UserDisabledEditor({
  user,
  onChanged
}: {
  user: UserRow
  onChanged: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const disabled = Boolean(user.disabledAt)

  async function toggle() {
    const next = !disabled
    const message = next ? `${user.name} を無効化します` : `${user.name} を再有効化します`
    if (!confirm(message)) return
    setLoading(true)
    try {
      const result = await AdminFetch.setUserDisabled(user.id, next)
      if (!result || !result.response.ok) {
        alert(result?.data?.error || 'アカウント状態の変更に失敗しました')
        return
      }
      await onChanged()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusMark disabled={disabled} />
      <button
        type="button"
        disabled={loading}
        onClick={() => void toggle()}
        className="focus:ring-primary-300 inline-flex cursor-pointer items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1 text-center text-sm font-medium text-gray-900 hover:bg-gray-100 focus:ring-4 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {disabled ? '再有効化' : '無効化'}
      </button>
    </div>
  )
}

function StatusMark({ disabled }: { disabled: boolean }) {
  return (
    <span className="inline-flex items-center text-gray-900">
      <span
        className={`mr-2 h-2.5 w-2.5 rounded-full ${disabled ? 'bg-red-500' : 'bg-green-400'}`}
      />
      {disabled ? '無効' : '有効'}
    </span>
  )
}
