import { canManageUsers, homePathForRole } from '@/lib/user-role'
import type { UserRole } from '@/types/models'

export type AdminNavItem = {
  href: string
  title: string
  icon: 'dashboard' | 'users' | 'apps' | 'devices'
}

const items: { item: AdminNavItem; visible: (role: UserRole) => boolean }[] = [
  {
    item: { href: '/dashboard', title: 'ダッシュボード', icon: 'dashboard' },
    visible: (role) => role === 'admin'
  },
  {
    item: { href: '/admin/users', title: 'ユーザー', icon: 'users' },
    visible: (role) => canManageUsers(role)
  },
  {
    item: { href: '/admin/apps', title: 'アプリ', icon: 'apps' },
    visible: (role) => role === 'admin'
  },
  {
    item: { href: '/devices', title: 'デバイス', icon: 'devices' },
    visible: () => true
  }
]

export function adminNavItems(role: UserRole): AdminNavItem[] {
  return items.filter((entry) => entry.visible(role)).map((entry) => entry.item)
}

export function adminHomeHref(role: UserRole): string {
  return homePathForRole(role)
}

export function isAdminNavCurrent(pathname: string, href: string): boolean {
  if (href === '/dashboard' || href === '/devices') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}
