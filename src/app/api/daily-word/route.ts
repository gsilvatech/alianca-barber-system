import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// Força o Next.js a não fazer cache da resposta da API
export const revalidate = 0;

export async function GET() {
  try {
    // 1. Gera a data atual formatada para o fuso horário de Brasília (America/Sao_Paulo)
    // Isso evita que a palavra mude às 21h devido ao fuso UTC do servidor da Vercel.
    const today = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(new Date())
      .split("/")
      .reverse()
      .join("-");

    // 2. Verifica se já existe um versículo para o dia de hoje no seu banco (cache)
    const { data: cached } = await supabase
      .from("daily_words")
      .select("content, reference")
      .eq("date", today)
      .single();

    if (cached) {
      return NextResponse.json(cached);
    }

    // 3. Se não houver no banco, busca um novo versículo aleatório na API externa
    const res = await fetch(
      "https://www.abibliadigital.com.br/api/verses/nvi/random",
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 0 }, // Garante que o fetch também não use cache antigo
      },
    );

    if (!res.ok) throw new Error("API externa indisponível");

    const data = await res.json();
    const content = data.text;
    const reference = `${data.book.name} ${data.chapter}:${data.number}`;

    // 4. Salva no Supabase para que outros usuários que acessarem hoje vejam o mesmo versículo
    await supabase.from("daily_words").upsert(
      {
        content,
        reference,
        date: today,
      },
      { onConflict: "date" },
    );

    return NextResponse.json({ content, reference });
  } catch (error) {
    console.error("Erro na DailyWord:", error);

    // Fallback: Se a API falhar ou houver erro de rede, entrega um versículo padrão de segurança
    return NextResponse.json({
      content:
        "Porque sou eu que conheço os planos que tenho para vocês, diz o Senhor, planos de fazê-los prosperar e não de causar dano, planos de dar a vocês esperança e um futuro.",
      reference: "Jeremias 29:11",
    });
  }
}
