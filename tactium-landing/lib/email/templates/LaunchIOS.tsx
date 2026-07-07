import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

// Email de LANZAMIENTO iOS — se envía en lote a toda la waitlist el día
// que TACTIUM aparece en la App Store. Misma estética dark (TACTIUM
// brand) y mismas garantías de compatibilidad que WelcomeWaitlist:
// inline styles, tablas para layout (Outlook destroza flex/grid).
//
// El CTA principal apunta a la App Store. El link real (numeric App ID)
// se pasa por prop `appStoreUrl` para no hardcodearlo aquí.

const COLOR_BG = "#030F0F";
const COLOR_CARD = "#0C2222";
const COLOR_CARD_RAISED = "#0F2A28";
const COLOR_ACCENT = "#00DF82";
const COLOR_ACCENT_DEEP = "#03624C";
const COLOR_TEXT = "#E8F5EF";
const COLOR_MUTED = "rgba(232, 245, 239, 0.70)";
const COLOR_FAINT = "rgba(232, 245, 239, 0.45)";
const COLOR_HAIR = "rgba(232, 245, 239, 0.08)";

export interface LaunchIOSProps {
  to: string;
  siteUrl: string;
  /** Link a la ficha de App Store, ej. https://apps.apple.com/app/id6740000000 */
  appStoreUrl: string;
}

export function LaunchIOS({ to, siteUrl, appStoreUrl }: LaunchIOSProps) {
  // Icono de la app alojado en el CDN de Apple (mzstatic) — siempre público,
  // no depende de desplegar la web. Ideal para un email de lanzamiento iOS.
  const logoUrl =
    "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/80/1c/79/801c79b7-7a0a-6a26-6321-98c9178f38eb/AppIcon-0-0-1x_U007epad-0-1-85-220.png/256x256bb.jpg";
  const instagramUrl = "https://instagram.com/tactium.io";

  return (
    <Html lang="es">
      <Head>
        {/* eslint-disable-next-line @next/next/no-head-element */}
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
      </Head>
      <Preview>
        Ya está aquí. TACTIUM está disponible en la App Store — descárgala.
      </Preview>
      <Body
        style={{
          backgroundColor: COLOR_BG,
          color: COLOR_TEXT,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif",
          margin: 0,
          padding: "40px 16px",
          backgroundImage: `radial-gradient(ellipse 800px 400px at 50% -100px, ${COLOR_ACCENT_DEEP}40 0%, ${COLOR_BG} 60%)`,
        }}
      >
        <Container style={{ maxWidth: 580, margin: "0 auto", padding: 0 }}>
          {/* ────────── HEADER · Logo ────────── */}
          <Section style={{ textAlign: "center", padding: "0 0 32px 0" }}>
            <Img
              src={logoUrl}
              alt="TACTIUM"
              width="80"
              height="80"
              style={{ display: "inline-block", borderRadius: 18, margin: "0 auto" }}
            />
            <Text
              style={{
                fontFamily:
                  "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, monospace",
                fontSize: 11,
                letterSpacing: "0.32em",
                color: COLOR_FAINT,
                margin: "16px 0 0 0",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              TACTIUM
            </Text>
          </Section>

          {/* ────────── HERO CARD · Ya está disponible ────────── */}
          <Section
            style={{
              backgroundColor: COLOR_CARD,
              borderRadius: 20,
              border: `1px solid ${COLOR_HAIR}`,
              padding: "40px 32px",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontFamily:
                  "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, monospace",
                fontSize: 11,
                letterSpacing: "0.28em",
                color: COLOR_ACCENT,
                margin: "0 0 18px 0",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              YA DISPONIBLE · iOS
            </Text>

            <Heading
              style={{
                color: COLOR_TEXT,
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: "-1px",
                lineHeight: 1.1,
                margin: "0 0 16px 0",
              }}
            >
              TACTIUM ya está en la App Store.
            </Heading>

            <Text
              style={{
                color: COLOR_MUTED,
                fontSize: 17,
                lineHeight: 1.55,
                margin: "0 0 8px 0",
              }}
            >
              Te apuntaste al waitlist y te lo prometimos: serías de los
              primeros en saberlo. Pues ya está. Puedes descargarla hoy.
            </Text>

            <Text
              style={{
                color: COLOR_TEXT,
                fontSize: 17,
                lineHeight: 1.55,
                fontWeight: 600,
                margin: "0 0 0 0",
              }}
            >
              Tu próxima jornada se arma en 30 segundos.
            </Text>
          </Section>

          {/* ────────── CTA PRINCIPAL · Descargar ────────── */}
          <Section
            style={{
              backgroundColor: COLOR_CARD_RAISED,
              borderRadius: 20,
              border: `1px solid ${COLOR_HAIR}`,
              padding: "36px 32px",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            <Text
              style={{
                color: COLOR_TEXT,
                fontSize: 18,
                fontWeight: 700,
                margin: "0 0 20px 0",
                lineHeight: 1.4,
              }}
            >
              Descárgala gratis en tu iPhone
            </Text>
            <Button
              href={appStoreUrl}
              style={{
                backgroundColor: COLOR_ACCENT,
                color: "#001810",
                padding: "16px 36px",
                borderRadius: 999,
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Abrir en la App Store
            </Button>
            <Text
              style={{
                color: COLOR_FAINT,
                fontSize: 13,
                lineHeight: 1.5,
                margin: "18px 0 0 0",
              }}
            >
              Disponible para iPhone · iOS 15 o superior
            </Text>
          </Section>

          {/* ────────── 3 FEATURES NUMERADAS ────────── */}
          <Section
            style={{
              backgroundColor: COLOR_CARD,
              borderRadius: 20,
              border: `1px solid ${COLOR_HAIR}`,
              padding: "32px",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontFamily:
                  "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, monospace",
                fontSize: 11,
                letterSpacing: "0.28em",
                color: COLOR_ACCENT,
                margin: "0 0 20px 0",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              Lo que puedes hacer ya
            </Text>

            <FeatureRow
              num="01"
              title="Alineaciones en 30 segundos"
              desc="Auto-balance por puntos FEP respetando el orden por fuerza de cada federación autonómica."
            />
            <Hr
              style={{
                border: "none",
                borderTop: `1px solid ${COLOR_HAIR}`,
                margin: "20px 0",
              }}
            />
            <FeatureRow
              num="02"
              title="Hasta 5 variantes por jornada"
              desc="Prueba escenarios con la pareja A, sin la pareja B, con el suplente, sin perder la oficial."
            />
            <Hr
              style={{
                border: "none",
                borderTop: `1px solid ${COLOR_HAIR}`,
                margin: "20px 0",
              }}
            />
            <FeatureRow
              num="03"
              title="Notificaciones push al equipo"
              desc="Cada jugador recibe hora, pista y pareja al instante. Tú dejas de chatear como un community manager."
            />
          </Section>

          {/* ────────── PS personal del founder ────────── */}
          <Section style={{ padding: "16px 32px 32px 32px" }}>
            <Text
              style={{
                color: COLOR_MUTED,
                fontSize: 15,
                lineHeight: 1.65,
                margin: "0 0 12px 0",
                fontStyle: "italic",
              }}
            >
              PS — Si la app te ahorra el caos de cada jornada, déjanos una
              reseña en la App Store. Nos ayuda muchísimo a que la encuentren
              más capitanes. Y si conoces a alguno, reenvíale este correo.
            </Text>
            <Text
              style={{ color: COLOR_FAINT, fontSize: 14, lineHeight: 1.5, margin: 0 }}
            >
              — Javier, founder de TACTIUM ·{" "}
              <Link
                href={instagramUrl}
                style={{ color: COLOR_MUTED, textDecoration: "underline" }}
              >
                @tactium.io
              </Link>
            </Text>
          </Section>

          {/* ────────── FOOTER legal ────────── */}
          <Section
            style={{ padding: "24px 32px 0 32px", borderTop: `1px solid ${COLOR_HAIR}` }}
          >
            <Text
              style={{
                color: COLOR_FAINT,
                fontSize: 12,
                lineHeight: 1.6,
                margin: "0 0 8px 0",
              }}
            >
              Recibes este correo porque te apuntaste al waitlist de TACTIUM
              con la dirección{" "}
              <strong style={{ color: COLOR_MUTED }}>{to}</strong>.
            </Text>
            <Text style={{ color: COLOR_FAINT, fontSize: 12, lineHeight: 1.6, margin: 0 }}>
              Si no fuiste tú, ignora este mensaje. ·{" "}
              <Link
                href={siteUrl}
                style={{ color: COLOR_MUTED, textDecoration: "underline" }}
              >
                {siteUrl.replace(/^https?:\/\//, "")}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Helper para cada feature numerada (01, 02, 03) usando tabla 2-columnas
// porque Outlook destroza cualquier flex/grid.
function FeatureRow({
  num,
  title,
  desc,
}: {
  num: string;
  title: string;
  desc: string;
}) {
  return (
    <Row>
      <Column width={56} style={{ verticalAlign: "top", paddingRight: 12 }}>
        <Text
          style={{
            fontFamily:
              "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, monospace",
            fontSize: 26,
            fontWeight: 800,
            color: COLOR_ACCENT,
            margin: 0,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          {num}
        </Text>
      </Column>
      <Column style={{ verticalAlign: "top" }}>
        <Text
          style={{
            color: COLOR_TEXT,
            fontSize: 16,
            fontWeight: 700,
            margin: "0 0 6px 0",
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </Text>
        <Text style={{ color: COLOR_MUTED, fontSize: 14, lineHeight: 1.55, margin: 0 }}>
          {desc}
        </Text>
      </Column>
    </Row>
  );
}
export default LaunchIOS;
