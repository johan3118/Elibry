"use client"

import { useState, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Clock } from "lucide-react"

interface TimeFormatToggleProps {
  onChange?: (is24Hour: boolean) => void
}

export function TimeFormatToggle({ onChange }: TimeFormatToggleProps) {
  const [is24Hour, setIs24Hour] = useState(true)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("timeFormat")
      if (saved) {
        const value = saved === "24h"
        setIs24Hour(value)
        onChange?.(value)
      }
    }
  }, [])

  const handleChange = (checked: boolean) => {
    setIs24Hour(checked)
    if (typeof window !== "undefined") {
      localStorage.setItem("timeFormat", checked ? "24h" : "12h")
    }
    onChange?.(checked)
  }

  return (
    <div className="flex items-center space-x-2">
      <Clock className="w-4 h-4 text-gray-500" />
      <Label htmlFor="time-format" className="text-sm text-gray-600">
        AM/PM
      </Label>
      <Switch id="time-format" checked={is24Hour} onCheckedChange={handleChange} />
      <Label htmlFor="time-format" className="text-sm text-gray-600">
        24h
      </Label>
    </div>
  )
}

// Utility function to format time based on preference
export function formatTimeWithPreference(time: string | null | undefined, is24Hour: boolean): string {
  if (!time) return "N/A"

  // If already in 24h format (HH:mm or HH:mm:ss)
  const match24 = time.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (match24) {
    const hours = Number.parseInt(match24[1], 10)
    const minutes = match24[2]

    if (is24Hour) {
      return `${hours.toString().padStart(2, "0")}:${minutes}`
    } else {
      const period = hours >= 12 ? "PM" : "AM"
      const hours12 = hours % 12 || 12
      return `${hours12}:${minutes} ${period}`
    }
  }

  return time
}
