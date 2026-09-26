import Image from "next/image";

/**
 * Marco de teléfono con una captura de la app dentro. Bisel, isla dinámica y
 * filo de luz arriba; la captura va recortada al radio interior.
 */
export function PhoneFrame({
  src,
  alt,
  size = "card",
  priority = false,
}: {
  src: string;
  alt: string;
  size?: "hero" | "card";
  priority?: boolean;
}) {
  const sizes = size === "hero" ? "280px" : "(min-width: 640px) 220px, 200px";
  return (
    <div className={`mk-phone mk-phone--${size}`}>
      <div className="mk-phone-screen">
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} quality={85} />
        <div className="mk-phone-island" aria-hidden="true" />
      </div>
      <div className="mk-phone-lit" aria-hidden="true" />
    </div>
  );
}
