"use client"

import type * as React from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface AppHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  showBackButton?: boolean
  backUrl?: string
  actions?: React.ReactNode
}

export function AppHeader({ title, subtitle, icon, showBackButton = false, backUrl = "/", actions }: AppHeaderProps) {
  return (
    <header className="bg-[#00693C] text-white p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {showBackButton && (
            <Link href={backUrl}>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
          )}
          {icon && <div className="p-2 bg-white/20 rounded-lg">{icon}</div>}
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && <p className="text-white/80 text-sm">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center space-x-2">{actions}</div>}
      </div>
    </header>
  )
}
