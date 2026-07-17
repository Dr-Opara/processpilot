"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Stack } from "@/components/ui/Layout";
import { Label } from "@/components/ui/Typography";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { DevModeResult } from "./DevModeResult";
import { signInSchema, type SignInInput } from "@/lib/validation";

export function SignInForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>();
  const [result, setResult] = useState<string | null>(null);
  const [forgotPasswordNote, setForgotPasswordNote] = useState(false);

  async function onSubmit(data: SignInInput) {
    setResult(null);
    const parsed = signInSchema.safeParse(data);

    if (!parsed.success) {
      const seen = new Set<string>();
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof SignInInput;
        if (seen.has(field)) continue;
        seen.add(field);
        setError(field, { message: issue.message });
      }
      return;
    }

    const response = await fetch("/api/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const payload = await response.json();
    setResult(payload.message ?? "Something went wrong. Please try again.");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email", { required: "Email is required" })}
        />
        <FieldError id="email-error" message={errors.email?.message} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <button
            type="button"
            onClick={() => setForgotPasswordNote(true)}
            className="text-sm font-medium text-cobalt hover:underline"
          >
            Forgot password?
          </button>
        </div>
        <Input
          id="password"
          type="password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password", { required: "Password is required" })}
        />
        <FieldError id="password-error" message={errors.password?.message} />
      </div>

      {forgotPasswordNote ? (
        <DevModeResult message="Development mode: password reset is not implemented yet. No email was sent." />
      ) : null}

      <Stack className="gap-4">
        <Button type="submit" disabled={isSubmitting} className="w-fit">
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
        {result ? <DevModeResult message={result} /> : null}
      </Stack>

      <p className="text-sm text-muted">
        Don&apos;t have an account?{" "}
        <a href="/start-trial" className="font-medium text-cobalt hover:underline">
          Create one
        </a>
      </p>
    </form>
  );
}
