import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Cómo TACTIUM trata los datos personales de capitanes, jugadores y clubs.",
};

// Placeholder legal — rellenar con texto definitivo antes del release.
// Si recibes leads ANTES de tener este texto definitivo, no envíes
// emails comerciales hasta que esté publicado.
export default function PrivacidadPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-20">
      <Link
        href="/"
        className="font-mono text-[11px] tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition"
      >
        ← VOLVER
      </Link>
      <h1 className="mt-8 text-3xl font-extrabold tracking-tight">
        Política de Privacidad
      </h1>
      <p className="mt-4 text-[var(--color-text-muted)]">
        Última actualización: pendiente · Versión preliminar pre-lanzamiento.
      </p>

      <div className="mt-10 prose-tactium space-y-6 text-[15px] leading-relaxed text-[var(--color-text-muted)]">
        <section>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            1. Responsable
          </h2>
          <p>
            El responsable del tratamiento es TACTIUM. Contacto:{" "}
            <a
              href="mailto:hola@tactium.app"
              className="text-[var(--color-accent)] underline"
            >
              hola@tactium.app
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            2. Datos que recogemos
          </h2>
          <p>
            En esta fase pre-lanzamiento únicamente recogemos tu dirección
            de email cuando te apuntas al waitlist. Almacenamos también
            metadatos técnicos no identificativos (idioma, navegador,
            referrer) para entender por qué canal nos descubres.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            3. Finalidad
          </h2>
          <p>
            Usamos tu email exclusivamente para avisarte del lanzamiento de
            TACTIUM y enviarte un correo de bienvenida. No compartimos los
            datos con terceros más allá de los proveedores estrictamente
            necesarios (Supabase como base de datos, Resend para entrega
            de email).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            4. Derechos
          </h2>
          <p>
            Puedes solicitar acceso, rectificación o supresión de tus datos
            en cualquier momento escribiendo a{" "}
            <a
              href="mailto:hola@tactium.app"
              className="text-[var(--color-accent)] underline"
            >
              hola@tactium.app
            </a>
            .
          </p>
        </section>

        <p className="text-xs text-[var(--color-text-faint)] mt-12">
          Este texto es un borrador pre-lanzamiento. El texto definitivo,
          que incluirá detalle completo sobre tratamiento, transferencias
          internacionales y bases legales, se publicará antes de la apertura
          de la beta privada.
        </p>
      </div>
    </main>
  );
}
