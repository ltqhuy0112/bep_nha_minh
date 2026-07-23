"use client";

import { useMemo, useState } from "react";
import type { ApiResponse } from "@/lib/api-response";
import { normalizePhone, waitlistSchema } from "@/lib/validation";
import type { WaitlistFormValues } from "@/types/site";
import { Button } from "@/components/ui/button";

type WaitlistFormProps = {
  successMessage: string;
  labels: {
    name: string;
    district: string;
    phone: string;
    email: string;
    preferredMeal: string;
    submit: string;
    loading: string;
    genericError: string;
    unsafeHtmlError: string;
    phoneHintPrefix: string;
    options: string[];
  };
};

type FieldErrors = Partial<Record<keyof WaitlistFormValues, string>>;

function createInitialValues(defaultPreferredMeal: string): WaitlistFormValues {
  return {
    name: "",
    phone: "",
    email: "",
    district: "",
    preferredMeal: defaultPreferredMeal,
    source: "website"
  };
}

const fallbackPreferredMeal = "Chưa xác định";

function hasUnsafeHtml(value: string) {
  return /<[^>]*>/.test(value);
}

export function WaitlistForm({ successMessage, labels }: WaitlistFormProps) {
  const defaultValues = useMemo(
    () => createInitialValues(labels.options.at(-1) ?? fallbackPreferredMeal),
    [labels.options]
  );
  const [values, setValues] = useState<WaitlistFormValues>(defaultValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const normalizedPreview = useMemo(() => {
    return values.phone ? normalizePhone(values.phone) : "";
  }, [values.phone]);

  function updateField(field: keyof WaitlistFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (status !== "idle") {
      setStatus("idle");
    }
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");

    const containsHtml = Object.values(values).some(hasUnsafeHtml);
    if (containsHtml) {
      setErrors({ name: labels.unsafeHtmlError });
      setStatus("error");
      return;
    }

    const parsed = waitlistSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof WaitlistFormValues | undefined;
        if (key && !nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
      setErrors(nextErrors);
      setStatus("error");
      return;
    }

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(parsed.data)
      });

      const result = (await response.json()) as ApiResponse<{
        id: string;
        status: string;
        createdAt: string;
      }>;

      if (!result.success) {
        setErrors((result.error.details ?? {}) as FieldErrors);
        setStatus("error");
        return;
      }

      setStatus("success");
      setValues(defaultValues);
    } catch {
      setErrors({});
      setStatus("error");
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submitForm} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={labels.name}
          name="name"
          value={values.name}
          error={errors.name}
          autoComplete="name"
          onChange={(value) => updateField("name", value)}
        />
        <Field
          label={labels.district}
          name="district"
          value={values.district}
          error={errors.district}
          autoComplete="address-level2"
          onChange={(value) => updateField("district", value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={labels.phone}
          name="phone"
          value={values.phone}
          error={errors.phone}
          autoComplete="tel"
          inputMode="tel"
          hint={
            normalizedPreview
              ? `${labels.phoneHintPrefix}: ${normalizedPreview}`
              : undefined
          }
          onChange={(value) => updateField("phone", value)}
        />
        <Field
          label={labels.email}
          name="email"
          type="email"
          value={values.email}
          error={errors.email}
          autoComplete="email"
          onChange={(value) => updateField("email", value)}
        />
      </div>

      <label className="grid gap-2 text-sm font-semibold text-olive-900">
        {labels.preferredMeal}
        <select
          name="preferredMeal"
          value={values.preferredMeal}
          onChange={(event) => updateField("preferredMeal", event.target.value)}
          className="min-h-12 rounded-2xl border border-olive-700/15 bg-white px-4 text-base text-olive-900 outline-none transition focus:border-olive-700 focus:ring-4 focus:ring-olive-700/10"
        >
          {labels.options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>

      <Button type="submit" disabled={status === "loading"} className="w-full sm:w-auto">
        {status === "loading" ? labels.loading : labels.submit}
      </Button>

      {status === "success" ? (
        <p className="rounded-2xl bg-olive-700/10 p-4 text-sm font-semibold leading-6 text-olive-900">
          {successMessage}
        </p>
      ) : null}

      {status === "error" ? (
        <p className="rounded-2xl bg-wood-500/10 p-4 text-sm font-semibold leading-6 text-olive-900">
          {labels.genericError}
        </p>
      ) : null}
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  value: string;
  error?: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  onChange: (value: string) => void;
};

function Field({
  label,
  name,
  value,
  error,
  hint,
  type = "text",
  autoComplete,
  inputMode,
  onChange
}: FieldProps) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;

  return (
    <label className="grid gap-2 text-sm font-semibold text-olive-900">
      {label}
      <input
        name={name}
        type={type}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 rounded-2xl border border-olive-700/15 bg-white px-4 text-base text-olive-900 outline-none transition placeholder:text-muted/70 focus:border-olive-700 focus:ring-4 focus:ring-olive-700/10"
      />
      {error ? (
        <span id={`${name}-error`} className="text-xs font-semibold text-red-700">
          {error}
        </span>
      ) : null}
      {!error && hint ? (
        <span id={`${name}-hint`} className="text-xs font-medium text-muted">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
