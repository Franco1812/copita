import { AuthForm } from "@/components/auth-form";
import { signUp } from "@/app/auth/actions";

export default async function Signup({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams;
  return <AuthForm title="Creá tu cuenta" description="Guardá y compartí todas tus Copas." message={message} action={signUp} submitLabel="Crear cuenta" fields={[
    { name: "display_name", label: "Tu nombre", autoComplete: "name", maxLength: 80 },
    { name: "email", label: "Email", type: "email", autoComplete: "email" },
    { name: "password", label: "Contraseña (mínimo 8 caracteres)", type: "password", autoComplete: "new-password", minLength: 8 },
  ]} footer={{ href: "/login", text: "¿Ya tenés cuenta?", label: "Ingresá" }} />;
}
