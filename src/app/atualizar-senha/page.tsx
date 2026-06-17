"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

export default function AtualizarSenhaPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Verifica se o usuário tem uma sessão válida ao entrar na tela
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Sessão inválida ou link expirado. Por favor, solicite um novo link de recuperação.");
      }
    }
    checkSession();
  }, [supabase]);

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      setSuccess(true);
      
      setTimeout(() => {
        router.push("/login");
      }, 3000);
      
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || "Erro ao atualizar a senha. O link pode ter expirado."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 font-sans text-white">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="bg-amber-400 p-3 rounded-2xl text-zinc-950">
            <Lock size={28} strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black italic">Nova Senha</h1>
            <p className="text-zinc-500 text-sm mt-1">
              Digite e confirme a sua nova senha de acesso.
            </p>
          </div>
        </div>

        {success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 flex flex-col items-center gap-3 text-center animate-in zoom-in-95">
            <CheckCircle2 size={40} className="text-emerald-400" />
            <h3 className="font-bold text-emerald-400 text-lg">Senha Atualizada!</h3>
            <p className="text-zinc-400 text-sm">
              Sua senha foi alterada com sucesso. Redirecionando...
            </p>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="flex flex-col gap-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3 animate-in fade-in">
                <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={18} />
                <p className="text-red-400 text-xs font-medium leading-relaxed">
                  {error}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">
                Nova Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">
                Confirme a Senha
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !!error}
              className="w-full mt-2 bg-amber-400 text-zinc-950 font-black py-4 rounded-xl uppercase text-xs tracking-widest disabled:opacity-50 hover:bg-amber-300 transition-all flex justify-center items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Processando...
                </>
              ) : (
                "Salvar Nova Senha"
              )}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}