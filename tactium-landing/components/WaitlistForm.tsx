"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Schema único, compartido con server-side (validamos también allí por
// seguridad — el cliente puede saltarse esta validación).
const schema = z.object({
  email: z.string().email("Email inválido"),
  acceptsPrivacy: z
    .boolean()
    .refine((v) => v === true, "Debes aceptar la política de privacidad"),
  // Honeypot anti-bot: si tiene valor, descartamos en server (bot rellenó).
  company: z.string().max(0).optional(),
});

export type WaitlistFormValues = z.infer<typeof schema>;

interface Props {
  source?: string; // 'hero', 'final-cta', etc. para tracking.
}

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; alreadySubscribed: boolean }
  | { kind: "error"; message: string };

export function WaitlistForm({ source = "unknown" }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<WaitlistFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", acceptsPrivacy: false, company: "" },
  });

  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  const onSubmit = async (values: WaitlistFormValues) => {
    if (values.company) return; // honeypot tripped, finge éxito.
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          source,
          locale: typeof navigator !== "undefined"
            ? navigator.language.slice(0, 2)
            : "es",
          referrer:
            typeof document !== "undefined" ? document.referrer : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({
          kind: "error",
          message: data?.error ?? "Algo ha fallado. Inténtalo de nuevo.",
        });
        return;
      }
      reset();
      setState({
        kind: "success",
        alreadySubscribed: !!data?.alreadySubscribed,
      });
    } catch {
      setState({
        kind: "error",
        message: "Sin conexión. Comprueba tu red y prueba otra vez.",
      });
    }
  };

  if (state.kind === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-[var(--color-accent-40)] bg-[var(--color-accent-10)] px-5 py-4 text-sm"
      >
        <p className="font-semibold text-[var(--color-accent)]">
          {state.alreadySubscribed
            ? "Ya estabas en la lista 👌"
            : "Estás dentro ·"}{" "}
          {!state.alreadySubscribed && (
            <span className="text-[var(--color-text)]">Te avisaremos al lanzar.</span>
          )}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3"
      noValidate
    >
      <div className="flex flex-col sm:flex-row gap-2">
        <label htmlFor={`email-${source}`} className="sr-only">
          Email para el waitlist
        </label>
        <input
          id={`email-${source}`}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="tu@email.com"
          {...register("email")}
          aria-invalid={errors.email ? "true" : "false"}
          aria-describedby={errors.email ? `email-${source}-err` : undefined}
          className="flex-1 min-w-0 h-12 px-4 rounded-xl bg-[var(--color-bg-raised)] border border-[var(--color-hair-strong)] text-[15px] text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] transition"
        />
        {/* Honeypot — invisible al humano (off-screen) pero captura bots. */}
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          {...register("company")}
          className="absolute -left-[9999px] w-0 h-0 opacity-0 pointer-events-none"
        />
        <button
          type="submit"
          disabled={state.kind === "submitting"}
          className="h-12 px-6 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold text-[15px] tracking-tight shadow-[0_8px_24px_-8px_rgba(0,223,130,0.6)] hover:opacity-90 active:opacity-80 disabled:opacity-50 transition"
        >
          {state.kind === "submitting" ? "Enviando…" : "Avísame"}
        </button>
      </div>

      {errors.email && (
        <p
          id={`email-${source}-err`}
          role="alert"
          className="text-xs text-[var(--color-error)]"
        >
          {errors.email.message}
        </p>
      )}

      <label className="flex items-start gap-2 text-xs text-[var(--color-text-muted)] cursor-pointer">
        <input
          type="checkbox"
          {...register("acceptsPrivacy")}
          className="mt-0.5 h-4 w-4 rounded border-[var(--color-hair-strong)] bg-[var(--color-bg-raised)] accent-[var(--color-accent)]"
        />
        <span>
          Acepto la{" "}
          <a
            href="/legal/privacidad"
            className="underline underline-offset-2 text-[var(--color-text)] hover:text-[var(--color-accent)]"
          >
            política de privacidad
          </a>
          . Solo te escribimos al lanzar.
        </span>
      </label>
      {errors.acceptsPrivacy && (
        <p role="alert" className="text-xs text-[var(--color-error)]">
          {errors.acceptsPrivacy.message}
        </p>
      )}

      {state.kind === "error" && (
        <p role="alert" className="text-xs text-[var(--color-error)]">
          {state.message}
        </p>
      )}
    </form>
  );
}
