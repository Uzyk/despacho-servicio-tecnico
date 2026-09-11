"use client";

import { useEffect, useState } from "react";
import { COMPANY, COMPANY_MARK } from "@/lib/brand";

const STEPS = [
  {
    kicker: `${COMPANY} · Estudio de caso 2 · 2026`,
    title: "Despacho de servicio técnico",
    body: "De la solicitud al cierre en terreno. La plataforma de Voltsense concentra el ciclo completo.",
    flow: ["OT", "Ruta", "Terreno", "Cierre"],
    academic: [
      {
        label: "Carrera",
        value: "Ingeniería en Electrónica y Sistemas Inteligentes",
      },
      {
        label: "Asignatura",
        value: "Tecnologías aplicadas a los sistemas inteligentes",
      },
      { label: "Docente", value: "Osvaldo Duarte" },
    ],
    credit: "Víctor Godoy · Francisca Lagos · Pablo Leiva  ·  INACAP Santiago Sur",
  },
  {
    kicker: "01 · Contexto",
    title: "El problema no es la ruta. Es el día a día.",
    body: "La información fragmentada rompe la trazabilidad del servicio: más tiempo, trabajo duplicado y sin registro único.",
    image: "/onboard/slide-02.png",
    imageAlt: "Persona sin una sola fuente para verificar el servicio",
    points: [
      { label: "Planilla", hint: "Orden de trabajo" },
      { label: "Chat", hint: "Dirección y cambios" },
      { label: "Llamada", hint: "Hospedaje" },
      { label: "¿Llegó?", hint: "Sin confirmación" },
    ],
  },
  {
    kicker: "02 · Decisión",
    title: "¿Por qué una plataforma propia?",
    body: "Las herramientas genéricas coordinan personas, no una orden de trabajo. Por eso una sola fuente: OT, ruta, vehículo, hospedaje y GPS.",
    points: [
      { label: "Excel", hint: "No obliga estados", logo: "/onboard/logo-excel.png" },
      { label: "Docs", hint: "Edición dispersa", logo: "/onboard/logo-docs.png" },
      { label: "Discord", hint: "Sin trazabilidad por OT", logo: "/onboard/logo-discord.png" },
    ],
  },
  {
    kicker: "03 · Solución",
    title: "Dos roles. Un mismo flujo.",
    body: "Jefatura coordina y supervisa. El técnico consulta, confirma y registra en terreno, en computador o celular.",
    points: [
      { label: "Personalización", hint: "Flujo del despacho" },
      { label: "Integración", hint: "OT, ruta y vehículo" },
      { label: "Trazabilidad", hint: "Hora, persona y GPS" },
      { label: "Roles", hint: "Cada quien ve lo suyo" },
    ],
  },
  {
    kicker: "04 · Demostración",
    title: "Ahora lo vemos en la plataforma.",
    body: "El hilo conductor es la OT: se crea una vez y acompaña el servicio hasta el cierre.",
    points: [
      { label: "1", hint: "Crear una OT" },
      { label: "2", hint: "Incorporarla a una ruta" },
      { label: "3", hint: "Mostrar la ficha del técnico" },
    ],
  },
] as const;

export function WelcomeOnboard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const current = STEPS[step];

  function goNext() {
    if (last) onDone();
    else setStep((n) => n + 1);
  }

  function goPrev() {
    setStep((n) => Math.max(0, n - 1));
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onDone();
      }
      if (event.key === "Enter" || event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, last, onDone]);

  return (
    <section className="relative flex min-h-screen flex-col overflow-hidden bg-navy text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="onboard-orb absolute -left-24 -top-28 h-80 w-80 rounded-full bg-gold/25 blur-3xl" />
        <div className="onboard-orb-slow absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-navy-2 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_40%)]" />
      </div>

      <div className="relative z-10 flex items-center justify-between px-5 py-5 lg:px-10">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm font-bold text-gold">
            {COMPANY_MARK}
          </span>
          <p className="text-sm font-medium text-white/70">{COMPANY}</p>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-3 py-1.5 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          Saltar
        </button>
      </div>

      <div
        className={`relative z-10 mx-auto flex w-full flex-1 flex-col justify-center px-6 py-8 lg:px-10 ${
          "image" in current && current.image ? "max-w-6xl" : "max-w-3xl"
        }`}
      >
        <div
          key={step}
          className={
            "image" in current && current.image
              ? "grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]"
              : ""
          }
        >
          <div>
          <p className="onboard-in text-[11px] font-semibold tracking-[0.18em] text-gold uppercase">
            {current.kicker}
          </p>
          <span className="onboard-rule mt-4 block h-px w-16 bg-gold" />
          <h1 className="onboard-in onboard-delay-1 mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {current.title}
          </h1>
          <p className="onboard-in onboard-delay-2 mt-4 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
            {current.body}
          </p>
          {"flow" in current && current.flow ? (
            <ol className="onboard-in onboard-delay-2 mt-8 flex flex-wrap items-center gap-2">
              {current.flow.map((item, i) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-gold">
                    {item}
                  </span>
                  {i < current.flow.length - 1 ? (
                    <span className="text-white/35" aria-hidden>
                      →
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}
          {"points" in current && current.points ? (
            <ul
              className={`onboard-in onboard-delay-2 mt-8 grid gap-3 ${
                current.points.some((item) => "logo" in item && item.logo)
                  ? "sm:grid-cols-3"
                  : "sm:grid-cols-2"
              }`}
            >
              {current.points.map((item) => (
                <li
                  key={item.label}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  {"logo" in item && item.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.logo}
                      alt=""
                      className="mb-3 h-10 w-auto object-contain"
                    />
                  ) : null}
                  <p className="text-sm font-semibold text-gold">{item.label}</p>
                  <p className="mt-0.5 text-sm text-white/70">{item.hint}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {"academic" in current && current.academic ? (
            <dl className="onboard-in onboard-delay-2 mt-8 space-y-2 text-sm">
              {current.academic.map((item) => (
                <div key={item.label} className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold text-gold">{item.label}</dt>
                  <dd className="text-white/75">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {"credit" in current && current.credit ? (
            <p className="onboard-in onboard-delay-2 mt-6 text-sm text-white/50">
              {current.credit}
            </p>
          ) : null}
          </div>
          {"image" in current && current.image ? (
            <div className="onboard-in onboard-delay-2">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#f6f1e8] shadow-lg shadow-black/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.image}
                  alt={current.imageAlt}
                  className="mx-auto h-auto w-full max-h-72 object-contain p-3 sm:max-h-80"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 px-5 pb-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {STEPS.map((item, i) => (
              <button
                key={item.title}
                type="button"
                aria-label={`Paso ${i + 1}`}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === step ? "w-8 bg-gold" : i < step ? "w-3 bg-white/50" : "w-3 bg-white/20"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={goPrev}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Atrás
              </button>
            ) : null}
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-navy shadow-sm transition hover:bg-[#d4af3a]"
            >
              {last ? "Entrar a la demo" : "Continuar"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
