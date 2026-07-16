"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Stack } from "@/components/ui/Layout";
import { Label, Text } from "@/components/ui/Typography";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { DevModeResult } from "./DevModeResult";
import {
  startTrialSchema,
  employeeCountRanges,
  industries,
  type StartTrialInput,
} from "@/lib/validation";

export function StartTrialForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StartTrialInput>();
  const [result, setResult] = useState<string | null>(null);

  async function onSubmit(data: StartTrialInput) {
    setResult(null);
    const parsed = startTrialSchema.safeParse(data);

    if (!parsed.success) {
      const seen = new Set<string>();
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof StartTrialInput;
        if (seen.has(field)) continue;
        seen.add(field);
        setError(field, { message: issue.message });
      }
      return;
    }

    const response = await fetch("/api/start-trial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const payload = await response.json();
    setResult(payload.message ?? "Something went wrong. Please try again.");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? "firstName-error" : undefined}
            {...register("firstName", { required: "First name is required" })}
          />
          <FieldError
            id="firstName-error"
            message={errors.firstName?.message}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            aria-invalid={!!errors.lastName}
            aria-describedby={errors.lastName ? "lastName-error" : undefined}
            {...register("lastName", { required: "Last name is required" })}
          />
          <FieldError id="lastName-error" message={errors.lastName?.message} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="workEmail">Work email</Label>
        <Input
          id="workEmail"
          type="email"
          aria-invalid={!!errors.workEmail}
          aria-describedby={errors.workEmail ? "workEmail-error" : undefined}
          {...register("workEmail", { required: "Work email is required" })}
        />
        <FieldError id="workEmail-error" message={errors.workEmail?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="companyName">Company name</Label>
        <Input
          id="companyName"
          aria-invalid={!!errors.companyName}
          aria-describedby={
            errors.companyName ? "companyName-error" : undefined
          }
          {...register("companyName", { required: "Company name is required" })}
        />
        <FieldError
          id="companyName-error"
          message={errors.companyName?.message}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="employeeCount">Employee count</Label>
          <Select
            id="employeeCount"
            defaultValue=""
            aria-invalid={!!errors.employeeCount}
            aria-describedby={
              errors.employeeCount ? "employeeCount-error" : undefined
            }
            {...register("employeeCount", {
              required: "Select an employee count range",
            })}
          >
            <option value="" disabled>
              Select a range
            </option>
            {employeeCountRanges.map((range) => (
              <option key={range} value={range}>
                {range}
              </option>
            ))}
          </Select>
          <FieldError
            id="employeeCount-error"
            message={errors.employeeCount?.message}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <Select
            id="industry"
            defaultValue=""
            aria-invalid={!!errors.industry}
            aria-describedby={errors.industry ? "industry-error" : undefined}
            {...register("industry", { required: "Select an industry" })}
          >
            <option value="" disabled>
              Select an industry
            </option>
            {industries.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </Select>
          <FieldError id="industry-error" message={errors.industry?.message} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          aria-invalid={!!errors.password}
          aria-describedby={
            errors.password ? "password-error" : "password-hint"
          }
          {...register("password", { required: "Password is required" })}
        />
        {!errors.password ? (
          <Text id="password-hint" className="text-xs text-muted">
            At least 8 characters, with one uppercase letter and one number.
          </Text>
        ) : null}
        <FieldError id="password-error" message={errors.password?.message} />
      </div>

      <div className="space-y-2">
        <label
          className="flex items-start gap-2 text-sm text-muted"
          htmlFor="agreeToTerms"
        >
          <Checkbox
            id="agreeToTerms"
            aria-invalid={!!errors.agreeToTerms}
            aria-describedby={
              errors.agreeToTerms ? "agreeToTerms-error" : undefined
            }
            {...register("agreeToTerms", {
              required: "You must agree to the terms to continue",
            })}
          />
          <span>
            I agree to the{" "}
            <a href="/terms" className="text-cobalt hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="text-cobalt hover:underline">
              Privacy Policy
            </a>
            .
          </span>
        </label>
        <FieldError
          id="agreeToTerms-error"
          message={errors.agreeToTerms?.message}
        />
      </div>

      <Stack className="gap-4">
        <Button type="submit" disabled={isSubmitting} className="w-fit">
          {isSubmitting ? "Creating..." : "Start free trial"}
        </Button>
        {result ? <DevModeResult message={result} /> : null}
      </Stack>
    </form>
  );
}
