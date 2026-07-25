# Elibry — powered by KuboTI's CBrain

This project is built by KuboTI's engineering team and shares its brain (**CBrain**). Read it before non-trivial work.

@~/Developer/CBrain/index.md

- Session start: read the brain index, then this repo's note (`~/Developer/CBrain/projects/elibry.md`) and its linked domain `~/Developer/CBrain/domains/dgii-ecf.md` (fiscal e-CF) and topic `multi-tenancy`.
- Before proposing a spec, plan, or approach: **grep the negative space** — `~/Developer/CBrain/decisions` (rejected alternatives) and `~/Developer/CBrain/mistakes` (prevention rules). Don't re-propose a rejected option or re-walk a logged failure without new evidence.
- Use the `elibry-spec-thinking` / `elibry-architecture-thinking` / `elibry-adversarial-qa` skills (they bind to the brain's thinking notes).
- Learned something durable? File it per `~/Developer/CBrain/meta/how-agents-use-this.md`, or drop a dated note in `~/Developer/CBrain/inbox/`.
- At sprint close, run `~/Developer/CBrain/meta/consolidation.md`.
- Fiscal (NCF / e-CF) correctness is high-stakes → senior + human-gated. Never store secrets or client personal data in the vault.

---

## Project Description: Sistema de Gestión Empresarial (Enterprise Management System)

### Overview

This is a comprehensive **travel agency / tour operator management system** built with Next.js 15, React, TypeScript, Tailwind CSS, and Supabase. The system manages the complete business workflow from client registration through reservations, payments, and invoicing.

---

### Core Modules

#### 1. **Clientes (Clients Module)**

- **Pages**: `/clientes`, `/clientes/registrar`, `/clientes/editar`, `/clientes/ver`, `/clientes/balance`, `/clientes/balance-reserva`
- **Functionality**:

- Register individual clients (PERSONA) or companies (EMPRESA)
- Track client information: identification, contact details, address, referral source
- View client balance and reservation history
- Status management: ACTIVO, INACTIVO

- **Database Table**: `clientes` (34 columns including tipo_cliente, nombre_completo, razon_social, rnc, identificacion, telefonos, email, etc.)

#### 2. **Productos (Products/Services Module)**

- **Pages**: `/productos`, `/productos/registrar`, `/productos/editar`, `/productos/ver`
- **Functionality**:

- Manage travel products/services (hotels, tours, packages)
- Link products to suppliers (suplidores)
- Track product types, contact information, documentation

- **Database Table**: `productos` (27 columns)
- **Related Table**: `tipos_productos` for product categorization

#### 3. **Suplidores (Suppliers Module)**

- **Pages**: `/suplidores`, `/suplidores/registrar`, `/suplidores/editar`, `/suplidores/ver`
- **Functionality**:

- Manage supplier/vendor information
- Track supplier contacts, addresses, documentation
- Status management

- **Database Table**: `suplidores` (25 columns)

#### 4. **Reservas (Reservations Module)**

- **Pages**: `/reservas`, `/reservas/crear`, `/reservas/editar/[id]`, `/reservas/ver/[id]`, `/reservas/pendientes`, `/reservas/seguimiento`
- **Functionality**:

- Create detailed reservations with: client, product, dates, passengers, rooms, pricing
- Multi-line service details with individual pricing
- Track payment limits and supplier expense dates (penalidad dates)
- Status workflow: PENDIENTE → COMPLETADA → ANULADA
- Support for DOP and USD currencies
- Commission tracking, proforma generation, invoice management

- **Database Tables**:

- `reservas` (54 columns - main reservation data)
- `reserva_detalles` (service line items with pricing)

#### 5. **Pagos (Payments Module)**

- **Pages**: `/pagos`, `/pagos/registrar`, `/pagos/buscar`, `/pagos/ver`, `/pagos/copias`
- **Functionality**:

- Register payments against reservations
- Multiple payment methods: cash, transfer, credit card, check
- Generate and print payment receipts
- Track payment status and link to reservations
- Calculate real-time balances (total - paid = pending)

- **Database Table**: `pagos` (31 columns including monto, fecha_pago, metodo_pago, referencia, banco, reserva_id, cliente_id)

#### 6. **CRM (Customer Relationship Management)**

- **Pages**: `/crm`, `/crm/casos`
- **Functionality**:

- Case management for customer support
- Track distributor/customer issues
- Priority levels: BAJA, MEDIA, ALTA, URGENTE
- Status workflow: ABIERTO → EN_PROCESO → CERRADO
- Activity history with comments
- Closing comments when resolving cases

- **Database Tables**:

- `seguimiento_casos` (case tracking)
- `seguimiento_comentarios` (case comments/activity)

#### 7. **Facturación (Invoicing Module)**

- **Pages**: `/facturacion`, `/facturacion/fiscal`, `/facturacion/proforma`, `/facturacion/voucher`, `/facturacion/buscar`, `/facturacion/comprobantes`
- **Functionality**:

- Generate fiscal invoices with NCF (Dominican Republic tax compliance)
- Create proforma invoices
- Generate payment vouchers
- Manage fiscal receipt sequences (comprobantes fiscales)

- **Database Tables**:

- `comprobantes_fiscales`
- `comprobantes_disponibles`

#### 8. **Configuración (Configuration Module)**

- **Pages**: `/configuracion`, `/configuracion/usuarios`, `/configuracion/colaboradores`, `/configuracion/maestros`, `/configuracion/parametros`, `/configuracion/tipos-productos`
- **Functionality**:

- User management with roles (admin, user)
- Collaborator/employee management with commission rates
- Master data tables (dropdown options)
- System parameters
- Product type configuration

- **Database Tables**: `usuarios`, `usuarios_sistema`, `colaboradores`, `datos_maestros`, `parametros_sistema`, `configuracion_empresa`, `permisos_roles`

#### 9. **Reportes (Reports Module)**

- **Pages**: `/reportes`
- **Functionality**: Dashboard with business analytics and metrics

#### 10. **Logs & Audit**

- **Pages**: `/logs`, `/logs/auditoria`, `/logs/rendimiento`
- **Functionality**:

- Audit trail of all system changes
- Performance metrics tracking
- User activity logging

- **Database Tables**: `audit_logs`, `auditoria`, `logs`, `performance_metrics`

#### 11. **Proyectos (Projects Module)**

- **Pages**: `/proyectos`, `/proyectos/pagos`, `/proyectos/buscar-pagos`, `/proyectos/facturas`
- **Functionality**: Project-based payment and invoice tracking

---

### Key Features

1. **Multi-Currency Support**: DOP (Dominican Peso) and USD
2. **Dual Client Types**: Individual (PERSONA) and Corporate (EMPRESA)
3. **Penalty Date Tracking**:

4. `fecha_limite_pago` - Client payment deadline
5. `fecha_gastos_proveedor` - Supplier payment deadline
6. Dashboard alerts for reservations within 5 days of penalty dates

7. **Provisional Changes System**: `cambios_provisionales` and `acciones_pendientes` tables for approval workflows
8. **Document Management**: URL-based document storage for IDs, contracts, receipts
9. **Real-time Balance Calculation**: Payments are summed against reservation totals
10. **Date Format**: DD-MMM-YYYY (e.g., "24-May-2026")
11. **Time Format Toggle**: 12h/24h preference per user

---

### Technical Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **UI**: Tailwind CSS, shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **State**: React useState/useEffect, SWR for data fetching
- **Auth**: User-based authentication with role permissions

---

### Database Schema Summary (29 tables)

- **Core Business**: `clientes`, `productos`, `suplidores`, `reservas`, `reserva_detalles`, `pagos`
- **CRM**: `seguimiento_casos`, `seguimiento_comentarios`
- **Invoicing**: `comprobantes_fiscales`, `comprobantes_disponibles`
- **Configuration**: `usuarios`, `colaboradores`, `datos_maestros`, `parametros_sistema`, `tipos_productos`, `configuracion_empresa`, `permisos_roles`
- **Audit/Logs**: `audit_logs`, `auditoria`, `logs`, `performance_metrics`
- **Workflows**: `cambios_provisionales`, `acciones_pendientes`, `documentos`
- **Views**: `v_comprobantes_disponibles`, `v_comprobantes_fiscales`

## QA command

npm run qa

> Before planning or coding anything, INSPECT the real codebase. Do not trust
> this summary over what the files actually say. Confirm exact file paths,
> the Supabase client setup, the QA command above, and the
> existing data-layer conventions.

## HARD GATES — these are non-negotiable (anti "agent theater")

A task is NOT done unless ALL of these are true and shown as evidence:

- Real diff produced (paste the actual changed lines, no summaries-as-proof).
- The project's real test/lint/typecheck commands were RUN, with output shown.
- No files outside the task's declared scope were changed.
- RLS / org isolation was not weakened. Any new table has an RLS policy.
- Optimistic-UI changes include rollback-on-error.
- A one-line rollback note (how to revert this task).

If a command "would" pass but wasn't actually run, the task is FAILED.
Never write "looks good", "robust", or "all edge cases handled" without evidence.

## Workflow rules

- One task at a time. Do not start task N+1 until task N passes QA.
- Do not expand scope. New ideas go in a backlog note, not into the diff.
- Do not change architecture without the architect's sign-off.
- Surface to the human ONLY at: spec approval, sprint completion, or a genuine
  fork in the road (ambiguous product decision, payment/auth/destructive DB op).
  Everything else, decide and proceed.

## Sprint validation (enforced at summary time)

The lead MUST NOT produce a sprint summary until:

- Every task has a matching QA report quoted verbatim in the transcript
- Every QA report shows Verdict: PASS
- The lead has NOT edited any source file directly

A sprint summary produced without these three conditions is automatically
rejected. The human will ask for the missing QA reports before accepting
the sprint.
