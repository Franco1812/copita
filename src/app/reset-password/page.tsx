import { AuthForm } from "@/components/auth-form";
import { updatePassword } from "@/app/auth/actions";
import { requireUser } from "@/lib/auth";

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  await requireUser();
  const { message } = await searchParams;
  return <AuthForm title="Nueva contraseña" description="Elegí una contraseña de al menos 8 caracteres." message={message} action={updatePassword} submitLabel="Guardar contraseña" fields={[
    { name: "password", label: "Nueva contraseña", type: "password", autoComplete: "new-password", minLength: 8 },
  ]} />;
}
