import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

// Variante SOBRIA del email de lanzamiento — estilo "carta del fundador".
// Diseñada para caer en la pestaña Principal (no Promociones): fondo claro,
// sin imágenes, sin botones tipo banner, un único enlace de texto y tono
// personal. Cuanto menos "marketing" parezca, mejor clasifica Gmail.
//
// Para maximizar Principal, enviar además desde un remitente con nombre de
// persona (ej. "Javier de TACTIUM <javier@tactium.io>") cambiando EMAIL_FROM.

export interface LaunchIOSPlainProps {
  to: string;
  siteUrl: string;
  appStoreUrl: string;
}

export function LaunchIOSPlain({ to, siteUrl, appStoreUrl }: LaunchIOSPlainProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>Ya puedes descargar TACTIUM en la App Store.</Preview>
      <Body
        style={{
          backgroundColor: "#ffffff",
          color: "#1a1a1a",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
          margin: 0,
          padding: "24px 16px",
        }}
      >
        <Container style={{ maxWidth: 520, margin: "0 auto" }}>
          <Section>
            <Text style={{ fontSize: 16, lineHeight: 1.6, margin: "0 0 16px 0" }}>
              Hola,
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 1.6, margin: "0 0 16px 0" }}>
              Soy Javier, el fundador de TACTIUM. Te apuntaste a la lista de
              espera hace un tiempo, así que quería avisarte el primero: la app
              ya está disponible en la App Store.
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 1.6, margin: "0 0 16px 0" }}>
              Puedes descargarla aquí:{" "}
              <Link
                href={appStoreUrl}
                style={{ color: "#0a7d57", textDecoration: "underline" }}
              >
                abrir TACTIUM en la App Store
              </Link>
              .
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 1.6, margin: "0 0 16px 0" }}>
              Es la herramienta que me hubiera gustado tener cuando era capitán:
              montas la alineación de la jornada en menos de un minuto,
              equilibrando parejas por puntos y respetando el orden de fuerza de
              tu federación, y avisas a tu equipo sin perseguir a nadie por
              WhatsApp. Tiene 14 días gratis y los jugadores nunca pagan.
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 1.6, margin: "0 0 16px 0" }}>
              Si la pruebas y te sirve, me harías un favor enorme dejando una
              reseña o respondiendo a este correo con lo que mejorarías. Leo
              todo personalmente.
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 1.6, margin: "0 0 4px 0" }}>
              Gracias por la paciencia,
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 1.6, margin: "0 0 24px 0" }}>
              Javier · TACTIUM
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 1.5, color: "#888888", margin: 0 }}>
              Recibes este correo porque te apuntaste a la lista de espera de
              TACTIUM con {to}. Si no fuiste tú, ignóralo.{" "}
              <Link href={siteUrl} style={{ color: "#888888" }}>
                tactium.io
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default LaunchIOSPlain;
