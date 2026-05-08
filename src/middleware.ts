import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value; },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const publicRoutes = ["/login", "/cadastro"];

  // 1. Redirecionamento para deslogados
  if (!user && !publicRoutes.includes(path)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user) {
    // IMPORTANTE: Aqui pegamos a role direto dos metadados do usuário (muito mais rápido!)
    // Você só precisa garantir que no cadastro você salvou a role no 'user_metadata'
    const role = user.user_metadata?.role;

    if (publicRoutes.includes(path)) {
      const target = role === "barbers" ? "/barbeiro" : "/cliente";
      return NextResponse.redirect(new URL(target, request.url));
    }

    if (path === "/cliente" && role === "barbers") {
      return NextResponse.redirect(new URL("/barbeiro", request.url));
    }

    if (path.startsWith("/barbeiro") && role !== "barbers") {
      return NextResponse.redirect(new URL("/cliente", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};