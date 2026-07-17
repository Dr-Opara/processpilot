"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Stack } from "@/components/ui/Layout";
import { Label } from "@/components/ui/Typography";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { DevModeResult } from "./DevModeResult";
import {
  requestDemoSchema,
  employeeCountRanges,
  primaryUseCases,
  type RequestDemoInput,
} from "@/lib/validation";

export function RequestDemoForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RequestDemoInput>();
  const [result, setResult] = useState<string | null>(null);

  async function onSubmit(data: RequestDemoInput) {
    setResult(null);
    const parsed = requestDemoSchema.safeParse(data);

    if (!parsed.success) {
      const seen = new Set<string>();
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof RequestDemoInput;
        if (seen.has(field)) continue;
        seen.add(field);
        setError(field, { message: issue.message });
      }
      return;
    }

    const response = await fetch("/api/request-demo", {
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
          <FieldError id="firstName-error" message={errors.firstName?.message} />
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

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            aria-invalid={!!errors.company}
            aria-describedby={errors.company ? "company-error" : undefined}
            {...register("company", { required: "Company is required" })}
          />
          <FieldError id="company-error" message={errors.company?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jobTitle">Job title</Label>
          <Input
            id="jobTitle"
            aria-invalid={!!errors.jobTitle}
            aria-describedby={errors.jobTitle ? "jobTitle-error" : undefined}
            {...register("jobTitle", { required: "Job title is required" })}
          />
          <FieldError id="jobTitle-error" message={errors.jobTitle?.message} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="employeeCount">Employee count</Label>
          <Select
            id="employeeCount"
            defaultValue=""
            aria-invalid={!!errors.employeeCount}
            aria-describedby={errors.employeeCount ? "employeeCount-error" : undefined}
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
          <FieldError id="employeeCount-error" message={errors.employeeCount?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="primaryUseCase">Primary use case</Label>
          <Select
            id="primaryUseCase"
            defaultValue=""
            aria-invalid={!!errors.primaryUseCase}
            aria-describedby={errors.primaryUseCase ? "primaryUseCase-error" : undefined}
            {...register("primaryUseCase", {
              required: "Select a primary use case",
            })}
          >
            <option value="" disabled>
              Select a use case
            </option>
            {primaryUseCases.map((useCase) => (
              <option key={useCase} value={useCase}>
                {useCase}
              </option>
            ))}
          </Select>
          <FieldError id="primaryUseCase-error" message={errors.primaryUseCase?.message} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message (optional)</Label>
        <Textarea id="message" rows={4} {...register("message")} />
      </div>

      <Stack className="gap-4">
        <Button type="submit" disabled={isSubmitting} className="w-fit">
          {isSubmitting ? "Sending..." : "Request a demo"}
        </Button>
        {result ? <DevModeResult message={result} /> : null}
      </Stack>
    </form>
  );
}
