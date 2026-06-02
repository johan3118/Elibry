import Link from "next/link"
import type { LucideIcon } from "lucide-react"

interface NavItemProps {
  href: string
  title: string
  icon: LucideIcon
  color: string
}

export function NavItem({ href, title, icon: Icon, color }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 border-l-4 ${color}`}
    >
      <Icon className="mr-3 h-5 w-5" style={{ color: "#3399cc" }} />
      <span className="text-gray-700 hover:text-gray-900">{title}</span>
    </Link>
  )
}
