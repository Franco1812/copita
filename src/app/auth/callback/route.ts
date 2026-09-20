import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncDisplayName } from "@/lib/auth-profile";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next");
  const safeNext = next === "/reset-password" ? next : "/dashboard";
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user) await syncDisplayName(supabase, data.user);
      return NextResponse.redirect(new URL(safeNext, request.url));
    }
  }
  return NextResponse.redirect(new URL("/login?message=El+enlace+no+es+v%C3%A1lido+o+expir%C3%B3.", request.url));
}
