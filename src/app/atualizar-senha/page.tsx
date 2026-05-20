"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AtualizarSenhaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Como o cliente clicou no link do e-mail, ele já tem uma sessão temporária ativa
    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      setError("Erro ao atualizar a senha. O link pode ter expirado.");
    } else {
      alert("Senha atualizada com sucesso! Faça login com a nova senha. 💎");
      await supabase.auth.signOut(); // Desloga a sessão temporária por segurança
      router.push("/login");
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-4">
      <div className="w-full max-w-sm flex flex-col justify-center">
        <div className="text-center mb-6">
          <img
            src="/logo.png"
            alt="Aliança Barber Club"
            className="h-32 w-auto mx-auto mix-blend-lighten"
          />
          <h1 className="text-xl font-bold text-white mt-4 italic">
            Nova Senha
          </h1>
          <p className="text-zinc-500 text-xs mt-1">
            Digite sua nova senha de acesso.
          </p>
        </div>

        <form
          onSubmit={handleUpdate}
          className="bg-zinc-900 rounded-2xl p-5 flex flex-col gap-4 border border-zinc-800 shadow-2xl"
        >
          <div className="flex flex-col gap-0.5">
            <label className="text-zinc-400 text-xs font-medium ml-0.5">
              Nova Senha
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400 transition-colors"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs text-center font-medium">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-amber-400 text-zinc-950 font-black py-3 rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-50 mt-1 uppercase text-xs tracking-wider"
          >
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>

        <div className="flex flex-col items-center justify-center gap-1.5 mt-6 pt-3 border-t border-zinc-900/40">
          <p className="text-[9px] tracking-widest text-zinc-600 font-bold uppercase">
            Powered by <span className="text-amber-500/80">@SGO</span>
          </p>
        </div>
      </div>
    </main>
  );
}
