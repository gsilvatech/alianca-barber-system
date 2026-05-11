import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function GET() {
  const today = new Date().toISOString().split("T")[0];

  // Verifica se já tem versículo do dia no cache
  const { data: cached } = await supabase
    .from("daily_words")
    .select("content, reference")
    .eq("date", today)
    .single();

  if (cached) return NextResponse.json(cached);

  // Busca na API externa
  try {
    const res = await fetch(
      "https://www.abibliadigital.com.br/api/verses/nvi/random",
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 0 },
      },
    );

    if (!res.ok) throw new Error("API indisponível");

    const data = await res.json();
    const content = data.text;
    const reference = `${data.book.name} ${data.chapter}:${data.number}`;

    // Salva no cache
    await supabase.from("daily_words").upsert(
      {
        content,
        reference,
        date: today,
      },
      { onConflict: "date" },
    );

    return NextResponse.json({ content, reference });
  } catch {
    // Fallback caso a API falhe
    return NextResponse.json({
      content:
        "Porque sou eu que conheço os planos que tenho para vocês, diz o Senhor, planos de fazê-los prosperar e não de causar dano, planos de dar a vocês esperança e um futuro.",
      reference: "Jeremias 29:11",
    });
  }
}
