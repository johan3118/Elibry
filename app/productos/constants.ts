// Shared constants/helpers for the Productos module.
//
// Extracted so `registrar/page.tsx` (CREATE) and `editar/page.tsx` (EDIT)
// never diverge again on the option sets they offer for `tipo` and `pais`
// (see Pr1 / Pr2 in the field-parity audit). Both forms MUST import these
// exact arrays instead of keeping their own local copies.

export interface TipoProductoOption {
  value: string
  label: string
}

// Canonical `tipo` values, identical in registrar/page.tsx and
// editar/page.tsx. "OTRO" is the canonical catch-all value going forward.
//
// A previous version of editar/page.tsx offered "OTROS" instead of "OTRO"
// as its catch-all value, so some existing rows may still have
// tipo === "OTROS". `normalizeTipo` below maps that legacy value onto
// "OTRO" when a record is loaded, so it renders as a valid selection
// instead of blank in the dropdown.
export const TIPOS_PRODUCTO: TipoProductoOption[] = [
  { value: "HOTEL", label: "Hotel" },
  { value: "EXCURSION", label: "Excursión" },
  { value: "TRANSPORTE", label: "Transporte" },
  { value: "RESTAURANTE", label: "Restaurante" },
  { value: "PAQUETE", label: "Paquete" },
  { value: "OTRO", label: "Otro" },
]

/**
 * Normalizes a stored `tipo` value that may no longer be offered in the
 * dropdown (legacy data) into the closest canonical value from
 * `TIPOS_PRODUCTO`, so it never renders blank in an editing form.
 */
export function normalizeTipo(tipo: string | null | undefined): string {
  if (!tipo) return ""
  if (tipo === "OTROS") return "OTRO"
  return tipo
}

// Canonical `pais` list, identical in registrar/page.tsx and
// editar/page.tsx. Includes "Puerto Rico" (already offered elsewhere in
// the system, e.g. app/suplidores/{registrar,editar}, and previously
// selectable from productos/editar's shorter list) so existing products
// keep rendering correctly instead of going blank after unification.
export const COUNTRIES = [
  "Afganistán","Albania","Alemania","Andorra","Angola","Antigua y Barbuda","Arabia Saudita","Argelia","Argentina","Armenia","Australia","Austria","Azerbaiyán","Bahamas","Bangladés","Barbados","Baréin","Bélgica","Belice","Benín","Bielorrusia","Birmania","Bolivia","Bosnia y Herzegovina","Botsuana","Brasil","Brunéi","Bulgaria","Burkina Faso","Burundi","Bután","Cabo Verde","Camboya","Camerún","Canadá","Catar","Chad","Chile","China","Chipre","Colombia","Comoras","Corea del Norte","Corea del Sur","Costa de Marfil","Costa Rica","Croacia","Cuba","Dinamarca","Dominica","Ecuador","Egipto","El Salvador","Emiratos Árabes Unidos","Eritrea","Eslovaquia","Eslovenia","España","Estados Unidos","Estonia","Esuatini","Etiopía","Filipinas","Finlandia","Fiyi","Francia","Gabón","Gambia","Georgia","Ghana","Granada","Grecia","Guatemala","Guinea","Guinea Ecuatorial","Guinea-Bisáu","Guyana","Haití","Honduras","Hungría","India","Indonesia","Irak","Irán","Irlanda","Islandia","Islas Marshall","Islas Salomón","Israel","Italia","Jamaica","Japón","Jordania","Kazajistán","Kenia","Kirguistán","Kiribati","Kuwait","Laos","Lesoto","Letonia","Líbano","Liberia","Libia","Liechtenstein","Lituania","Luxemburgo","Madagascar","Malasia","Malaui","Maldivas","Malí","Malta","Marruecos","Mauricio","Mauritania","México","Micronesia","Moldavia","Mónaco","Mongolia","Montenegro","Mozambique","Namibia","Nauru","Nepal","Nicaragua","Níger","Nigeria","Noruega","Nueva Zelanda","Omán","Países Bajos","Pakistán","Palaos","Panamá","Papúa Nueva Guinea","Paraguay","Perú","Polonia","Portugal","Puerto Rico","Reino Unido","República Centroafricana","República Checa","República del Congo","República Democrática del Congo","República Dominicana","Ruanda","Rumanía","Rusia","Samoa","San Cristóbal y Nieves","San Marino","San Vicente y las Granadinas","Santa Lucía","Santo Tomé y Príncipe","Senegal","Serbia","Seychelles","Sierra Leona","Singapur","Siria","Somalia","Sri Lanka","Sudáfrica","Sudán","Sudán del Sur","Suecia","Suiza","Surinam","Tailandia","Tanzania","Tayikistán","Timor Oriental","Togo","Tonga","Trinidad y Tobago","Túnez","Turkmenistán","Turquía","Tuvalu","Ucrania","Uganda","Uruguay","Uzbekistán","Vanuatu","Venezuela","Vietnam","Yemen","Yibuti","Zambia","Zimbabue",
]

/**
 * Normalizes a stored `pais` value that used a different label under the
 * old editar/page.tsx list ("Holanda") into the canonical label used by
 * `COUNTRIES` ("Países Bajos"), so it never renders blank in an editing
 * form.
 */
export function normalizePais(pais: string | null | undefined): string {
  if (!pais) return ""
  if (pais === "Holanda") return "Países Bajos"
  return pais
}

/**
 * Extracts the contact name from the combined `contactos` string, which is
 * built as `"<nombre> - Tel: <telefonos>[, ...][ - Email: <emails>]"`.
 *
 * Splits on the literal " - Tel:" delimiter (instead of the first "-"
 * character) so contact names containing a hyphen (e.g. "Jean-Pierre")
 * survive the round trip instead of being truncated at the hyphen.
 */
export function extractContactName(contactos: string | null | undefined): string {
  if (!contactos) return ""
  const match = contactos.match(/^(.*?)\s-\sTel:/)
  if (match) return match[1].trim()
  // Fallback for any legacily-stored string that doesn't follow the
  // "<nombre> - Tel: ..." format (should not happen for new records).
  return contactos.trim()
}
