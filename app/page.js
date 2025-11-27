import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="wifi-card text-center">
        <h1 className="mb-2 text-2xl font-semibold">WiFiCheck</h1>
        <p className="mb-6 text-sm text-slate-300">
          Ferramenta para testar aspectos básicos de segurança e qualidade da sua
          conexão de rede.
        </p>

        <Link
          href="/wifi-check"
          className="inline-flex items-center justify-center rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/40 transition hover:bg-sky-400"
        >
          Abrir teste de conexão
        </Link>

        <p className="mt-6 text-xs text-slate-500">
          Dica: abra em uma aba separada enquanto muda de Wi-Fi para comparar os
          resultados.
        </p>
      </section>
    </main>
  );
}

