"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DailyWord from "@/components/DailyWord";
import { SERVICES, HOURS } from "@/lib/constant"; // Certifique-se que o caminho está correto

type Appointment = {
  id: string;
  service: string;
  date: string;
  time: string;
  status: string;
  profiles: { name: string };
  barbers: { display_name: string };
};
type Barber = { id: string; display_name: string; user_id: string };
type UserProfile = {
  id: string;
  name: string;
  role: string;
  created_at: string;
};

export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<{ name: string; id: string } | null>(
    null,
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [period, setPeriod] = useState<"today" | "7" | "30">("today");
  const [filterBarber, setFilterBarber] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // Estados para o NOVO AGENDAMENTO
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    barberId: "",
    service: "",
    date: "",
    time: "",
  });
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const periodEnd = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  };

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("id", user.id)
        .single();

      if (prof?.role !== "admin") {
        router.push("/cliente");
        return;
      }
      setProfile(prof);

      const [{ data: barb }, { data: usr }] = await Promise.all([
        supabase.from("barbers").select("id, display_name, user_id"),
        supabase
          .from("profiles")
          .select("id, name, role, created_at")
          .order("created_at", { ascending: false }),
      ]);
      setBarbers(barb || []);
      setUsers(usr || []);
      setLoading(false);
    }
    load();
  }, []);

  // Função para carregar agendamentos (extraída para ser reutilizada após novo agendamento)
  async function loadAppts() {
    let endDate = today;
    if (period === "7") endDate = periodEnd(7);
    if (period === "30") endDate = periodEnd(30);

    let query = supabase
      .from("appointments")
      .select(
        "id, service, date, time, status, profiles(name), barbers(display_name)",
      )
      .gte("date", today)
      .lte("date", endDate)
      .order("date")
      .order("time");

    if (filterBarber !== "all") query = query.eq("barber_id", filterBarber);

    const { data } = await query;
    setAppointments((data as any) || []);
  }

  useEffect(() => {
    loadAppts();
  }, [period, filterBarber]);

  // Função para salvar o agendamento do ADMIN
  async function handleCreateAppointment() {
    if (!form.barberId || !form.service || !form.date || !form.time) {
      return alert("Preencha todos os campos!");
    }

    setSaving(true);
    const { error } = await supabase.from("appointments").insert({
      client_id: profile?.id, // Você agendando para você mesmo
      barber_id: form.barberId,
      service: form.service,
      date: form.date,
      time: form.time,
      status: "confirmed",
    });

    if (error) {
      alert("Erro ao agendar: " + error.message);
    } else {
      alert("Agendamento realizado com sucesso!");
      setShowModal(false);
      setForm({ barberId: "", service: "", date: "", time: "" });
      loadAppts(); // Recarrega a lista
    }
    setSaving(false);
  }

  // Métricas e funções auxiliares permanecem iguais...
  const confirmed = appointments.filter((a) => a.status === "confirmed");
  const totalRevenue = confirmed.reduce((sum, a) => {
    const svc = SERVICES.find((s: any) => s.name === a.service);
    return sum + (svc?.price || 0);
  }, 0);

  const barberStats = barbers.map((b) => {
    const appts = confirmed.filter(
      (a) => (a.barbers as any)?.display_name === b.display_name,
    );
    const revenue = appts.reduce((sum, a) => {
      const svc = SERVICES.find((s: any) => s.name === a.service);
      return sum + (svc?.price || 0);
    }, 0);
    return { ...b, count: appts.length, revenue };
  });

  function formatDate(d: string) {
    const [y, m, day] = d.split("-");
    return `${day}/${m}`;
  }

  function roleLabel(role: string) {
    if (role === "admin")
      return { label: "Admin", cls: "bg-emerald-900/30 text-emerald-400" };
    if (role === "barber")
      return { label: "Barbeiro", cls: "bg-amber-900/30 text-amber-400" };
    return { label: "Cliente", cls: "bg-zinc-800 text-zinc-500" };
  }

  async function changeRole(userId: string, newRole: string) {
    await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
    );
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading)
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500">Carregando...</p>
      </main>
    );

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Aliança Barber Club"
              className="h-14 w-auto"
            />
            <span className="text-xs bg-amber-900/30 text-amber-400 px-2 py-1 rounded font-semibold">
              Admin Master
            </span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-amber-400 text-zinc-950 px-4 py-2 rounded-lg font-bold text-sm hover:bg-amber-300 transition-colors"
          >
            + Novo Agendamento
          </button>
        </div>
      </header>

      <DailyWord />

      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-8">
        {/* MODAL DE AGENDAMENTO */}
        {showModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-md flex flex-col gap-4 shadow-2xl">
              <h2 className="text-xl font-bold text-amber-400">
                Agendar seu corte
              </h2>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500 font-bold uppercase">
                  Barbeiro
                </label>
                <select
                  className="bg-zinc-800 border border-zinc-700 p-3 rounded-xl"
                  value={form.barberId}
                  onChange={(e) =>
                    setForm({ ...form, barberId: e.target.value })
                  }
                >
                  <option value="">Selecionar Barbeiro</option>
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500 font-bold uppercase">
                  Serviço
                </label>
                <select
                  className="bg-zinc-800 border border-zinc-700 p-3 rounded-xl"
                  value={form.service}
                  onChange={(e) =>
                    setForm({ ...form, service: e.target.value })
                  }
                >
                  <option value="">Selecionar Serviço</option>
                  {SERVICES.map((s: any) => (
                    <option key={s.name} value={s.name}>
                      {s.name} - R${s.price}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-zinc-500 font-bold uppercase">
                    Data
                  </label>
                  <input
                    type="date"
                    className="bg-zinc-800 border border-zinc-700 p-3 rounded-xl [color-scheme:dark]"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-zinc-500 font-bold uppercase">
                    Hora
                  </label>
                  <select
                    className="bg-zinc-800 border border-zinc-700 p-3 rounded-xl"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  >
                    <option value="">Hora</option>
                    {HOURS.map((h: string) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 text-zinc-400 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateAppointment}
                  disabled={saving}
                  className="flex-1 bg-amber-400 text-zinc-950 py-3 rounded-xl font-bold hover:bg-amber-300 transition-colors disabled:opacity-50"
                >
                  {saving ? "Agendando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ... Resto do seu código de Filtros, Stats, Barbeiros e Usuários (permanece igual) */}

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* O conteúdo que você já tinha... */}
        </div>

        {/* Stats */}
        {/* ... */}
      </div>
    </main>
  );
}
