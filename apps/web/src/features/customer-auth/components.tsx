import type { FormEvent } from "react";
import type { CustomerAuthCopy } from "./copy";
import type { AuthConfig, AuthMode, CustomerSession, Locale } from "./types";
import { rememberOAuthReturn } from "./routes";

type AuthFormProps = {
  mode: AuthMode;
  text: CustomerAuthCopy;
  token: string | null;
  busy: boolean;
  emailEnabled: boolean;
  oauth: AuthConfig["oauth"];
  locale: Locale;
  returnTo: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onMode: (mode: AuthMode) => void;
};

export function AuthForm({
  mode, text, token, busy, emailEnabled, oauth, locale, returnTo, onSubmit, onMode
}: AuthFormProps) {
  const title = mode === "login" ? text.login : mode === "register" ? text.register : mode === "forgot-password" ? text.forgotPassword : mode === "reset-password" ? text.resetPassword : text.verifyEmail;
  const requiresEmailDelivery = mode === "register" || mode === "forgot-password";
  const canSubmit = !busy && (!requiresEmailDelivery || emailEnabled) && (!isTokenMode(mode) || Boolean(token));

  return (
    <section aria-labelledby="account-title">
      <h1 id="account-title" className="font-serif text-3xl text-olive-900">{title}</h1>
      {isTokenMode(mode) ? <p className="mt-3 text-sm leading-6 text-muted">{mode === "reset-password" ? text.resetDescription : text.verifyDescription}</p> : null}
      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        {mode === "register" ? <Field label={text.fullName} name="fullName" autoComplete="name" /> : null}
        {mode === "login" || mode === "register" || mode === "forgot-password" ? <Field label={text.email} name="email" type="email" autoComplete="email" /> : null}
        {mode === "login" || mode === "register" || mode === "reset-password" ? <Field label={text.password} name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} hint={mode === "register" || mode === "reset-password" ? text.passwordRule : undefined} /> : null}
        <button type="submit" disabled={!canSubmit} className="mt-2 rounded-md bg-olive-700 px-4 py-3 text-sm font-bold text-cream-100 transition hover:bg-olive-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive-700 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? text.loading : mode === "login" ? text.submitLogin : mode === "register" ? text.submitRegister : mode === "forgot-password" ? text.submitForgot : mode === "reset-password" ? text.submitReset : text.submitVerify}
        </button>
      </form>
      {mode === "login" && (oauth.google || oauth.facebook) ? <OAuthButtons oauth={oauth} locale={locale} text={text} returnTo={returnTo} /> : null}
      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-olive-900">
        {mode === "login" ? <><button type="button" disabled={busy} className="underline underline-offset-4 disabled:opacity-50" onClick={() => onMode("forgot-password")}>{text.forgotPrompt}</button><button type="button" disabled={busy} className="underline underline-offset-4 disabled:opacity-50" onClick={() => onMode("register")}>{text.noAccount}</button></> : <button type="button" disabled={busy} className="underline underline-offset-4 disabled:opacity-50" onClick={() => onMode("login")}>{text.hasAccount}</button>}
      </div>
    </section>
  );
}

type SessionViewProps = {
  session: CustomerSession;
  locale: Locale;
  text: CustomerAuthCopy;
  busy: boolean;
  onResend: () => void;
  onLogout: () => void;
  onLogoutAll: () => void;
};

export function SessionView({ session, locale, text, busy, onResend, onLogout, onLogoutAll }: SessionViewProps) {
  return (
    <section className="rounded-lg border border-olive-700/10 bg-white/85 p-6 shadow-soft" aria-labelledby="account-title">
      <h1 id="account-title" className="font-serif text-3xl text-olive-900">{text.signedIn}</h1>
      <dl className="mt-6 grid gap-4 text-sm">
        <div className="min-w-0"><dt className="font-bold text-muted">{text.fullName}</dt><dd className="mt-1 min-w-0 break-words font-semibold text-olive-900">{session.account.fullName}</dd></div>
        <div className="min-w-0"><dt className="font-bold text-muted">{text.email}</dt><dd className="mt-1 min-w-0 break-words font-semibold text-olive-900">{session.account.email ?? "-"}</dd></div>
        <div><dt className="font-bold text-muted">{session.account.emailVerified ? text.verified : text.unverified}</dt>{!session.account.emailVerified ? <dd className="mt-2"><button type="button" className="font-bold text-olive-900 underline underline-offset-4 disabled:opacity-50" disabled={busy} onClick={onResend}>{text.resend}</button></dd> : null}</div>
        <div><dt className="font-bold text-muted">{text.expires}</dt><dd className="mt-1 text-muted">{formatExpiry(session.expiresAt, locale)}</dd></div>
      </dl>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <button type="button" disabled={busy} onClick={onLogout} className="rounded-md border border-olive-700/25 px-4 py-3 text-sm font-bold text-olive-900 disabled:opacity-50">{text.signOut}</button>
        <button type="button" disabled={busy} onClick={onLogoutAll} className="rounded-md bg-olive-700 px-4 py-3 text-sm font-bold text-cream-100 disabled:opacity-50">{text.signOutAll}</button>
      </div>
    </section>
  );
}

export function Notice({ message }: { message: string }) {
  return <section className="mt-4 rounded-lg border border-wood-500/20 bg-white/85 p-5 text-sm font-semibold text-muted" role="status">{message}</section>;
}

function Field({ label, name, type = "text", autoComplete, hint }: { label: string; name: string; type?: string; autoComplete: string; hint?: string }) {
  return <label className="grid gap-2 text-sm font-bold text-olive-900">{label}<input className="min-h-11 rounded-md border border-olive-700/20 bg-white px-3 font-medium outline-none transition focus:border-olive-700 focus:ring-3 focus:ring-olive-700/10" name={name} type={type} autoComplete={autoComplete} required />{hint ? <span className="text-xs font-medium text-muted">{hint}</span> : null}</label>;
}

function OAuthButtons({ oauth, locale, text, returnTo }: { oauth: AuthConfig["oauth"]; locale: Locale; text: CustomerAuthCopy; returnTo: string }) {
  return <div className="mt-6"><p className="flex items-center gap-3 text-xs font-bold uppercase text-muted before:h-px before:flex-1 before:bg-olive-700/15 after:h-px after:flex-1 after:bg-olive-700/15">{text.or}</p><div className="mt-4 grid gap-3">{oauth.google ? <a onClick={() => rememberOAuthReturn(locale, returnTo)} className="rounded-md border border-olive-700/25 px-4 py-3 text-center text-sm font-bold text-olive-900 hover:bg-olive-700/5" href={`/api/customer-auth/oauth/google/start?locale=${locale}`}>{text.google}</a> : null}{oauth.facebook ? <a onClick={() => rememberOAuthReturn(locale, returnTo)} className="rounded-md border border-olive-700/25 px-4 py-3 text-center text-sm font-bold text-olive-900 hover:bg-olive-700/5" href={`/api/customer-auth/oauth/facebook/start?locale=${locale}`}>{text.facebook}</a> : null}</div></div>;
}

function isTokenMode(mode: AuthMode) { return mode === "reset-password" || mode === "verify-email"; }
function formatExpiry(value: string, locale: Locale) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(date); }
