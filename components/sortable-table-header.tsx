"use client"

import { Button } from "@/components/ui/button"
import { TableHead } from "@/components/ui/table"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"

interface SortableTableHeaderProps {
  label: string
  field: string
  currentSort: string | null
  currentDirection: "asc" | "desc"
  onSort: (field: string) => void
  className?: string
}

export function SortableTableHeader({
  label,
  field,
  currentSort,
  currentDirection,
  onSort,
  className = "",
}: SortableTableHeaderProps) {
  const isActive = currentSort === field

  return (
    <TableHead className={`whitespace-nowrap ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 -ml-2 font-semibold hover:bg-gray-100"
        onClick={() => onSort(field)}
      >
        {label}
        {isActive ? (
          currentDirection === "asc" ? (
            <ChevronUp className="ml-1 h-4 w-4" />
          ) : (
            <ChevronDown className="ml-1 h-4 w-4" />
          )
        ) : (
          <ChevronsUpDown className="ml-1 h-4 w-4 opacity-50" />
        )}
      </Button>
    </TableHead>
  )
}
