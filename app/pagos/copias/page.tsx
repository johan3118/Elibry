"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Download, Printer, Mail, Copy, Eye } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function CopiasRecibosPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("todos")
  const [selectedRecibos, setSelectedRecibos] = useState<string[]>([])

  // Datos de ejemplo
  const recibos = [
    {
      id: "REC-001",
      numero: "R-2024-001",
      cliente: "María González",
      proyecto: "Villa Marina",
      monto: 50000,
      fecha: "2024-01-15",
      metodo: "Transferencia",
      estado: "Pagado",
      email: "maria@email.com",
    },
    {
      id: "REC-002",
      numero: "R-2024-002",
      cliente: "Carlos Rodríguez",
      proyecto: "Torre Central",
      monto: 75000,
      fecha: "2024-01-14",
      metodo: "Cheque",
      estado: "Pendiente",
      email: "carlos@email.com",
    },
    {
      id: "REC-003",
      numero: "R-2024-003",
      cliente: "Ana Martínez",
      proyecto: "Residencial Norte",
      monto: 30000,
      fecha: "2024-01-13",
      metodo: "Efectivo",
      estado: "Pagado",
      email: "ana@email.com",
    },
  ]

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case "Pagado":
        return <Badge className="bg-green-100 text-green-800">Pagado</Badge>
      case "Pendiente":
        return <Badge className="bg-yellow-100 text-yellow-800">Pendiente</Badge>
      case "Cancelado":
        return <Badge className="bg-red-100 text-red-800">Cancelado</Badge>
      default:
        return <Badge variant="secondary">{estado}</Badge>
    }
  }

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedRecibos(recibos.map((recibo) => recibo.id))
    } else {
      setSelectedRecibos([])
    }
  }

  const handleSelectRecibo = (reciboId: string) => {
    setSelectedRecibos((prevSelectedRecibos) => {
      if (prevSelectedRecibos.includes(reciboId)) {
        return prevSelectedRecibos.filter((id) => id !== reciboId)
      } else {
        return [...prevSelectedRecibos, reciboId]
      }
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center space-x-2">
          <Printer className="w-6 h-6 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-purple-600">Copias de Recibos</h1>
            <p className="text-sm text-gray-500">Generar e imprimir copias de recibos</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6 space-y-6">
        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros de Búsqueda</CardTitle>
            <CardDescription>Busca los recibos para generar copias</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Número, cliente, proyecto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    <SelectItem value="pagado">Pagado</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button className="w-full">
                  <Search className="mr-2 h-4 w-4" />
                  Buscar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Acciones Masivas */}
        {selectedRecibos.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedRecibos.length} recibo(s) seleccionado(s)
                </span>
                <div className="flex gap-2">
                  <Button size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Descargar PDF
                  </Button>
                  <Button size="sm" variant="outline">
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Mail className="mr-2 h-4 w-4" />
                        Enviar por Email
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Enviar Recibos por Email</DialogTitle>
                        <DialogDescription>
                          Envía las copias de los recibos seleccionados por correo electrónico
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="emails">Destinatarios</Label>
                          <Textarea id="emails" placeholder="Ingresa los emails separados por comas..." rows={3} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mensaje">Mensaje</Label>
                          <Textarea id="mensaje" placeholder="Mensaje adicional (opcional)..." rows={4} />
                        </div>
                        <div className="flex gap-2">
                          <Button>
                            <Mail className="mr-2 h-4 w-4" />
                            Enviar
                          </Button>
                          <Button variant="outline">Cancelar</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Recibos */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Recibos</CardTitle>
            <CardDescription>Selecciona los recibos para generar copias</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedRecibos.length === recibos.length}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recibos.map((recibo) => (
                  <TableRow key={recibo.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedRecibos.includes(recibo.id)}
                        onChange={() => handleSelectRecibo(recibo.id)}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{recibo.numero}</TableCell>
                    <TableCell>{recibo.cliente}</TableCell>
                    <TableCell>{recibo.proyecto}</TableCell>
                    <TableCell>RD$ {recibo.monto.toLocaleString()}</TableCell>
                    <TableCell>{recibo.fecha}</TableCell>
                    <TableCell>{getStatusBadge(recibo.estado)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
