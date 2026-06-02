"use client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Phone, Mail } from "lucide-react"

interface MultiContactInputProps {
  type: "phone" | "email"
  values: string[]
  onChange: (values: string[]) => void
  label: string
  placeholder: string
  required?: boolean
  formatFn?: (value: string) => string
}

export function MultiContactInput({
  type,
  values,
  onChange,
  label,
  placeholder,
  required = false,
  formatFn,
}: MultiContactInputProps) {
  const handleAdd = () => {
    onChange([...values, ""])
  }

  const handleRemove = (index: number) => {
    if (values.length > 1) {
      const newValues = values.filter((_, i) => i !== index)
      onChange(newValues)
    }
  }

  const handleChange = (index: number, value: string) => {
    const newValues = [...values]
    newValues[index] = formatFn ? formatFn(value) : value
    onChange(newValues)
  }

  const Icon = type === "phone" ? Phone : Mail

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd} className="h-7 text-xs bg-transparent">
          <Plus className="w-3 h-3 mr-1" />
          Agregar
        </Button>
      </div>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              type={type === "email" ? "email" : "tel"}
              value={value}
              onChange={(e) => handleChange(index, e.target.value)}
              placeholder={placeholder}
              className="flex-1"
              required={required && index === 0}
            />
            {values.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(index)}
                className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
