"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Upload, X, ImageIcon } from "lucide-react"

interface ImageUploadProps {
  onImageSelect: (file: File | null) => void
  currentImage?: string
  tipoCliente: "EMPRESA" | "NORMAL"
  disabled?: boolean
}

export function ImageUpload({ onImageSelect, currentImage, tipoCliente, disabled = false }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImage || null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      // Validar tamaño del archivo (máx 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("El archivo es muy grande. Máximo 5MB permitido.")
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        setPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      onImageSelect(file)
    } else {
      alert("Por favor selecciona un archivo de imagen válido")
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setDragActive(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleRemoveImage = () => {
    setPreview(null)
    onImageSelect(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleButtonClick = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  const dimensions = tipoCliente === "EMPRESA" ? "400x200" : "200x200"
  const title = tipoCliente === "EMPRESA" ? "Logo de la Empresa" : "Foto del Cliente"

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">{title}</Label>
        <p className="text-xs text-gray-500 mt-1">
          {tipoCliente === "EMPRESA"
            ? `Dimensiones requeridas: ${dimensions} píxeles`
            : `Dimensiones mínimas: ${dimensions} píxeles`}
        </p>
        <p className="text-xs text-gray-500">Formatos: JPG, PNG, WebP (máx. 5MB)</p>
      </div>

      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${dragActive ? "border-green-500 bg-green-50" : "border-gray-300"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-green-400"}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleButtonClick}
      >
        {preview ? (
          <div className="relative">
            <img
              src={preview || "/placeholder.svg"}
              alt="Preview"
              className={`mx-auto rounded-lg shadow-sm ${
                tipoCliente === "EMPRESA" ? "w-[200px] h-[100px] object-cover" : "w-[100px] h-[100px] object-cover"
              }`}
            />
            {!disabled && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute -top-2 -right-2 rounded-full w-6 h-6 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveImage()
                }}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <ImageIcon className="w-12 h-12 text-gray-400 mx-auto" />
            <div>
              <p className="text-sm text-gray-600">
                {disabled ? "Cargando..." : "Arrastra una imagen aquí o haz clic para seleccionar"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {tipoCliente === "EMPRESA" ? "Logo empresarial" : "Foto del cliente"}
              </p>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {!preview && !disabled && (
        <Button type="button" variant="outline" onClick={handleButtonClick} className="w-full bg-transparent">
          <Upload className="w-4 h-4 mr-2" />
          Seleccionar {tipoCliente === "EMPRESA" ? "Logo" : "Foto"}
        </Button>
      )}
    </div>
  )
}
