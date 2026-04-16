"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function CadastroPage() {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { name: form.name, phone: form.phone, role: "client" },
      },
    });

    if (authError) {
      console.error("Erro Supabase:", authError.message);
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/cliente");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="Aliança Barber Club"
            className="h-64 w-auto mx-auto mix-blend-lighten"
          />
        </div>

        <form
          onSubmit={handleCadastro}
          className="bg-zinc-900 rounded-2xl p-6 flex flex-col gap-4 border border-zinc-800"
        >
          {[
            {
              label: "Nome completo",
              field: "name",
              type: "text",
              placeholder: "João Silva",
            },
            {
              label: "E-mail",
              field: "email",
              type: "email",
              placeholder: "seu@email.com",
            },
            {
              label: "Celular (WhatsApp)",
              field: "phone",
              type: "tel",
              placeholder: "(21) 99999-0000",
            },
            {
              label: "Senha",
              field: "password",
              type: "password",
              placeholder: "Mínimo 6 caracteres",
            },
          ].map(({ label, field, type, placeholder }) => (
            <div key={field} className="flex flex-col gap-1">
              <label className="text-zinc-400 text-sm font-medium">
                {label}
              </label>
              <input
                type={type}
                required
                value={form[field as keyof typeof form]}
                onChange={(e) => set(field, e.target.value)}
                placeholder={placeholder}
                minLength={field === "password" ? 6 : undefined}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>
          ))}

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-amber-400 text-zinc-950 font-bold py-3 rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <p className="text-center text-zinc-500 text-sm mt-4">
          Já tem conta?{" "}
          <Link
            href="/login"
            className="text-amber-400 font-semibold hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
