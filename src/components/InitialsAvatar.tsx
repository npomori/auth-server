interface InitialsAvatarProps {
  name: string
  className?: string
  alt?: string
  boxSize?: number
}

const palette = [
  '#3b82f6',
  '#22c55e',
  '#f97316',
  '#a855f7',
  '#06b6d4',
  '#ef4444',
  '#14b8a6',
  '#eab308',
  '#f43f5e'
]

function nameHash(value: string): number {
  let hash = 0
  for (const ch of Array.from(value)) {
    const code = ch.codePointAt(0) ?? 0
    hash = (hash << 5) - hash + code
    hash |= 0
  }
  return Math.abs(hash)
}

function getInitials(nameRaw: string): string {
  const name = nameRaw.trim()
  if (!name) return '?'
  const cleaned = name.replace(/\s+/g, ' ').replace(/[・･•]/g, ' ')
  const parts = cleaned.split(' ').filter(Boolean)
  if (parts.length >= 2) {
    const first = Array.from(parts[0] ?? '')[0] ?? ''
    const second = Array.from(parts[1] ?? '')[0] ?? ''
    return `${first}${second}`
  }
  const chars = Array.from(cleaned)
  return `${chars[0] ?? '?'}${chars[1] ?? ''}`
}

export default function InitialsAvatar({
  name,
  className,
  alt,
  boxSize = 64
}: InitialsAvatarProps) {
  const initials = getInitials(name).slice(0, 2)
  const bg = palette[nameHash(name) % palette.length] ?? '#3b82f6'
  const fontSize = Math.round(boxSize * 0.38)

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${boxSize} ${boxSize}`}
      role="img"
      aria-label={alt ?? `${name}のアバター`}
      className={className}
    >
      <title>{alt ?? `${name}のアバター`}</title>
      <rect width="100%" height="100%" rx={boxSize / 2} fill={bg} />
      <text
        x="50%"
        y="50%"
        dy=".1em"
        dominantBaseline="middle"
        textAnchor="middle"
        fontFamily="sans-serif"
        fontSize={fontSize}
        fill="#ffffff"
      >
        {initials}
      </text>
    </svg>
  )
}
