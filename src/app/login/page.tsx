"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
      return;
    }

    // Busca o perfil para saber o role
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user!.id)
      .single();

    router.push(
      profile?.role === "barbers"
        ? "/barbeiro"
        : profile?.role === "admin"
          ? "/admin"
          : "/cliente",
    );
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="Aliança Barber Club"
            className="h-48 w-auto mx-auto mix-blend-lighten"
          />
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-zinc-900 rounded-2xl p-6 flex flex-col gap-4 border border-zinc-800"
        >
          <div className="flex flex-col gap-1">
            <label className="text-zinc-400 text-sm font-medium">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400 transition-colors"
              placeholder="seu@email.com"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-400 text-sm font-medium">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-amber-400 text-zinc-950 font-bold py-3 rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-zinc-500 text-sm mt-4">
          Não tem conta?{" "}
          <Link
            href="/cadastro"
            className="text-amber-400 font-semibold hover:underline"
          >
            Cadastre-se
          </Link>
        </p>
        {/* ASSINATURA PREMIUM - PADRÃO @SGO */}
        <div className="flex flex-col items-center justify-center gap-2 mt-8 pt-4 border-t border-zinc-900/40 animate-in fade-in duration-700">
          <p className="text-[10px] tracking-widest text-zinc-600 font-bold uppercase">
            Powered by <span className="text-amber-500/80">@SGO</span>
          </p>

          <div className="flex gap-3 text-[11px] font-bold text-zinc-500 uppercase tracking-tight">
            <a
              href="https://www.github.com/gsilvatech" // <--- Pluguado sua marca de dev!
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-amber-400 transition-colors py-1.5 px-3 rounded-xl bg-zinc-900/30 border border-zinc-900 hover:border-zinc-800"
            >
              GitHub
            </a>
            <a
              href="https://www.instagram.com/sougabrieloficial"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-amber-400 transition-colors py-1.5 px-3 rounded-xl bg-zinc-900/30 border border-zinc-900 hover:border-zinc-800"
            >
              Instagram
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
