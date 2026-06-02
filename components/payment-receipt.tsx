"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Printer } from "lucide-react"

interface PaymentReceiptProps {
  pago: {
    id: number
    monto: number
    moneda: string
    metodo_pago: string
    concepto?: string
    referencia?: string
    fecha_pago: string
    registrado_por?: string
  }
  reserva: {
    codigo: string
    balance_reserva: number
    balance_abonado: number
    balance_general: number
  }
  cliente: {
    nombre: string
    identificacion?: string
    telefono?: string
    email?: string
  }
  onClose?: () => void
}

export function PaymentReceipt({ pago, reserva, cliente, onClose }: PaymentReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null)

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: currency === "DOP" ? "DOP" : "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      fecha: date.toLocaleDateString("es-DO", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      hora: date.toLocaleTimeString("es-DO", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    }
  }

  const handlePrint = () => {
    const printContent = receiptRef.current
    if (!printContent) return

    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Recibo de Pago - ${reserva.codigo}</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 20px;
              max-width: 400px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
              margin-bottom: 20px;
            }
            .header h1 {
              font-size: 18px;
              margin: 0;
              color: #333;
            }
            .header p {
              font-size: 12px;
              color: #666;
              margin: 5px 0;
            }
            .section {
              margin-bottom: 15px;
            }
            .section-title {
              font-size: 12px;
              font-weight: bold;
              color: #666;
              margin-bottom: 5px;
              text-transform: uppercase;
            }
            .row {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
              font-size: 13px;
            }
            .row.total {
              border-top: 1px solid #333;
              margin-top: 10px;
              padding-top: 10px;
              font-weight: bold;
              font-size: 16px;
            }
            .amount-paid {
              color: #059669;
              font-size: 24px;
              text-align: center;
              font-weight: bold;
              margin: 20px 0;
              padding: 15px;
              background: #ecfdf5;
              border-radius: 8px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 15px;
              border-top: 1px dashed #ccc;
              font-size: 11px;
              color: #666;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const { fecha, hora } = formatDateTime(pago.fecha_pago)

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg text-blue-600">Recibo de Pago</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" />
              Imprimir
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={receiptRef}>
          {/* Header */}
          <div className="header text-center border-b-2 border-gray-800 pb-4 mb-4">
            <h1 className="text-xl font-bold text-gray-800">RECIBO DE PAGO</h1>
            <p className="text-sm text-gray-600">No. {pago.id.toString().padStart(6, "0")}</p>
            <p className="text-xs text-gray-500">Reserva: {reserva.codigo}</p>
          </div>

          {/* Fecha y Hora */}
          <div className="section bg-gray-50 p-3 rounded-md mb-4">
            <div className="row flex justify-between text-sm">
              <span className="text-gray-600">Fecha:</span>
              <span className="font-medium">{fecha}</span>
            </div>
            <div className="row flex justify-between text-sm">
              <span className="text-gray-600">Hora:</span>
              <span className="font-medium">{hora}</span>
            </div>
          </div>

          {/* Monto Pagado */}
          <div className="amount-paid text-center bg-green-50 p-4 rounded-lg mb-4">
            <p className="text-xs text-green-600 uppercase font-medium">Monto Pagado</p>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(pago.monto, pago.moneda)}</p>
          </div>

          {/* Datos del Cliente */}
          <div className="section mb-4">
            <p className="section-title text-xs font-bold text-gray-500 uppercase mb-2">Datos del Cliente</p>
            <div className="row flex justify-between text-sm">
              <span className="text-gray-600">Nombre:</span>
              <span className="font-medium">{cliente.nombre}</span>
            </div>
            {cliente.identificacion && (
              <div className="row flex justify-between text-sm">
                <span className="text-gray-600">Identificación:</span>
                <span className="font-medium">{cliente.identificacion}</span>
              </div>
            )}
          </div>

          {/* Detalles del Pago */}
          <div className="section mb-4">
            <p className="section-title text-xs font-bold text-gray-500 uppercase mb-2">Detalles del Pago</p>
            <div className="row flex justify-between text-sm">
              <span className="text-gray-600">Método:</span>
              <span className="font-medium">{pago.metodo_pago || "N/A"}</span>
            </div>
            {pago.referencia && (
              <div className="row flex justify-between text-sm">
                <span className="text-gray-600">Referencia:</span>
                <span className="font-medium">{pago.referencia}</span>
              </div>
            )}
            <div className="row flex justify-between text-sm">
              <span className="text-gray-600">Concepto:</span>
              <span className="font-medium">{pago.concepto || "Pago de reserva"}</span>
            </div>
          </div>

          {/* Resumen de la Reserva */}
          <div className="section border-t pt-4">
            <p className="section-title text-xs font-bold text-gray-500 uppercase mb-2">Resumen de Reserva</p>
            <div className="row flex justify-between text-sm">
              <span className="text-gray-600">Total Reserva:</span>
              <span className="font-medium">{formatCurrency(reserva.balance_reserva, pago.moneda)}</span>
            </div>
            <div className="row flex justify-between text-sm text-green-600">
              <span>Total Abonado:</span>
              <span className="font-medium">{formatCurrency(reserva.balance_abonado, pago.moneda)}</span>
            </div>
            <div className="row total flex justify-between text-base font-bold border-t pt-2 mt-2">
              <span>Saldo Pendiente:</span>
              <span className="text-orange-600">{formatCurrency(reserva.balance_general, pago.moneda)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="footer text-center mt-6 pt-4 border-t border-dashed border-gray-300">
            <p className="text-xs text-gray-500">Atendido por: {pago.registrado_por || "Sistema"}</p>
            <p className="text-xs text-gray-400 mt-2">Gracias por su preferencia</p>
            <p className="text-xs text-gray-400">Este documento es un comprobante de pago válido</p>
          </div>
        </div>

        {onClose && (
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
