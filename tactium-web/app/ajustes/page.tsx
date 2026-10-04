import { redirect } from "next/navigation";

/** `/ajustes` no tiene contenido propio: entra por «Perfil y plan». */
export default function AjustesIndex() {
  redirect("/ajustes/perfil");
}
