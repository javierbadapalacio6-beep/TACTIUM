import { redirect } from "next/navigation";

/** `/ajustes` no tiene contenido propio: entra por la primera sección. */
export default function AjustesIndex() {
  redirect("/ajustes/apariencia");
}
