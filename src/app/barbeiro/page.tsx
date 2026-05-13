"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DailyWord from "@/components/DailyWord";
import {
  Home,
  Calendar,
  DollarSign,
  Users,
  PlusCircle,
  LogOut,
  Trash2,
} from "lucide-react";

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

  const [profile, setProfile] = useState<{ name: string; id: string } | null>(
    null,
  );
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

  const [isFullDay, setIsFullDay] = useState(true);
  const [selectedTime, setSelectedTime] = useState("");
  const HOURS = [
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
  ];

  const [activeTab, setActiveTab] = useState<
    "home" | "agenda" | "financeiro" | "crm" | "novo"
  >("home");

  const todayStr = new Date().toISOString().split("T")[0];
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split("T")[0];
  const monthEnd = new Date();
  monthEnd.setDate(monthEnd.getDate() + 30);
  const monthEndStr = monthEnd.toISOString().split("T")[0];

  async function loadAppts() {
    if (!barberId) return;

    let endDate = tab === "semana" ? weekEndStr : monthEndStr;

    const [{ data: todayAppts }, { data: weekAppts }, { data: blocked }] =
      await Promise.all([
        supabase
          .from("appointments")
          .select("id, service, date, time, status, profiles(name, phone)")
          .eq("barber_id", barberId)
          .eq("date", todayStr)
          .in("status", ["confirmed", "canceled"])
          .order("time"),
        supabase
          .from("appointments")
          .select("id, service, date, time, status, profiles(name, phone)")
          .eq("barber_id", barberId)
          .gte("date", todayStr)
          .lte("date", endDate)
          .in("status", ["confirmed"])
          .order("date")
          .order("time"),
        supabase
          .from("blocked_dates")
          .select("id, date, reason")
          .eq("barber_id", barberId)
          .gte("date", todayStr)
          .order("date"),
      ]);

    setToday((todayAppts as any) || []);
    setWeek((weekAppts as any) || []);
    setBlockedDates(blocked || []);
  }

  useEffect(() => {
    async function loadInitial() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("id, name, role") // Garanta que o 'id' esteja aqui!
        .eq("id", user.id)
        .single();

      if (prof?.role !== "barbers" && prof?.role !== "barber") {
        router.push("/cliente");
        return;
      }
      setProfile({ ...prof, id: user.id });

      const { data: barber } = await supabase
        .from("barbers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!barber) return;
      setBarberId(barber.id);
    }
    loadInitial();
  }, []);

  useEffect(() => {
    if (barberId) loadAppts();
  }, [barberId, tab]);

  async function handleUnblockDate(id: string) {
    await supabase.from("blocked_dates").delete().eq("id", id);
    setBlockedDates((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  }

  async function handleSmartBlock() {
    if (!newBlockDate || !barberId) return;
    setLoadingBlock(true);

    if (isFullDay) {
      // Tabela blocked_dates (Dia Inteiro)
      const { data, error } = await supabase
        .from("blocked_dates")
        .insert({
          barber_id: barberId,
          date: newBlockDate,
          reason: newBlockReason || "Folga",
        })
        .select()
        .single();
      if (!error) setBlockedDates((prev) => [...prev, data]);
    } else {
      // Tabela appointments (Apenas um horário)
      const motivoFinal = newBlockReason
        ? `BLOQUEIO: ${newBlockReason}`
        : "BLOQUEIO INDISPONÍVEL";

      // Dentro do else do handleSmartBlock
      const { error } = await supabase.from("appointments").insert({
        barber_id: barberId,
        client_id: profile?.id, // Você é o "cliente" do próprio bloqueio
        date: newBlockDate,
        time: selectedTime,
        service: motivoFinal,
        status: "confirmed",
      });

      if (error) {
        console.error("Erro ao bloquear:", error.message);
        alert("Erro ao salvar bloqueio no banco.");
      }
    }

    setNewBlockDate("");
    setNewBlockReason("");
    setSelectedTime("");
    setLoadingBlock(false);
  }

  async function deleteAppointment(id: string) {
    // Opcional: Adicionar um confirm para evitar cliques acidentais
    if (!confirm("Deseja remover este bloqueio?")) return;

    const { error } = await supabase.from("appointments").delete().eq("id", id);

    if (error) {
      console.error("Erro ao deletar:", error.message);
      alert("Não foi possível remover o bloqueio.");
    } else {
      // Recarrega as listas para sumir da tela na hora
      loadAppts();
    }
  }

  const NavButton = ({ icon: Icon, label, tabId }: any) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`flex flex-col items-center justify-center gap-1 transition-all ${activeTab === tabId ? "text-amber-400 scale-110" : "text-zinc-500 hover:text-zinc-300"}`}
    >
      <Icon size={20} strokeWidth={activeTab === tabId ? 2.5 : 2} />
      <span className="text-[10px] font-bold uppercase tracking-tighter">
        {label}
      </span>
    </button>
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-28">
      <header className="bg-zinc-900/50 backdrop-blur-md border-b border-zinc-800 px-4 py-4 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <img src="/logo.png" alt="Logo" className="h-12 w-auto" />
          <button
            onClick={handleLogout}
            className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {activeTab === "home" && (
          <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            <div>
              <h2 className="text-2xl font-bold italic tracking-tight">
                Olá, {profile?.name?.split(" ")[0]}! ✂️
              </h2>
              <p className="text-zinc-500 text-sm mt-1">
                Sua jornada de hoje começa aqui.
              </p>
            </div>
            <DailyWord />
            <section>
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">
                Agenda de Hoje
              </h3>
              <div className="flex flex-col gap-3">
                {today.length === 0 ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-10 text-center text-zinc-600 text-sm italic">
                    Nenhum compromisso agendado.
                  </div>
                ) : (
                  today.map((a) => {
                    const isBlock = a.service.startsWith("BLOQUEIO");
                    return (
                      <div
                        key={a.id}
                        className={`bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-4 flex items-center gap-4 ${a.status === "canceled" ? "opacity-40 grayscale" : ""} ${isBlock ? "border-red-900/30" : ""}`}
                      >
                        <div
                          className={`rounded-xl px-3 py-2 text-center min-w-[60px] ${isBlock ? "bg-red-500 text-white" : "bg-amber-400 text-zinc-950"}`}
                        >
                          <div className="text-lg font-black leading-none">
                            {a.time}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div
                            className={`font-bold italic ${isBlock ? "text-red-400" : "text-zinc-100"}`}
                          >
                            {isBlock
                              ? "HORÁRIO BLOQUEADO"
                              : (a.profiles as any)?.name}
                          </div>
                          <div className="text-zinc-500 text-xs font-medium">
                            {isBlock
                              ? a.service.replace("BLOQUEIO: ", "")
                              : a.service}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === "agenda" && (
          <div className="flex flex-col gap-8 animate-in slide-in-from-bottom-4 duration-500">
            <section>
              <h3 className="text-xl font-bold italic mb-6">
                Próximos Clientes
              </h3>
              <div className="flex flex-col gap-3">
                {week.map((a) => {
                  const isBlock = a.service.startsWith("BLOQUEIO");
                  return (
                    <div
                      key={a.id}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-4 flex items-center gap-4"
                    >
                      <div
                        className={`rounded-xl px-3 py-2 text-center min-w-[64px] ${isBlock ? "bg-red-900/20" : "bg-zinc-800"}`}
                      >
                        <div
                          className={`font-black text-sm ${isBlock ? "text-red-400" : "text-zinc-100"}`}
                        >
                          {a.date.split("-").reverse().slice(0, 2).join("/")}
                        </div>
                        <div className="text-zinc-500 text-[10px] font-bold mt-1">
                          {a.time}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div
                          className={`font-bold text-sm italic ${isBlock ? "text-red-400" : "text-zinc-100"}`}
                        >
                          {isBlock ? "BLOQUEIO" : (a.profiles as any)?.name}
                        </div>
                        <div className="text-zinc-500 text-xs">
                          {isBlock
                            ? a.service.replace("BLOQUEIO: ", "")
                            : a.service}
                        </div>
                      </div>
                      {isBlock && (
                        <button
                          onClick={() => deleteAppointment(a.id)}
                          className="text-zinc-600 hover:text-red-400 p-2"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-4">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">
                Gerenciar Bloqueios
              </h3>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col gap-4">
                <input
                  type="date"
                  min={todayStr}
                  value={newBlockDate}
                  onChange={(e) => setNewBlockDate(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:border-amber-400 outline-none [color-scheme:dark]"
                />
                <div className="flex bg-zinc-800 p-1 rounded-xl">
                  <button
                    onClick={() => setIsFullDay(true)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${isFullDay ? "bg-zinc-700 text-white" : "text-zinc-500"}`}
                  >
                    DIA INTEIRO
                  </button>
                  <button
                    onClick={() => setIsFullDay(false)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${!isFullDay ? "bg-zinc-700 text-white" : "text-zinc-500"}`}
                  >
                    HORÁRIO
                  </button>
                </div>
                {!isFullDay && (
                  <div className="grid grid-cols-4 gap-2 animate-in zoom-in-95 duration-200">
                    {HOURS.map((h) => (
                      <button
                        key={h}
                        onClick={() => setSelectedTime(h)}
                        className={`py-2 rounded-lg text-[10px] font-bold border ${selectedTime === h ? "bg-amber-400 border-amber-400 text-zinc-950" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Motivo (opcional)"
                  value={newBlockReason}
                  onChange={(e) => setNewBlockReason(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:border-amber-400 outline-none"
                />
                <button
                  onClick={handleSmartBlock}
                  disabled={
                    !newBlockDate ||
                    (!isFullDay && !selectedTime) ||
                    loadingBlock
                  }
                  className="bg-amber-400 text-zinc-950 font-black py-4 rounded-xl hover:bg-amber-300 transition-all disabled:opacity-30 uppercase text-xs tracking-widest shadow-[0_10px_20px_rgba(251,191,36,0.2)]"
                >
                  {loadingBlock ? "Processando..." : "Confirmar Bloqueio"}
                </button>
              </div>
              {/* Lista de Datas Bloqueadas (Dia Inteiro) */}
              {blockedDates.length > 0 && (
                <div className="mt-6 flex flex-col gap-2">
                  <p className="text-[10px] font-bold text-zinc-600 uppercase mb-2">
                    Folgas Confirmadas (Dia Todo)
                  </p>
                  {blockedDates.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-2xl px-4 py-3"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-red-400 italic">
                          {b.date.split("-").reverse().join("/")}
                        </span>
                        <span className="text-zinc-500 text-[10px] font-bold uppercase">
                          {b.reason}
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnblockDate(b.id)}
                        className="text-zinc-600 hover:text-white text-[10px] font-black uppercase border border-zinc-800 px-3 py-1 rounded-lg"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* NOVO: Lista de Horários Bloqueados Individuais */}
              {week.filter((a) => a.service.startsWith("BLOQUEIO")).length >
                0 && (
                <div className="mt-6 flex flex-col gap-2">
                  <p className="text-[10px] font-bold text-zinc-600 uppercase mb-2">
                    Horários Bloqueados
                  </p>
                  {week
                    .filter((a) => a.service.startsWith("BLOQUEIO"))
                    .map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-2xl px-4 py-3"
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-amber-400 italic">
                              {a.date
                                .split("-")
                                .reverse()
                                .slice(0, 2)
                                .join("/")}
                            </span>
                            <span className="text-sm font-black text-white">
                              {a.time}
                            </span>
                          </div>
                          <span className="text-zinc-500 text-[10px] font-bold uppercase">
                            {a.service
                              .replace("BLOQUEIO: ", "")
                              .replace("BLOQUEIO INDISPONÍVEL", "Indisponível")}
                          </span>
                        </div>
                        <button
                          onClick={() => deleteAppointment(a.id)}
                          className="text-zinc-600 hover:text-red-400 text-[10px] font-black uppercase border border-zinc-800 px-3 py-1 rounded-lg"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* MANTIVE AS OUTRAS TABS COMO PLACEHOLDERS PARA A PRÓXIMA ETAPA */}
        {activeTab === "financeiro" && (
          <div className="py-20 text-center text-zinc-500 italic animate-pulse">
            Finanças em construção...
          </div>
        )}
        {activeTab === "crm" && (
          <div className="py-20 text-center text-zinc-500 italic animate-pulse">
            CRM em construção...
          </div>
        )}
        {activeTab === "novo" && (
          <div className="py-20 text-center text-zinc-500 italic animate-pulse">
            Agendamento Manual em construção...
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/80 backdrop-blur-xl border-t border-zinc-800/50 px-6 pt-3 pb-8 flex justify-between items-center z-50">
        <NavButton icon={Home} label="Início" tabId="home" />
        <NavButton icon={Calendar} label="Agenda" tabId="agenda" />
        <button
          onClick={() => setActiveTab("novo")}
          className="bg-amber-400 p-4 rounded-2xl -mt-14 shadow-[0_10px_25px_rgba(251,191,36,0.4)] text-zinc-950 transition-transform active:scale-90"
        >
          <PlusCircle size={32} strokeWidth={2.5} />
        </button>
        <NavButton icon={DollarSign} label="Finanças" tabId="financeiro" />
        <NavButton icon={Users} label="CRM" tabId="crm" />
      </nav>
    </main>
  );
}
