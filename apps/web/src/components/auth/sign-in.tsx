"use client";

import { Captcha, useCreateWallet, useLoginWithEmail, useLoginWithOAuth, usePrivy } from "@privy-io/react-auth";
import { ArrowLeftIcon } from "lucide-react";
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { OtpInput } from "@/components/auth/otp-input";
import { MarkGlyph, Spinner } from "@/components/loaders";
import { Reveal, ShineBorder, SpotlightCard } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CODE_LENGTH = 6;
/** Privy invalida un código después de 5 intentos fallidos. */
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignInOptions {
  title?: string;
  description?: string;
}

const SignInContext = createContext<((options?: SignInOptions) => void) | null>(null);

/** Abre la ventana de ingreso de extan (email con código o Google; la wallet queda como opción secundaria). */
export function useSignIn() {
  const signIn = useContext(SignInContext);
  if (!signIn) throw new Error("useSignIn requiere SignInProvider");
  return signIn;
}

/**
 * Ingreso con interfaz propia, en español, sobre los hooks headless de Privy. La ventana de Privy no se puede
 * traducir; solo se usa para conectar una wallet externa.
 */
export function SignInProvider({ children }: { children: ReactNode }) {
  const { authenticated } = usePrivy();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<SignInOptions>({});
  useEnsureEmbeddedWallet();

  // Google devuelve al usuario a la misma página: el hook tiene que estar montado siempre para terminar el ingreso.
  const oauth = useLoginWithOAuth({
    onError: (error) => {
      if (error !== "exited_auth_flow") toast.error("No pudimos entrar con Google. Intenta de nuevo o usa tu email.");
    },
  });

  const signIn = useCallback(
    (next?: SignInOptions) => {
      if (authenticated) return;
      setOptions(next ?? {});
      setOpen(true);
    },
    [authenticated],
  );

  return (
    <SignInContext.Provider value={signIn}>
      {children}
      <SignInDialog
        open={open}
        onOpenChange={setOpen}
        options={options}
        startGoogle={() => oauth.initOAuth({ provider: "google" })}
      />
    </SignInContext.Provider>
  );
}

/**
 * Con interfaz de ingreso propia, Privy no aplica `createOnLogin`: la wallet embebida se crea aquí apenas hay sesión,
 * para cuentas sin ninguna wallet (quien entra con MetaMask ya tiene la suya). Sobre ella, `SmartWalletsProvider` crea
 * la smart wallet y `useMe` la sincroniza al perfil. Un intento por usuario y carga de página.
 */
function useEnsureEmbeddedWallet() {
  const { ready, authenticated, user } = usePrivy();
  const { createWallet } = useCreateWallet();
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated || !user || user.wallet || attempted.current === user.id) return;
    attempted.current = user.id;
    createWallet().catch((error: unknown) => {
      // Si Privy ya la había creado por su cuenta (configuración del dashboard), no falta nada. El SDK lanza ese caso
      // como un Error simple, sin código.
      const exists =
        privyCode(error) === "embedded_wallet_already_exists" ||
        (error instanceof Error && error.message.includes("already has an embedded wallet"));
      if (exists) return;
      console.error("No se pudo crear la wallet embebida", error);
      toast.error("No pudimos preparar tu wallet. Recarga la página para intentarlo de nuevo.");
    });
  }, [ready, authenticated, user, createWallet]);
}

type Step = "email" | "code" | "done";
type Pending = "send" | "verify" | "google" | null;

function privyCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "privyErrorCode" in error) {
    return String((error as { privyErrorCode?: unknown }).privyErrorCode);
  }
  return undefined;
}

function describeSendError(error: unknown): string {
  switch (privyCode(error)) {
    case "too_many_requests":
      return "Pediste varios códigos seguidos. Espera un minuto e intenta de nuevo.";
    case "invalid_data":
      return "Revisa el email: parece que tiene un error.";
    case "disallowed_plus_email":
      return "Este email no está permitido. Prueba con otro.";
    case "allowlist_rejected":
    case "disallowed_login_method":
      return "Este email todavía no tiene acceso a extan.";
    case "invalid_captcha":
    case "captcha_failure":
    case "captcha_timeout":
      return "No pudimos comprobar que eres una persona. Recarga la página e intenta de nuevo.";
    default:
      return "No pudimos enviar el código. Revisa tu conexión e intenta de nuevo.";
  }
}

function SignInDialog({
  open,
  onOpenChange,
  options,
  startGoogle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: SignInOptions;
  startGoogle: () => Promise<void>;
}) {
  const { login } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [pending, setPending] = useState<Pending>(null);
  const [resendIn, setResendIn] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // Al cerrar se vuelve al inicio (después de la animación de salida), salvo el email: si vuelve, ya está escrito.
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => {
      setStep("email");
      setCode("");
      setError(null);
      setAttempts(0);
      setPending(null);
    }, 250);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) {
      setError("Escribe tu email completo, por ejemplo nombre@empresa.com.");
      setErrorCount((count) => count + 1);
      emailRef.current?.focus();
      return;
    }
    setPending("send");
    setError(null);
    try {
      await sendCode({ email: address });
      setCode("");
      setAttempts(0);
      setStep("code");
      setResendIn(RESEND_SECONDS);
    } catch (cause) {
      setError(describeSendError(cause));
    } finally {
      setPending(null);
    }
  }

  async function verify(value: string) {
    setPending("verify");
    setError(null);
    try {
      await loginWithCode({ code: value });
      setStep("done");
      setTimeout(() => onOpenChange(false), 900);
    } catch (cause) {
      const used = attempts + 1;
      setAttempts(used);
      setErrorCount((count) => count + 1);
      setCode("");
      if (privyCode(cause) === "too_many_requests" || used >= MAX_ATTEMPTS) {
        setError("Usaste todos los intentos de este código. Pide uno nuevo.");
      } else if (privyCode(cause) === "invalid_credentials") {
        const left = MAX_ATTEMPTS - used;
        setError(
          `El código no coincide o ya venció. ${left === 1 ? "Te queda 1 intento." : `Te quedan ${left} intentos.`}`,
        );
      } else {
        setError("No pudimos verificar el código. Intenta de nuevo.");
      }
      requestAnimationFrame(() => codeRef.current?.focus());
    } finally {
      setPending(null);
    }
  }

  function onCodeChange(value: string) {
    setCode(value);
    if (error && value) setError(null);
    if (value.length === CODE_LENGTH && attempts < MAX_ATTEMPTS) void verify(value);
  }

  async function continueWithGoogle() {
    setPending("google");
    setError(null);
    try {
      await startGoogle();
    } catch {
      setError("No pudimos abrir Google. Intenta de nuevo o usa tu email.");
      setPending(null);
    }
  }

  function connectWallet() {
    onOpenChange(false);
    login({ loginMethods: ["wallet"] });
  }

  const exhausted = attempts >= MAX_ATTEMPTS;

  return (
    <Dialog open={open} onOpenChange={(next) => pending !== "verify" && onOpenChange(next)}>
      <DialogContent
        overlayClassName="bg-[#020303]/90 supports-backdrop-filter:backdrop-blur-md"
        className="max-w-[calc(100%-1.5rem)] gap-0 overflow-hidden p-0 sm:max-w-[25.5rem] sm:p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (step === "code" ? codeRef : emailRef).current?.focus();
        }}
      >
        <SpotlightCard className="rounded-[inherit]" contentClassName="px-6 pt-9 pb-6 sm:px-8 sm:pt-10 sm:pb-8">
          {step === "email" && (
            <div key="email" className="motion-safe:animate-rise">
              <header className="flex flex-col items-center text-center">
                <MarkGlyph state={pending ? "working" : "done"} className="h-10 w-[3.125rem]" />
                <DialogTitle className="mt-6 text-2xl tracking-[-0.025em]">
                  {options.title ?? "Ingresa a extan"}
                </DialogTitle>
                <DialogDescription className="mt-2 text-muted-foreground">
                  {options.description ??
                    "Con tu email, sin contraseña. Si es tu primera vez, creamos tu cuenta al instante."}
                </DialogDescription>
              </header>

              <form onSubmit={requestCode} noValidate className="mt-8 space-y-3">
                <Label htmlFor="sign-in-email">Tu email</Label>
                <div className="group/field relative rounded-[10px]">
                  <Input
                    ref={emailRef}
                    id="sign-in-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="nombre@empresa.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (error) setError(null);
                    }}
                    aria-invalid={!!error || undefined}
                    aria-describedby={error ? "sign-in-error" : undefined}
                    className="h-12 text-base"
                  />
                  <ShineBorder className="opacity-0 transition-opacity duration-200 group-focus-within/field:opacity-100" />
                </div>
                {error && (
                  <Reveal>
                    <p id="sign-in-error" role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  </Reveal>
                )}
                <Button type="submit" size="xl" className="w-full" disabled={!!pending}>
                  {pending === "send" && <Spinner />}
                  {pending === "send" ? "Enviando el código…" : "Continuar con email"}
                </Button>
                <Captcha />
              </form>

              <div className="my-6 flex items-center gap-3 text-xs text-subtle" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
              </div>

              <Button
                type="button"
                variant="outline"
                size="xl"
                className="w-full"
                disabled={!!pending}
                onClick={continueWithGoogle}
              >
                {pending === "google" ? <Spinner /> : <GoogleMark />}
                {pending === "google" ? "Abriendo Google…" : "Continuar con Google"}
              </Button>

              <p className="mt-6 text-center text-sm text-subtle">
                ¿Usas una wallet cripto?{" "}
                <button
                  type="button"
                  onClick={connectWallet}
                  disabled={!!pending}
                  className="font-medium text-muted-foreground underline decoration-line-strong underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground/40 disabled:opacity-50"
                >
                  Conéctala
                </button>
              </p>
            </div>
          )}

          {step === "code" && (
            <div key="code" className="motion-safe:animate-rise">
              <header className="flex flex-col items-center text-center">
                <MarkGlyph state={pending === "verify" ? "working" : "done"} className="h-10 w-[3.125rem]" />
                <DialogTitle className="mt-6 text-2xl tracking-[-0.025em]">Revisa tu email</DialogTitle>
                <DialogDescription className="mt-2 text-muted-foreground">
                  Te enviamos un código de {CODE_LENGTH} dígitos a
                  <span className="block font-medium text-foreground [overflow-wrap:anywhere]">{email.trim()}</span>
                </DialogDescription>
              </header>

              <div className="mt-8 space-y-3">
                <OtpInput
                  inputRef={codeRef}
                  value={code}
                  onChange={onCodeChange}
                  length={CODE_LENGTH}
                  disabled={pending === "verify" || exhausted}
                  invalid={!!error}
                  errorCount={errorCount}
                  aria-describedby="sign-in-code-status"
                />
                <div id="sign-in-code-status" aria-live="polite" className="min-h-5 text-sm">
                  {pending === "verify" ? (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Spinner className="size-3.5" /> Verificando…
                    </span>
                  ) : error ? (
                    <Reveal>
                      <p className="text-destructive">{error}</p>
                    </Reveal>
                  ) : (
                    <p className="text-subtle">
                      Llega desde privy.io, el servicio que protege tu cuenta. Si no lo ves, revisa la carpeta de spam.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-3 text-muted-foreground hover:text-foreground"
                  disabled={pending === "verify"}
                  onClick={() => {
                    setStep("email");
                    setError(null);
                    requestAnimationFrame(() => emailRef.current?.focus());
                  }}
                >
                  <ArrowLeftIcon /> Cambiar email
                </Button>
                <Button
                  type="button"
                  variant={exhausted ? "default" : "ghost"}
                  size="sm"
                  className={exhausted ? undefined : "-mr-3 text-muted-foreground hover:text-foreground"}
                  disabled={!!pending || (resendIn > 0 && !exhausted)}
                  onClick={() => void requestCode()}
                >
                  {pending === "send" && <Spinner />}
                  {resendIn > 0 && !exhausted ? (
                    <span className="amount">Reenviar en {resendIn} s</span>
                  ) : (
                    "Enviar un código nuevo"
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div
              key="done"
              role="status"
              className="flex flex-col items-center py-8 text-center motion-safe:animate-rise"
            >
              <MarkGlyph state="done" className="h-12 w-[3.75rem]" />
              <DialogTitle className="mt-6 text-2xl tracking-[-0.025em]">Listo, ya ingresaste</DialogTitle>
              <DialogDescription className="mt-2 text-muted-foreground">Preparando tu cuenta…</DialogDescription>
            </div>
          )}
        </SpotlightCard>
      </DialogContent>
    </Dialog>
  );
}

/** La "G" de Google en sus colores, como pide su guía para botones de ingreso. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[1.125rem]">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.38-2.29V6.6H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.4l4.01-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.6l4.01 3.11C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
