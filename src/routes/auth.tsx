import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/rafty/Logo";
import { useRafty } from "@/lib/rafty/store";

export const Route = createFileRoute("/auth")({
  // The form's state depends on the browser-held Supabase session, so SSR of
  // this route only produces hydration mismatches.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in | krijo24" },
      {
        name: "description",
        content: "Sign in or create your krijo24 account and set up your business.",
      },
      { property: "og:title", content: "Sign in | krijo24" },
      { property: "og:description", content: "Sign in to create branded posts in seconds." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { ready, user, business, signIn, signUp, t } = useRafty();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !user) return;
    if (user.role === "admin") navigate({ to: "/admin", replace: true });
    else if (business?.onboarded) navigate({ to: "/create", replace: true });
    else navigate({ to: "/onboarding", replace: true });
  }, [ready, user, business, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res =
      mode === "signup" ? await signUp({ name, email, password }) : await signIn(email, password);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Something went wrong.");
  }

  return (
    <div className="page-bg flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center px-4 py-5 sm:px-6">
        <Link to="/">
          <Logo height={36} />
        </Link>
      </header>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16">
        <form onSubmit={(e) => void submit(e)} className="card-soft flex flex-col gap-4 p-6">
          <h1 className="font-display text-xl font-extrabold">
            {mode === "signup" ? t("auth.signUp") : t("auth.signIn")}
          </h1>
          {mode === "signup" ? (
            <div className="grid gap-2">
              <Label htmlFor="name">{t("auth.name")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" size="lg" disabled={busy} className="rounded-xl">
            {mode === "signup" ? t("auth.signUp") : t("auth.signIn")}
          </Button>
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setError(null);
            }}
          >
            {mode === "signup" ? t("auth.haveAccount") : t("auth.noAccount")}
          </button>
        </form>
      </div>
    </div>
  );
}
