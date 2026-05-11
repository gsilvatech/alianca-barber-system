import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, newRole } = body;

    if (!userId || !newRole) {
      return NextResponse.json(
        { error: "Dados insuficientes" },
        { status: 400 },
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // 1. Atualiza o Auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { user_metadata: { role: newRole } },
    );

    if (authError) throw authError;

    // 2. Atualiza o Profile
    const { error: profError } = await supabaseAdmin
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (profError) throw profError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("ERRO NA API:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno no servidor" },
      { status: 500 },
    );
  }
}
