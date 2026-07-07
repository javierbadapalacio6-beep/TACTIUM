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

// Email de BIENVENIDA post-lanzamiento. Sustituye al antiguo "estás en el
// waitlist, ya llegará": ahora la app YA está publicada, así que al
// apuntarse el usuario recibe al instante el enlace de descarga.
//
// Estilo sobrio (tipo carta) para caer en Principal y sentirse personal.
// Para máximo Principal, enviar desde un remitente con nombre de persona
// (ej. "Javier de TACTIUM <javier@tactium.io>") cambiando EMAIL_FROM.

export interface WelcomeAppLiveProps {
  to: string;
  siteUrl: string;
  appStoreUrl: string;
}

export function WelcomeAppLive({ to, siteUrl, appStoreUrl }: WelcomeAppLiveProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>Gracias por apuntarte — ya puedes descargar TACTIUM.</Preview>
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
              ¡Hola!
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 1.6, margin: "0 0 16px 0" }}>
              Soy Javier, el fundador de TACTIUM. Gracias por apuntarte. Buenas
              noticias: la app ya está disponible, así que no tienes que esperar
              a nada.
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 1.6, margin: "0 0 16px 0" }}>
              Descárgala aquí:{" "}
              <Link
                href={appStoreUrl}
                style={{ color: "#0a7d57", textDecoration: "underline" }}
              >
                abrir TACTIUM en la App Store
              </Link>
              .
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 1.6, margin: "0 0 16px 0" }}>
              Con TACTIUM montas la alineación de la jornada en menos de un
              minuto, equilibrando parejas por puntos y respetando el orden de
              fuerza de tu federación, y avisas a tu equipo sin perseguir a
              nadie por WhatsApp. Tiene 14 días gratis y los jugadores nunca
              pagan.
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 1.6, margin: "0 0 16px 0" }}>
              Si la pruebas, respóndeme a este correo y cuéntame qué te parece.
              Leo todo personalmente.
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 1.6, margin: "0 0 4px 0" }}>
              Un saludo,
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 1.6, margin: "0 0 24px 0" }}>
              Javier · TACTIUM
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 1.5, color: "#888888", margin: 0 }}>
              Recibes este correo porque te apuntaste en TACTIUM con {to}. Si no
              fuiste tú, ignóralo.{" "}
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

export default WelcomeAppLive;
