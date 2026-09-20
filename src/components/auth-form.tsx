import Link from "next/link";

type Field = { name: string; label: string; type?: string; autoComplete?: string; minLength?: number; maxLength?: number; defaultValue?: string };

export function AuthForm({ title, description, fields, action, submitLabel, message, footer }: {
  title: string;
  description: string;
  fields: Field[];
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  message?: string;
  footer?: { href: string; text: string; label: string };
}) {
  return <section className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-md flex-col justify-center py-12">
    <h1 className="text-4xl font-black tracking-tight">{title}</h1>
    <p className="mt-3 text-muted">{description}</p>
    {message && <p role="status" className="mt-6 rounded-xl border border-border bg-surface px-4 py-3 text-sm">{message}</p>}
    <form action={action} className="mt-8 space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-sm">
      {fields.map((field) => <div key={field.name}>
        <label htmlFor={field.name} className="mb-2 block text-sm font-bold">{field.label}</label>
        <input id={field.name} name={field.name} type={field.type ?? "text"} autoComplete={field.autoComplete} minLength={field.minLength} maxLength={field.maxLength} defaultValue={field.defaultValue} required className="min-h-12 w-full rounded-xl border border-border bg-white px-4 outline-none focus:border-primary" />
      </div>)}
      <button type="submit" className="min-h-12 w-full rounded-xl bg-primary px-5 font-bold text-primary-foreground hover:opacity-90">{submitLabel}</button>
    </form>
    {footer && <p className="mt-6 text-center text-sm text-muted">{footer.text} <Link href={footer.href} className="font-bold text-primary underline underline-offset-4">{footer.label}</Link></p>}
  </section>;
}
