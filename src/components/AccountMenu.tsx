import { useState } from 'react'
import InitialsAvatar from '@/components/InitialsAvatar'
import LogoutButton from '@/components/LogoutButton'

type Props = {
  name: string
  email: string
  roleLabel: string
}

export default function AccountMenu({ name, email, roleLabel }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        className="inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-full"
        aria-label="アカウント"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <InitialsAvatar
          name={name}
          alt={`${name}のアバター`}
          className="h-10 w-10 rounded-full ring-2 ring-white/60"
        />
      </button>
      {open ? (
        <div className="absolute top-12 right-0 z-50 my-4 w-56 divide-y divide-gray-100 rounded bg-white text-base text-gray-900 shadow ring-1 ring-black/5">
          <div className="px-4 py-3">
            <p className="text-gray-900">{name}</p>
            <p className="truncate text-sm text-gray-600">{email}</p>
            <p className="text-sm text-gray-600">{roleLabel}</p>
          </div>
          <div className="py-1">
            <LogoutButton appearance="menu" />
          </div>
        </div>
      ) : null}
    </div>
  )
}
