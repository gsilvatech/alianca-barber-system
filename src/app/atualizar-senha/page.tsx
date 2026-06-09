"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ShieldCheck } from "lucide-react";

export default function AtualizarSenhaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isForced, setIsForced] = useState(false);

  // Verifica se o cliente foi mandado para cá obrigatoriamente (via URL ?forced=true)
  useEffect(() => {
    if (searchParams.get("forced") === "true") {
      setIsForced(true);
    }
  }, [searchParams]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 1. Atualiza a senha no cofre de autenticação do Supabase
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.updateUser({
      password: password,
    });

    if (authError) {
      setError(
        "Erro ao atualizar a senha. O link pode ter expirado ou a senha é muito fraca.",
      );
      setLoading(false);
      return;
    }

    try {
      // 2. Se o usuário tinha uma flag de troca obrigatória no banco, desativamos ela agora
      if (user) {
        await supabase
          .from("profiles")
          .update({ require_password_change: false })
          .eq("id", user.id);
      }

      alert(
        "Senha atualizada com sucesso! Conecte-se novamente com sua nova senha. 💎",
      );

      // 3. Desloga por segurança para forçar o primeiro login limpo com a senha nova
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err) {
      console.error("Erro ao desativar flag no profile:", err);
      // Mesmo se falhar a tabela pública, a senha principal já foi trocada, então mandamos pro login
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-4 font-sans">
      <div className="w-full max-w-sm flex flex-col justify-center">
        <div className="text-center mb-6">
          <img
            src="/logo.png"
            alt="Aliança Barber Club"
            className="h-32 w-auto mx-auto mix-blend-lighten"
          />
          <h1 className="text-xl font-bold text-white mt-4 italic">
            {isForced ? "Definir Senha Definitiva" : "Nova Senha"}
          </h1>
          <p className="text-zinc-500 text-xs mt-1">
            {isForced
              ? "Você acessou com uma senha provisória. Por segurança, escolha uma nova senha."
              : "Digite sua nova senha de acesso abaixo."}
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
            className="bg-amber-400 text-zinc-950 font-black py-3 rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-50 mt-1 uppercase text-xs tracking-wider shadow-lg shadow-amber-400/10"
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
