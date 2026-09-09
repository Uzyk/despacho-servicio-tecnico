import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-12">
      <p className="text-sm font-semibold tracking-wide text-gold uppercase">
        INACAP · Tecnologías aplicadas a los sistemas inteligentes
      </p>
      <h1 className="mt-2 text-4xl font-bold text-navy">
        ¿Quién eres hoy?
      </h1>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/jefatura"
          className="rounded-3xl bg-navy p-8 text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-navy-2"
        >
          <p className="text-sm font-medium text-gold">Rol</p>
          <h2 className="mt-1 text-2xl font-bold">Jefatura</h2>
        </Link>
        <Link
          href="/tecnico"
          className="rounded-3xl bg-white p-8 text-navy shadow-lg ring-1 ring-stone-200 transition hover:-translate-y-0.5"
        >
          <p className="text-sm font-medium text-gold">Rol</p>
          <h2 className="mt-1 text-2xl font-bold">Técnico</h2>
        </Link>
      </div>
    </main>
  );
}
