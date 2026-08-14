/**
 * Empresa (Company) Information — PLACEHOLDER
 *
 * PLACEHOLDER-EMPRESA-SETTINGS: These values are hardcoded placeholders pending
 * a Configuración/settings-driven source. They must be replaced by a real config
 * read in a future backlog item (B-24: wire empresa data from configuracion_empresa).
 *
 * schema-source-of-truth: `configuracion_empresa` is referenced **only** in:
 *   - CLAUDE.md:134
 *   - CLAUDE.md:192
 *   - docs/plans/recibo-escape-and-input-guards.md:684
 *
 * Zero code paths currently read this table. Wiring a live read requires explicit
 * `information_schema` verification this sprint does not have. Do not assume the
 * table exists or its schema matches any doc claim.
 *
 * TODO (B-24): Replace with a config layer once configuracion_empresa is verified
 * to exist and contains the required columns (nombre, direccion, telefono, email).
 */

export interface EmpresaInfo {
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
}

export const EMPRESA_PLACEHOLDER: EmpresaInfo = {
  nombre: "Grupo Ellibry",
  direccion: "Santo Domingo, República Dominicana",
  telefono: "(809) 123-4567",
  email: "info@grupoellibry.com",
};
