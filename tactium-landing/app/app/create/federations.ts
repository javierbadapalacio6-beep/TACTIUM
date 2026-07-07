// Copia web del listado de federaciones (espejo de
// TACTIUM/src/core/data/federations.ts). Se duplica aquí porque `lib/` es
// zona compartida intocable; mantener en sync con el móvil si cambia.
export interface Federation {
  code: string;
  name: string;
  shortName: string;
  region: string;
}

export type TeamGender = "masculino" | "femenino" | "mixto";

// Listado mostrado al usuario al crear equipo/club. No incluye la FEP
// nacional (las ligas oficiales se juegan bajo la federación autonómica).
export const FEDERATIONS: Federation[] = [
  { code: "FAP", name: "Federación Andaluza de Pádel", shortName: "FAP", region: "Andalucía" },
  { code: "FAraP", name: "Federación Aragonesa de Pádel", shortName: "FAraP", region: "Aragón" },
  { code: "FPPA", name: "Federación de Pádel del Principado de Asturias", shortName: "FPPA", region: "Asturias" },
  { code: "FBP", name: "Federació Balear de Pàdel", shortName: "FBP", region: "Illes Balears" },
  { code: "FCanP", name: "Federación Canaria de Pádel", shortName: "FCanP", region: "Canarias" },
  { code: "FCantP", name: "Federación Cántabra de Pádel", shortName: "FCantP", region: "Cantabria" },
  { code: "FPCLM", name: "Federación de Pádel de Castilla-La Mancha", shortName: "FPCLM", region: "Castilla-La Mancha" },
  { code: "FPCyL", name: "Federación de Pádel de Castilla y León", shortName: "FPCyL", region: "Castilla y León" },
  { code: "FCatP", name: "Federació Catalana de Pàdel", shortName: "FCatP", region: "Cataluña" },
  { code: "FExP", name: "Federación Extremeña de Pádel", shortName: "FExP", region: "Extremadura" },
  { code: "FGP", name: "Federación Galega de Pádel", shortName: "FGP", region: "Galicia" },
  { code: "FMP", name: "Federación Madrileña de Pádel", shortName: "FMP", region: "Comunidad de Madrid" },
  { code: "FMurP", name: "Federación de Pádel de la Región de Murcia", shortName: "FMurP", region: "Región de Murcia" },
  { code: "FNP", name: "Federación Navarra de Pádel", shortName: "FNP", region: "Navarra" },
  { code: "EPF", name: "Euskadiko Pádel Federazioa", shortName: "EPF", region: "País Vasco" },
  { code: "FRP", name: "Federación Riojana de Pádel", shortName: "FRP", region: "La Rioja" },
  { code: "FPCV", name: "Federació de Pàdel de la Comunitat Valenciana", shortName: "FPCV", region: "Comunitat Valenciana" },
  { code: "FPCe", name: "Federación de Pádel de Ceuta", shortName: "FPCe", region: "Ceuta" },
  { code: "FPMe", name: "Federación de Pádel de Melilla", shortName: "FPMe", region: "Melilla" },
];

export const CATS = ["1ª", "2ª", "3ª", "4ª", "5ª", "6ª", "7ª", "8ª", "9ª", "10ª"];
export const GROUPS = ["A", "B", "C", "D"];
export const GENDERS: { id: TeamGender; label: string }[] = [
  { id: "masculino", label: "Masculino" },
  { id: "femenino", label: "Femenino" },
  { id: "mixto", label: "Mixto" },
];
