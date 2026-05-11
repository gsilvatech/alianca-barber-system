"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DailyWord from "@/components/DailyWord";

type Appointment = {
  id: string;
  service: string;
  date: string;
  time: string;
  status: string;
  profiles: { name: string; phone: string };
};

export default function BarbeiroPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<{ name: string } | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [today, setToday] = useState<Appointment[]>([]);
  const [week, setWeek] = useState<Appointment[]>([]);
  const [blockedDates, setBlockedDates] = useState<
    { id: string; date: string; reason: string }[]
  >([]);
  const [newBlockDate, setNewBlockDate] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [loadingBlock, setLoadingBlock] = useState(false);
  const [tab, setTab] = useState<"semana" | "mes">("semana");

  const todayStr = new Date().toISOString().split("T")[0];
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split("T")[0];
  const monthEnd = new Date();
  monthEnd.setDate(monthEnd.getDate() + 30);
  const monthEndStr = monthEnd.toISOString().split("T")[0];

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
        .select("name, role")
        .eq("id", user.id)
        .single();
      if (prof?.role !== "barbers") {
        router.push("/cliente");
        return;
      }
      setProfile(prof);

      const { data: barber } = await supabase
        .from("barbers")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!barber) return;
      setBarberId(barber.id);

      const [{ data: todayAppts }, { data: weekAppts }, { data: blocked }] =
        await Promise.all([
          supabase
            .from("appointments")
            .select("id, service, date, time, status, profiles(name, phone)")
            .eq("barber_id", barber.id)
            .eq("date", todayStr)
            .in("status", ["confirmed", "canceled"])
            .order("time"),
          supabase
            .from("appointments")
            .select("id, service, date, time, status, profiles(name, phone)")
            .eq("barber_id", barber.id)
            .gte("date", todayStr)
            .lte("date", weekEndStr)
            .in("status", ["confirmed"])
            .order("date")
            .order("time"),
          supabase
            .from("blocked_dates")
            .select("id, date, reason")
            .eq("barber_id", barber.id)
            .gte("date", todayStr)
            .order("date"),
        ]);

      setToday((todayAppts as any) || []);
      setWeek((weekAppts as any) || []);
      setBlockedDates(blocked || []);
    }
    load();
  }, []);

  async function loadMonth() {
    if (!barberId) return;
    const { data } = await supabase
      .from("appointments")
      .select("id, service, date, time, status, profiles(name, phone)")
      .eq("barber_id", barberId)
      .gte("date", todayStr)
      .lte("date", monthEndStr)
      .eq("status", "confirmed")
      .order("date")
      .order("time");
    setWeek((data as any) || []);
  }

  async function handleBlockDate() {
    if (!newBlockDate || !barberId) return;
    setLoadingBlock(true);
    const { data, error } = await supabase
      .from("blocked_dates")
      .insert({
        barber_id: barberId,
        date: newBlockDate,
        reason: newBlockReason || "Folga",
      })
      .select()
      .single();
    if (!error && data) {
      setBlockedDates((prev) => [...prev, data]);
      setNewBlockDate("");
      setNewBlockReason("");
    }
    setLoadingBlock(false);
  }

  async function handleUnblockDate(id: string) {
    await supabase.from("blocked_dates").delete().eq("id", id);
    setBlockedDates((prev) => prev.filter((d) => d.id !== id));
  }

  function formatDate(dateStr: string) {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-4 flex items-center justify-between max-w-3xl mx-auto">
        <img
          src="/logo.png"
          alt="Aliança Barber Club"
          className="h-20 w-auto"
        />
        <div className="flex items-center gap-3">
          <span className="text-zinc-400 text-sm hidden sm:block">
            {profile?.name}
          </span>
          <button
            onClick={handleLogout}
            className="text-zinc-500 text-sm hover:text-white transition-colors"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-8">
        {/* Saudação */}
        <div>
          <h2 className="text-2xl font-bold">
            Olá, {profile?.name?.split(" ")[0]}! ✂️
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Aqui está sua agenda de hoje.
          </p>
        </div>

        {/* Palavra do Dia */}
        <DailyWord />

        {/* Agenda do dia */}
        <section>
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Hoje — {formatDate(todayStr)}{" "}
            <span className="text-amber-400">
              ({today.length} agendamentos)
            </span>
          </h3>
          {today.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-6 text-center text-zinc-500 text-sm">
              Nenhum agendamento para hoje.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {today.map((a) => (
                <div
                  key={a.id}
                  className={`bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-4 ${a.status === "canceled" ? "opacity-60 saturate-50" : ""}`}
                >
                  <div className="bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2 text-center min-w-[52px]">
                    <div className="text-amber-400 font-bold text-lg leading-none">
                      {a.time}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">
                      {(a.profiles as any)?.name}
                    </div>
                    <div className="text-zinc-400 text-sm">{a.service}</div>
                    {a.status === "canceled" && (
                      <div className="text-[10px] font-bold text-red-400 bg-red-950/50 border border-red-900/50 px-2 py-0.5 rounded mt-1 self-start uppercase italic">
                        Cancelado pelo cliente
                      </div>
                    )}
                  </div>
                  {(a.profiles as any)?.phone && a.status !== "canceled" && (
                    <a
                      href={`https://wa.me/55${(a.profiles as any).phone.replace(/\D/g, "")}`}
                      target="_blank"
                      className="text-emerald-400 text-xs font-semibold bg-emerald-900/30 px-3 py-1.5 rounded-lg hover:bg-emerald-900/60 transition-colors"
                    >
                      WhatsApp
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Agenda semana/mês */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
              Próximos clientes
            </h3>
            <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
              {(["semana", "mes"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t);
                    if (t === "mes") loadMonth();
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${tab === t ? "bg-amber-400 text-zinc-950" : "text-zinc-400 hover:text-white"}`}
                >
                  {t === "semana" ? "7 dias" : "30 dias"}
                </button>
              ))}
            </div>
          </div>
          {week.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-6 text-center text-zinc-500 text-sm">
              Nenhum agendamento no período.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {week.map((a) => (
                <div
                  key={a.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-4"
                >
                  <div className="bg-zinc-800 rounded-lg px-3 py-2 text-center min-w-[64px]">
                    <div className="text-white font-bold text-sm leading-none">
                      {formatDate(a.date)}
                    </div>
                    <div className="text-zinc-500 text-xs mt-1">{a.time}</div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">
                      {(a.profiles as any)?.name}
                    </div>
                    <div className="text-zinc-400 text-xs">{a.service}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Bloquear datas */}
        <section>
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Bloquear datas
          </h3>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex gap-2">
              <input
                type="date"
                min={todayStr}
                value={newBlockDate}
                onChange={(e) => setNewBlockDate(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400 transition-colors"
              />
              <input
                type="text"
                placeholder="Motivo (ex: Folga)"
                value={newBlockReason}
                onChange={(e) => setNewBlockReason(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400 transition-colors"
              />
              <button
                onClick={handleBlockDate}
                disabled={!newBlockDate || loadingBlock}
                className="bg-amber-400 text-zinc-950 font-bold px-4 rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-40 text-sm"
              >
                {loadingBlock ? "..." : "Bloquear"}
              </button>
            </div>

            {blockedDates.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-zinc-500 font-medium">
                  Datas bloqueadas:
                </p>
                {blockedDates.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2"
                  >
                    <div>
                      <span className="text-sm font-semibold text-red-400">
                        {formatDate(b.date)}
                      </span>
                      <span className="text-zinc-500 text-xs ml-2">
                        {b.reason}
                      </span>
                    </div>
                    <button
                      onClick={() => handleUnblockDate(b.id)}
                      className="text-zinc-500 hover:text-red-400 text-xs transition-colors font-medium"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
