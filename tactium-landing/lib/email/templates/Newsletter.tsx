import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

// Plantilla GENÉRICA de newsletter / actualización. Reutilizable para
// cualquier envío recurrente a la lista. El contenido (asunto, titular,
// párrafos y CTA opcional) se pasa por props desde un archivo de contenido
// editable (scripts/newsletter-content.ts), así no hay que tocar JSX para
// mandar una nueva.
//
// Estilo limpio, claro, una sola columna. Funciona en Gmail/Outlook/Apple.

export interface NewsletterProps {
  to: string;
  siteUrl: string;
  /** Texto del preheader (lo que se ve en la bandeja antes de abrir). */
  preview: string;
  /** Titular grande arriba. */
  heading: string;
  /** Párrafos del cuerpo, en orden. */
  paragraphs: string[];
  /** CTA opcional: si se pasan ambos, se muestra un botón. */
  ctaLabel?: string;
  ctaUrl?: string;
}

const ACCENT = "#0a7d57";

export function Newsletter({
  to,
  siteUrl,
  preview,
  heading,
  paragraphs,
  ctaLabel,
  ctaUrl,
}: NewsletterProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: "#f6f7f6",
          color: "#1a1a1a",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
          margin: 0,
          padding: "24px 16px",
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            margin: "0 auto",
            backgroundColor: "#ffffff",
            borderRadius: 12,
            border: "1px solid #e6e8e6",
            padding: "32px 28px",
          }}
        >
          <Text
            style={{
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: ACCENT,
              fontWeight: 700,
              margin: "0 0 14px 0",
            }}
          >
            TACTIUM
          </Text>

          <Heading
            style={{
              fontSize: 24,
              fontWeight: 800,
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
              margin: "0 0 20px 0",
              color: "#111111",
            }}
          >
            {heading}
          </Heading>

          {paragraphs.map((p, i) => (
            <Text
              key={i}
              style={{ fontSize: 16, lineHeight: 1.65, margin: "0 0 16px 0" }}
            >
              {p}
            </Text>
          ))}

          {ctaLabel && ctaUrl ? (
            <Section style={{ margin: "8px 0 4px 0" }}>
              <Button
                href={ctaUrl}
                style={{
                  backgroundColor: ACCENT,
                  color: "#ffffff",
                  padding: "12px 24px",
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                {ctaLabel}
              </Button>
            </Section>
          ) : null}

          <Text
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: "#999999",
              margin: "28px 0 0 0",
              borderTop: "1px solid #eeeeee",
              paddingTop: 16,
            }}
          >
            Recibes este correo porque estás en la lista de TACTIUM ({to}).{" "}
            <Link href={siteUrl} style={{ color: "#999999" }}>
              tactium.io
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default Newsletter;
