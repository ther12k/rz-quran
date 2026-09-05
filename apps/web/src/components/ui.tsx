// Accessible UI primitives styled with the child-friendly tokens (T005).
// shadcn-style local primitives: cva-like variants without extra deps.
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover active:bg-primary-hover shadow-sm",
  secondary: "bg-mint text-primary hover:bg-border-soft active:bg-border-soft border border-border-soft",
  ghost: "bg-transparent text-primary hover:bg-mint active:bg-mint",
  danger: "bg-error text-white hover:brightness-90",
};

export function Button({
  variant = "primary",
  block,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; block?: boolean }) {
  return (
    <button
      {...rest}
      className={`btn-touch inline-flex items-center justify-center gap-2 rounded-full px-6 text-[17px] font-bold
        disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${variantClasses[variant]}
        ${block ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`rounded-[24px] bg-surface border border-border-soft p-5 shadow-[0_2px_10px_rgba(23,49,43,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[15px] font-bold mb-1">{label}</span>
      {children}
      {hint ? <span className="block text-[13px] text-muted mt-1">{hint}</span> : null}
    </label>
  );
}

export function TextInput({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={`btn-touch w-full rounded-2xl border border-border-soft bg-surface px-4 py-3 text-[17px]
        placeholder:text-muted/70 ${className}`}
    />
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-sunny px-3 py-1 text-[13px] font-bold text-ink/80 border border-[#ecd98f]">
      Mode demo — bukan data/materi produksi
    </span>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-2xl bg-[#fbeaea] border border-[#e7c8c8] text-error px-4 py-3 text-[15px] font-semibold">
      {children}
    </p>
  );
}
