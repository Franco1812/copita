import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { signIn } from "@/app/auth/actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams;
  return <><AuthForm title="Ingresá a Copita" description="Tus Copas y resultados te esperan." message={message} action={signIn} submitLabel="Ingresar" fields={[
    { name: "email", label: "Email", type: "email", autoComplete: "email" },
    { name: "password", label: "Contraseña", type: "password", autoComplete: "current-password" },
  ]} footer={{ href: "/signup", text: "¿Todavía no tenés cuenta?", label: "Registrate" }} />
  <p className="-mt-12 pb-14 text-center text-sm"><Link href="/forgot-password" className="text-primary underline underline-offset-4">Olvidé mi contraseña</Link></p></>;
}
