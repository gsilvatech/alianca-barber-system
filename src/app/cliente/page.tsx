"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DailyWord from "@/components/DailyWord";


type Barber = { id: string; display_name: string; whatsapp: string };
type Appointment = {
  id: string;
  service: string;
  date: string;
  time: string;
  barbers: { display_name: string };
};

export default function ClientePage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<{ name: string } | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [takenSlots, setTakenSlots] = useState<string[]>([]);

  // Form state
  const [barberId, setBarberId] = useState("");
  const [service, setService] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState<{
    id: string;
    barber: string;
    service: string;
    date: string;
    time: string;
  } | null>(null);

  async function cancelAppointment(
    id: string,
    barber: string,
    service: string,
    date: string,
    time: string,
  ) {
    setCancelConfirm({ id, barber, service, date, time });
  }

  async function confirmCancel() {
    if (!cancelConfirm) return;
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", cancelConfirm.id);

    if (!error) {
      setAppointments((prev) => prev.filter((a) => a.id !== cancelConfirm.id));
      // Abre WhatsApp do barbeiro avisando o cancelamento
      const barber = barbers.find(
        (b) => b.display_name === cancelConfirm.barber,
      );
      if (barber) {
        const msg = encodeURIComponent(
          `Olá ${cancelConfirm.barber}! Precisei cancelar meu agendamento de *${cancelConfirm.service}* do dia *${cancelConfirm.date}* às *${cancelConfirm.time}*. Nome: ${profile?.name}`,
        );
        window.open(`https://wa.me/55${barber.whatsapp}?text=${msg}`, "_blank");
      }
    }
    setCancelConfirm(null);
  }

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const [{ data: prof }, { data: barb }, { data: appts }] =
        await Promise.all([
          supabase.from("profiles").select("name").eq("id", user.id).single(),
          supabase.from("barbers").select("id, display_name, whatsapp"),
          supabase
            .from("appointments")
            .select("id, service, date, time, barbers(display_name)")
            .eq("client_id", user.id)
            .eq("status", "confirmed")
            .gte("date", new Date().toISOString().split("T")[0])
            .order("date")
            .limit(5),
        ]);
      setProfile(prof);
      setBarbers(barb || []);
      setAppointments((appts as any) || []);
    }
    load();
  }, []);

  // Quando barbeiro ou data mudam, busca slots ocupados e datas bloqueadas
  useEffect(() => {
    if (!barberId) return;
    async function loadBlocked() {
      const { data } = await supabase
        .from("blocked_dates")
        .select("date")
        .eq("barber_id", barberId);
      setBlockedDates((data || []).map((d: any) => d.date));
    }
    loadBlocked();
  }, [barberId]);

  useEffect(() => {
    if (!barberId || !date) return;
    async function loadSlots() {
      const { data } = await supabase
        .from("appointments")
        .select("time")
        .eq("barber_id", barberId)
        .eq("date", date)
        .eq("status", "confirmed");
      const times = (data || []).map((d: any) => d.time);
      // Bloqueia também o slot seguinte
      const blocked: string[] = [];
      times.forEach((t: string) => {
        blocked.push(t);
        const idx = HOURS.indexOf(t);
        if (idx >= 0 && idx + 1 < HOURS.length) blocked.push(HOURS[idx + 1]);
      });
      setTakenSlots(blocked);
    }
    loadSlots();
  }, [barberId, date]);

  async function handleAgendar() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const svc = SERVICES.find((s) => s.name === service)!;

    const { error } = await supabase.from("appointments").insert({
      client_id: user!.id,
      barber_id: barberId,
      service,
      date,
      time,
      status: "confirmed",
    });

    if (!error) {
      // Abre WhatsApp do barbeiro
      const barber = barbers.find((b) => b.id === barberId)!;
      const [d, m, y] = [
        date.split("-")[2],
        date.split("-")[1],
        date.split("-")[0],
      ];
      const msg = encodeURIComponent(
        `Olá ${barber.display_name}! Acabei de agendar um *${service}* para o dia *${d}/${m}/${y}* às *${time}*. Valor: R$ ${svc.price}. Nome: ${profile?.name}`,
      );
      window.open(`https://wa.me/55${barber.whatsapp}?text=${msg}`, "_blank");
      setSuccess(true);
      setStep(1);
      setBarberId("");
      setService("");
      setDate("");
      setTime("");
      // Recarrega agendamentos
      const { data: appts } = await supabase
        .from("appointments")
        .select("id, service, date, time, barbers(display_name)")
        .eq("client_id", user!.id)
        .eq("status", "confirmed")
        .gte("date", new Date().toISOString().split("T")[0])
        .order("date")
        .limit(5);
      setAppointments((appts as any) || []);
    }
    setLoading(false);
  }

  const minDate = new Date().toISOString().split("T")[0];
  const isDateBlocked = (d: string) => {
    if (!d) return false;
    const day = new Date(d + "T12:00:00").getDay(); // 0=Dom
    return day === 0 || blockedDates.includes(d);
  };

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="w-16" />
          <img
            src="/logo.png"
            alt="Aliança Barber Club"
            className="h-20 w-auto mx-auto"
          />
          <button
            onClick={handleLogout}
            className="text-zinc-500 text-sm hover:text-white transition-colors w-16 text-right"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-8">
        {/* Saudação */}
        <div>
          <h2 className="text-2xl font-bold">
            Olá, {profile?.name?.split(" ")[0]}! 👋
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Agende seu próximo atendimento abaixo.
          </p>
        </div>

        {/* Palavra do Dia */}
        <DailyWord />

        {/* Próximos agendamentos */}
        {appointments.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Seus próximos agendamentos
            </h3>
            <div className="flex flex-col gap-2">
              {appointments.map((a) => {
                const [y, m, d] = a.date.split("-");
                return (
                  <div
                    key={a.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-4"
                  >
                    <div className="bg-zinc-800 rounded-lg px-3 py-2 text-center min-w-[52px]">
                      <div className="text-amber-400 font-bold text-lg leading-none">
                        {d}/{m}
                      </div>
                      <div className="text-zinc-500 text-xs mt-1">{a.time}</div>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{a.service}</div>
                      <div className="text-zinc-400 text-xs mt-0.5">
                        {(a.barbers as any)?.display_name}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs bg-emerald-900/40 text-emerald-400 px-2 py-1 rounded-md font-semibold">
                        Confirmado
                      </span>
                      <button
                        onClick={() =>
                          cancelAppointment(
                            a.id,
                            (a.barbers as any)?.display_name,
                            a.service,
                            `${d}/${m}`,
                            a.time,
                          )
                        }
                        className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Modal de confirmação de cancelamento */}
        {cancelConfirm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4">
              <h3 className="font-bold text-lg">Cancelar agendamento?</h3>
              <div className="bg-zinc-800 rounded-xl p-4 flex flex-col gap-1 text-sm">
                <span className="text-zinc-400">
                  Barbeiro:{" "}
                  <span className="text-white font-medium">
                    {cancelConfirm.barber}
                  </span>
                </span>
                <span className="text-zinc-400">
                  Serviço:{" "}
                  <span className="text-white font-medium">
                    {cancelConfirm.service}
                  </span>
                </span>
                <span className="text-zinc-400">
                  Data:{" "}
                  <span className="text-white font-medium">
                    {cancelConfirm.date}
                  </span>
                </span>
                <span className="text-zinc-400">
                  Horário:{" "}
                  <span className="text-white font-medium">
                    {cancelConfirm.time}
                  </span>
                </span>
              </div>
              <p className="text-zinc-400 text-sm">
                O barbeiro será notificado via WhatsApp sobre o cancelamento.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCancelConfirm(null)}
                  className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors font-semibold text-sm"
                >
                  Voltar
                </button>
                <button
                  onClick={confirmCancel}
                  className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-400 transition-colors text-white font-semibold text-sm"
                >
                  Confirmar cancelamento
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast sucesso */}
        {success && (
          <div className="bg-emerald-900/40 border border-emerald-600 rounded-xl px-4 py-3 text-emerald-400 text-sm font-medium flex items-center gap-2">
            ✓ Agendamento confirmado! O WhatsApp do barbeiro foi aberto para
            notificá-lo.
            <button
              onClick={() => setSuccess(false)}
              className="ml-auto text-emerald-600"
            >
              ✕
            </button>
          </div>
        )}

        {/* Formulário de agendamento */}
        <section>
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            Novo agendamento
          </h3>

          {/* Steps indicator */}
          <div className="flex gap-2 mb-6">
            {["Barbeiro", "Serviço", "Data e hora"].map((label, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full transition-colors ${step > i ? "bg-amber-400" : "bg-zinc-800"}`}
              />
            ))}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-5">
            {/* Step 1: Barbeiro */}
            {step >= 1 && (
              <div className="flex flex-col gap-2">
                <label className="text-zinc-400 text-sm font-medium">
                  Barbeiro
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {barbers.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setBarberId(b.id);
                        if (step < 2) setStep(2);
                      }}
                      className={`py-3 px-4 rounded-xl text-sm font-semibold border transition-all text-left ${barberId === b.id ? "bg-amber-400 text-zinc-950 border-amber-400" : "bg-zinc-800 border-zinc-700 text-white hover:border-amber-400"}`}
                    >
                      {b.display_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Serviço */}
            {step >= 2 && (
              <div className="flex flex-col gap-2">
                <label className="text-zinc-400 text-sm font-medium">
                  Serviço
                </label>
                <select
                  value={service}
                  onChange={(e) => {
                    setService(e.target.value);
                    if (step < 3) setStep(3);
                  }}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400 transition-colors"
                >
                  <option value="">Selecione um serviço</option>
                  {SERVICES.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name} — R$ {s.price}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Step 3: Data e hora */}
            {step >= 3 && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-zinc-400 text-sm font-medium">
                    Data
                  </label>
                  <input
                    type="date"
                    min={minDate}
                    value={date}
                    onChange={(e) => {
                      const d = e.target.value;
                      if (!isDateBlocked(d)) {
                        setDate(d);
                        setTime("");
                      } else {
                        alert("Esta data está bloqueada ou é domingo.");
                      }
                    }}
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400 transition-colors"
                  />
                  {date && isDateBlocked(date) && (
                    <p className="text-red-400 text-xs">
                      Esta data está indisponível.
                    </p>
                  )}
                </div>

                {date && !isDateBlocked(date) && (
                  <div className="flex flex-col gap-2">
                    <label className="text-zinc-400 text-sm font-medium">
                      Horário
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {HOURS.map((h) => {
                        const blocked = takenSlots.includes(h);
                        return (
                          <button
                            key={h}
                            disabled={blocked}
                            onClick={() => setTime(h)}
                            className={`py-2 rounded-lg text-sm font-semibold border transition-all ${time === h ? "bg-amber-400 text-zinc-950 border-amber-400" : blocked ? "bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed" : "bg-zinc-800 border-zinc-700 text-white hover:border-amber-400"}`}
                          >
                            {h}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Confirmar */}
            {barberId && service && date && time && !isDateBlocked(date) && (
              <div className="border-t border-zinc-800 pt-4 flex flex-col gap-3">
                <div className="text-sm text-zinc-400 flex flex-col gap-1">
                  <span>
                    Barbeiro:{" "}
                    <span className="text-white font-medium">
                      {barbers.find((b) => b.id === barberId)?.display_name}
                    </span>
                  </span>
                  <span>
                    Serviço:{" "}
                    <span className="text-white font-medium">{service}</span>
                  </span>
                  <span>
                    Data:{" "}
                    <span className="text-white font-medium">
                      {date.split("-").reverse().join("/")}
                    </span>
                  </span>
                  <span>
                    Horário:{" "}
                    <span className="text-white font-medium">{time}</span>
                  </span>
                  <span>
                    Total:{" "}
                    <span className="text-amber-400 font-bold">
                      R$ {SERVICES.find((s) => s.name === service)?.price}
                    </span>
                  </span>
                </div>
                <button
                  onClick={handleAgendar}
                  disabled={loading}
                  className="bg-amber-400 text-zinc-950 font-bold py-3 rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading
                    ? "Agendando..."
                    : "✓ Confirmar e notificar barbeiro"}
                </button>
                <p className="text-zinc-500 text-xs text-center">
                  O WhatsApp do barbeiro será aberto automaticamente
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
