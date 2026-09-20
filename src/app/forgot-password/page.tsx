import { AuthForm } from "@/components/auth-form";
import { requestPasswordReset } from "@/app/auth/actions";

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams;
  return <AuthForm title="Recuperá tu contraseña" description="Te enviaremos un enlace para cambiarla." message={message} action={requestPasswordReset} submitLabel="Enviar enlace" fields={[
    { name: "email", label: "Email", type: "email", autoComplete: "email" },
  ]} footer={{ href: "/login", text: "¿La recordaste?", label: "Volvé a ingresar" }} />;
}
