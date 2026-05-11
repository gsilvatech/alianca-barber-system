"use client";
import { useEffect, useState } from "react";

type DailyWordData = { content: string; reference: string };

export default function DailyWord() {
  const [word, setWord] = useState<DailyWordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/daily-word")
      .then((r) => r.json())
      .then((data) => {
        setWord(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="mx-4 rounded-2xl bg-zinc-900 border border-zinc-800 p-5 animate-pulse">
        <div className="h-3 w-24 bg-zinc-800 rounded mb-3" />
        <div className="h-4 bg-zinc-800 rounded mb-2" />
        <div className="h-4 w-3/4 bg-zinc-800 rounded" />
      </div>
    );

  if (!word) return null;

  return (
    <div
      onClick={() => setExpanded((e) => !e)}
      className="mx-4 rounded-2xl border border-amber-400/20 bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950/20 p-5 cursor-pointer transition-all duration-300 hover:border-amber-400/40 relative overflow-hidden"
    >
      {/* Decoração de fundo */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-20 h-20 bg-amber-400/5 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-amber-400 text-base">✦</span>
        <span className="text-xs font-semibold text-amber-400/80 uppercase tracking-widest">
          Palavra do Dia
        </span>
        <span className="ml-auto text-zinc-600 text-xs">
          {expanded ? "fechar ↑" : "ver mais ↓"}
        </span>
      </div>

      {/* Versículo */}
      <p
        className={`text-sm text-zinc-300 leading-relaxed italic transition-all duration-300 ${expanded ? "" : "line-clamp-2"}`}
      >
        {word.content}
      </p>

      {/* Referência */}
      <div className="mt-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-amber-400/20" />
        <span className="text-xs text-amber-400 font-semibold">
          {word.reference}
        </span>
        <div className="h-px flex-1 bg-amber-400/20" />
      </div>
    </div>
  );
}
