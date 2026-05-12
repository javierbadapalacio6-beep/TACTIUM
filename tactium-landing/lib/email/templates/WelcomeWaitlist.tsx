import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";

// Email de bienvenida cuando alguien se apunta al waitlist desde la
// landing. Diseño dark (mismo accent verde TACTIUM) y minimalista —
// muchos clientes (Outlook, modos dark de Gmail) no respetan CSS
// completo, así que usamos inline styles y colores sólidos.

const COLOR_BG = "#030F0F";
const COLOR_CARD = "#0C2222";
const COLOR_ACCENT = "#00DF82";
const COLOR_TEXT = "#E8F5EF";
const COLOR_MUTED = "rgba(232, 245, 239, 0.70)";
const COLOR_HAIR = "rgba(232, 245, 239, 0.10)";

export interface WelcomeWaitlistProps {
  // Email del usuario (sólo para personalización suave en el copy).
  to: string;
  // URL absoluta del sitio, para enlace de FAQ / share.
  siteUrl: string;
}

export function WelcomeWaitlist({ to, siteUrl }: WelcomeWaitlistProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>
        Estás dentro · TACTIUM te avisa cuando lancemos
      </Preview>
      <Body
        style={{
          backgroundColor: COLOR_BG,
          color: COLOR_TEXT,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif",
          margin: 0,
          padding: "32px 16px",
        }}
      >
        <Container
          style={{
            backgroundColor: COLOR_CARD,
            borderRadius: 16,
            border: `1px solid ${COLOR_HAIR}`,
            maxWidth: 560,
            margin: "0 auto",
            padding: "32px 28px",
          }}
        >
          {/* Eyebrow + logo simulado en texto */}
          <Section style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontFamily:
                  "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, monospace",
                fontSize: 11,
                letterSpacing: "0.25em",
                color: COLOR_ACCENT,
                margin: 0,
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              T · TACTIUM
            </Text>
          </Section>

          <Heading
            style={{
              color: COLOR_TEXT,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.5px",
              lineHeight: 1.15,
              margin: "0 0 14px 0",
            }}
          >
            Estás dentro.
          </Heading>

          <Text
            style={{
              color: COLOR_MUTED,
              fontSize: 16,
              lineHeight: 1.6,
              margin: "0 0 24px 0",
            }}
          >
            Acabas de apuntarte al pre-lanzamiento de <strong style={{ color: COLOR_TEXT }}>TACTIUM</strong> con la dirección{" "}
            <strong style={{ color: COLOR_TEXT }}>{to}</strong>.
          </Text>

          <Text
            style={{
              color: COLOR_MUTED,
              fontSize: 16,
              lineHeight: 1.6,
              margin: "0 0 24px 0",
            }}
          >
            Te avisaremos en cuanto la app esté disponible en App Store
            y Google Play. Los primeros 100 inscritos tienen{" "}
            <strong style={{ color: COLOR_ACCENT }}>30 días de prueba gratis</strong>{" "}
            (en vez de los 14 estándar) — quédate atento al correo.
          </Text>

          <Hr
            style={{
              border: "none",
              borderTop: `1px solid ${COLOR_HAIR}`,
              margin: "28px 0 24px 0",
            }}
          />

          <Text
            style={{
              fontFamily:
                "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, monospace",
              fontSize: 11,
              letterSpacing: "0.2em",
              color: COLOR_ACCENT,
              margin: "0 0 12px 0",
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            Mientras esperas
          </Text>

          <Text
            style={{
              color: COLOR_MUTED,
              fontSize: 15,
              lineHeight: 1.6,
              margin: "0 0 8px 0",
            }}
          >
            ·{" "}
            <Link
              href={`${siteUrl}#features`}
              style={{ color: COLOR_ACCENT, textDecoration: "none" }}
            >
              Mira qué incluye
            </Link>{" "}
            (alineaciones, variantes, multi-equipo).
          </Text>
          <Text
            style={{
              color: COLOR_MUTED,
              fontSize: 15,
              lineHeight: 1.6,
              margin: "0 0 8px 0",
            }}
          >
            ·{" "}
            <Link
              href={`${siteUrl}#precios`}
              style={{ color: COLOR_ACCENT, textDecoration: "none" }}
            >
              Echa un vistazo a los planes
            </Link>{" "}
            (desde 4,99 €/mes).
          </Text>
          <Text
            style={{
              color: COLOR_MUTED,
              fontSize: 15,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            · Reenvía este correo a tu capitán o admin de club si crees
              que le viene bien.
          </Text>

          <Hr
            style={{
              border: "none",
              borderTop: `1px solid ${COLOR_HAIR}`,
              margin: "28px 0 16px 0",
            }}
          />

          <Text
            style={{
              color: "rgba(232, 245, 239, 0.5)",
              fontSize: 12,
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Recibes este correo porque te apuntaste al waitlist de
            TACTIUM en{" "}
            <Link
              href={siteUrl}
              style={{ color: "rgba(232, 245, 239, 0.7)" }}
            >
              {siteUrl.replace(/^https?:\/\//, "")}
            </Link>
            . Si no fuiste tú, ignora este mensaje.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default WelcomeWaitlist;
