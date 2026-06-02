export type NavItem = {
  title: string
  href: string
  disabled?: boolean
}

export type MainNavItem = NavItem

export type SidebarNavItem = {
  title: string
  disabled?: boolean
  external?: boolean
  icon?: keyof typeof Icons
} & (
  | {
      href: string
      items?: never
    }
  | {
      href?: string
      items: NavLink[]
    }
)

interface NavLink extends NavItem {
  description?: string
  icon?: any
  color?: string
}

import {
  CalendarIcon,
  CreditCardIcon as CardIcon,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Circle,
  Code,
  Cog,
  Copy,
  ComputerIcon as Desktop,
  ChevronDownIcon as DropdownMenu,
  File,
  FileText,
  Folder,
  GripHorizontal,
  ImageIcon,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  PlusCircle,
  SignpostIcon as Post,
  Reply,
  Rocket,
  ScrollText,
  Search,
  Send,
  Server,
  Settings,
  ShoppingBag,
  Smile,
  Table,
  Text,
  Trash,
  User,
  User2,
  Utensils,
  MessageCircleWarningIcon as WarningCircle,
} from "lucide-react"

export const Icons = {
  close: "close",
  spinner: "spinner",
  add: "add",
  arrowRight: "arrow-right",
  check: "check",
  chevronLeft: "chevron-left",
  chevronRight: "chevron-right",
  copy: Copy,
  creditCard: CardIcon,
  scrollText: ScrollText,
  fileText: FileText,
  file: File,
  inbox: Inbox,
  layoutDashboard: LayoutDashboard,
  listChecks: ListChecks,
  logOut: LogOut,
  mail: Mail,
  messageSquare: MessageSquare,
  post: Post,
  reply: Reply,
  rocket: Rocket,
  search: Search,
  send: Send,
  server: Server,
  settings: Settings,
  shoppingBag: ShoppingBag,
  smile: Smile,
  table: Table,
  text: Text,
  trash: Trash,
  user: User,
  user2: User2,
  utensils: Utensils,
  warningCircle: WarningCircle,
  dropdownMenu: DropdownMenu,
  chevronUp: ChevronUp,
  chevronDown: ChevronDown,
  circle: Circle,
  code: Code,
  cog: Cog,
  desktop: Desktop,
  folder: Folder,
  gripHorizontal: GripHorizontal,
  imageIcon: ImageIcon,
  plus: Plus,
  plusCircle: PlusCircle,
  calendarIcon: CalendarIcon,
  checkCheck: CheckCheck,
  card: CardIcon,
}
