# Backlog B-24: Wire Empresa (Company) Data from Placeholders to Settings

**Status:** Scoped for future work. Documented as part of T9.
**Depends on:** Real `configuracion_empresa` table verification (live `information_schema` query, not yet done).

---

## 1. Placeholder Values — Current Source

### Location: `lib/empresa-info.ts`

The four placeholder values currently live in one module and are wired to both recibo renderers:

```typescript
export const EMPRESA_PLACEHOLDER: EmpresaInfo = {
  nombre: "Grupo Ellibry",
  direccion: "Santo Domingo, República Dominicana",
  telefono: "(809) 123-4567",
  email: "info@grupoellibry.com",
};
```

**Single source of truth:** `lib/empresa-info.ts:28-33`.

### Real Consumers (Verified via `grep -rn "EMPRESA_PLACEHOLDER" app/ components/ lib/`)

1. **RECIBO renderer** (`generateReciboHTML` in `lib/document-generator.tsx`)
   - Call site: `app/pagos/buscar/page.tsx:225`
   - Passes `empresa: EMPRESA_PLACEHOLDER` to `regenerarRecibo()`

2. **PaymentReceipt renderer** (the dialog component)
   - Call site: `app/reservas/ver/[id]/page.tsx:983`
   - Passes `empresa={EMPRESA_PLACEHOLDER}` directly to the component

**Architectural pattern (must be preserved in the future):** Page-level call sites (`app/pagos/buscar/page.tsx` and `app/reservas/ver/[id]/page.tsx`) import the constant and pass it in as a prop. The **renderers** (`generateReciboHTML` and `PaymentReceipt`) remain pure and data-driven — they never import `EMPRESA_PLACEHOLDER` directly. This separation allows the renderers to stay testable in isolation and avoids baking a settings dependency into the rendering logic itself.

---

## 2. The Conflict — Real Company Data Already Exists

### VOUCHER/CONFIRMACIÓN Footer (Hardcoded)

Location: `lib/document-generator.tsx:1599-1604`

```html
<div class="contact-footer">
  <div class="contact-logo"></div>
  <div>
    <strong>Dirección:</strong> Avenida Jacobo Majluta, Plaza Toledo, Piso 1, Local 106, Arroyo Hondo, Distrito Nacional, Sto. Dgo.<br>
    <strong>Contactos:</strong> 809•537•4070 • 849•252•2022 / 809•882•5675 / <strong>Email:</strong> servicio@grupoellibry.com<br>
    <strong>RNC:</strong> 132739622 / <strong>Instagram:</strong> @grupoellibry / <strong>Pag. Web:</strong> grupoellibry.com
  </div>
</div>
```

### Recibo Placeholders (Current, from `lib/empresa-info.ts`)

| Field | Recibo Placeholder | VOUCHER/CONFIRMACIÓN Footer |
|---|---|---|
| **Nombre/Razón Social** | Grupo Ellibry | Grupo Ellibry ✓ matches |
| **Dirección** | Santo Domingo, República Dominicana | Avenida Jacobo Majluta, Plaza Toledo, Piso 1, Local 106, Arroyo Hondo, Distrito Nacional, Sto. Dgo. |
| **Teléfono** | (809) 123-4567 | 809•537•4070 • 849•252•2022 / 809•882•5675 |
| **Email** | info@grupoellibry.com | servicio@grupoellibry.com |
| **RNC** | (not in recibo placeholders) | 132739622 |

### Human Decision Required

**These two sets of data are inconsistent and a human must choose which is canonical before implementing B-24.** This document does **NOT** decide which values are correct — that is a product/business ruling that must come from the human stakeholder. Both are currently hardcoded in production code. The recibo is using placeholders; the VOUCHER and CONFIRMACIÓN are using (presumably) real business data.

**Recommended approach:** Clarify with the business owner:
- Are the VOUCHER/CONFIRMACIÓN values (with the full address and multiple phone numbers) the correct, up-to-date company information?
- Or are the recibo placeholders a deliberate stub pending a future configuration flow?
- Once decided, **that set of values becomes the canonical source**, and both the RECIBO renderers and the VOUCHER/CONFIRMACIÓN footer are updated to read from a single settings/configuration source.

---

## 3. Schema Source-of-Truth: `configuracion_empresa` Does Not Exist Verified

### Claim

The table `configuracion_empresa` is referenced in documentation only — it is **not** read by any live code path in this repository.

### Evidence

**Grep for `configuracion_empresa` in code (`lib/`, `app/`, `components/`):**

```
lib/empresa-info.ts:6: * read in a future backlog item (B-24: wire empresa data from configuracion_empresa).
lib/empresa-info.ts:8: * schema-source-of-truth: `configuracion_empresa` is referenced **only** in:
lib/empresa-info.ts:17: * TODO (B-24): Replace with a config layer once configuracion_empresa is verified
```

**Result:** Zero code paths. Only comments mentioning it.

**Grep for `configuracion_empresa` in documentation:**

```
CLAUDE.md:134
CLAUDE.md:192
docs/plans/recibo-escape-and-input-guards.md:684
```

**Result:** Three references, all in documentation listing tables. No live wire.

### Implication

**`configuracion_empresa` must not be assumed to exist.** Its presence, schema, and columns are **unverified** and exist only as documentation claims in `CLAUDE.md` (which is acknowledged as stale). Any implementation of B-24 must **begin with a live `information_schema` query** to verify:

1. The table exists.
2. It has the required columns: `nombre`, `direccion`, `telefono`, `email` (at minimum).
3. The schema matches the business's current configuration needs.
4. Appropriate indexes exist if this is a frequently-read configuration.

**Do not invent a schema. Verify it against the live database first.**

---

## 4. Concrete Follow-Up Work: B-24

### 4.1 Configuration Storage (UNVERIFIED — Choose One)

Two options are open; **both require verification before coding**:

**Option A: Dedicated `configuracion_empresa` table**
- Requires: DDL (create table, add RLS policy per ADR-0006, possibly add indexes).
- Benefit: Clean separation of concerns; company info is not mixed with parameter settings.
- Risk: New table means new RLS responsibility and schema-drift risk (the reason this was pushed to B-24 in the first place).

**Option B: Reuse `parametros_sistema`**
- Requires: Add a few rows (`nombre`, `direccion`, `telefono`, `email` as keys, or store a JSON blob).
- Benefit: No new table; one existing configuration mechanism.
- Risk: `parametros_sistema` is designed for miscellaneous settings; lumping company info into it may create a mixed-concern table.

**Neither has been chosen.** The implementer must propose one and justify it.

### 4.2 Read Path

A new library module (similar to `lib/empresa-info.ts` in structure, but data-driven) will:

1. Call Supabase to fetch the company configuration (once, cached in state or via SWR).
2. Return the same `EmpresaInfo` shape that `EMPRESA_PLACEHOLDER` has today.
3. Handle the error case gracefully: if the read fails or the settings are missing, fall back to the placeholder (or return null and let callers handle it).

This read must happen **upstream** of the page-level call sites — either in a context provider, a custom hook, or in the individual page's `getServerSideProps`/`useEffect`.

### 4.3 Configuración UI

A new page or section in the Configuración module (`/configuracion` or `/configuracion/empresa-info`) that allows an admin to:

1. View the current company data.
2. Edit all four fields (and possibly RNC, if that is added to the schema).
3. Save changes.
4. See a confirmation message.

This UI must be in the **same access zone** as the rest of `/configuracion` (which is itself not formally access-controlled in this repo — see §4.4 below).

### 4.4 Permission Model (ADR-0011: No Auth / No RLS Today)

**Blocker:** Elibry currently has **no authentication and no RLS** (ADR-0011). Every page assumes a single user/tenant scenario. The `/configuracion` section is not protected by a formal role-check.

**Consequence:** "Who may edit company settings?" cannot be answered in an enforceable way today. Any edit permission is moot without auth/RLS.

**Recommendation:**
- **Implement B-24 assuming a single responsible admin can edit.**
- Document the permission model as a **non-goal for this backlog item** (the broader org isolation and auth story is a separate architectural effort, possibly B-26 or beyond).
- When Elibry gains auth/RLS (future ADR update), the Configuración UI can be updated to check appropriate roles before allowing the edit form.

For now, **do not invent a permission model that has no enforcement mechanism.** Say plainly: "Any user who can access `/configuracion/empresa-info` can edit the company data" and mark it UNVERIFIED.

---

## 5. Backlog Item Summary

| Task | Owner | Notes |
|---|---|---|
| Verify `configuracion_empresa` table exists (or choose Option B) | Senior dev / DBA | Live `information_schema` query required. No schema as fact. |
| Propose and implement storage (DDL if table is created; RLS policy required per ADR-0006) | Senior dev / DBA | DDL is out of scope for a junior task. |
| Write the data-driven read path (a new library module, similar to `lib/empresa-info.ts`) | Junior dev | After storage is decided and table/schema is verified. |
| Add a Configuración UI form | Junior dev | Standard CRUD; copy pattern from existing `/configuracion/maestros` or similar. |
| Decide: hardcoded VOUCHER/CONFIRMACIÓN footer or wire it to settings too? | Product/Business | Separate decision from this backlog item. See §2 conflict. |
| **Authority:** Is Elibry gaining auth/RLS before B-24 ships, or after? | Architect | Determines whether permission checks are added to the Configuración UI. |

---

## 6. What Was NOT Invented Here

- No fabricated table schema.
- No invented company data (the conflict in §2 is documented as a human-choice question, not settled).
- No permission model that has no enforcement.
- No assumption that `configuracion_empresa` exists without verification.

Every claim in this document is either:
- Quoted exactly from source code (`lib/empresa-info.ts`, `lib/document-generator.tsx`), or
- A verified grep result (call sites, documentation references), or
- Marked explicitly as **UNVERIFIED** (the Option A vs Option B choice, the permission model).

---

## 7. References

- **Task that created this:** T9 of sprint "live-balance-recibo-form-fixes"
- **Plan document:** `docs/plans/live-balance-recibo-form-fixes.md` (§8.4, §9 B-24)
- **Related ADRs:** ADR-0006 (RLS on new tables), ADR-0011 (no auth yet), ADR-0012 (FISCAL constraint)
- **Code locations:** 
  - `lib/empresa-info.ts` (placeholders)
  - `app/pagos/buscar/page.tsx:225` (RECIBO caller)
  - `app/reservas/ver/[id]/page.tsx:983` (PaymentReceipt caller)
  - `lib/document-generator.tsx:1599-1604` (VOUCHER/CONFIRMACIÓN footer)
