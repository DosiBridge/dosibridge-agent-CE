import Link from "next/link";
import HomeClient from "./components/HomeClient";

const productHighlights = [
  "Private document question answering with retrieval augmented generation (RAG)",
  "AI agent workflows for research, business automation, and internal knowledge support",
  "Secure user workspaces with isolated documents, chat history, and enterprise-ready controls",
  "Open-source foundations from DosiBridge for teams that want transparent AI infrastructure",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto max-w-6xl px-6 pt-28 pb-10 text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-indigo-300">
          Enterprise AI assistant by DosiBridge
        </p>
        <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
          DosiBridge Agent: secure RAG, document intelligence, and AI automation for teams
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300">
          DosiBridge Agent helps businesses upload knowledge, ask complex questions, and run AI-assisted workflows with privacy-focused document analysis, tool integration, and open-source flexibility.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/docs" className="rounded-full bg-indigo-500 px-6 py-3 font-semibold text-white hover:bg-indigo-400">
            Read the docs
          </Link>
          <Link href="https://dosibridge.com" className="rounded-full border border-white/20 px-6 py-3 font-semibold text-white hover:bg-white/10">
            Visit DosiBridge
          </Link>
        </div>
        <div className="mt-10 grid gap-4 text-left sm:grid-cols-2">
          {productHighlights.map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-slate-200">
              {item}
            </div>
          ))}
        </div>
      </section>
      <HomeClient />
    </main>
  );
}
