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
  requestConsultationSchema,
  serviceAreas,
  type RequestConsultationInput,
} from "@/lib/validation";

export function RequestConsultationForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RequestConsultationInput>();
  const [result, setResult] = useState<string | null>(null);

  async function onSubmit(data: RequestConsultationInput) {
    setResult(null);
    const parsed = requestConsultationSchema.safeParse(data);

    if (!parsed.success) {
      const seen = new Set<string>();
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof RequestConsultationInput;
        if (seen.has(field)) continue;
        seen.add(field);
        setError(field, { message: issue.message });
      }
      return;
    }

    const response = await fetch("/api/request-consultation", {
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
          <Label htmlFor="organization">Organization</Label>
          <Input
            id="organization"
            aria-invalid={!!errors.organization}
            aria-describedby={errors.organization ? "organization-error" : undefined}
            {...register("organization", { required: "Organization is required" })}
          />
          <FieldError id="organization-error" message={errors.organization?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="serviceArea">Service area</Label>
          <Select
            id="serviceArea"
            defaultValue=""
            aria-invalid={!!errors.serviceArea}
            aria-describedby={errors.serviceArea ? "serviceArea-error" : undefined}
            {...register("serviceArea", { required: "Select a service area" })}
          >
            <option value="" disabled>
              Select a service area
            </option>
            {serviceAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </Select>
          <FieldError id="serviceArea-error" message={errors.serviceArea?.message} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Tell us about the project (optional)</Label>
        <Textarea id="message" rows={4} {...register("message")} />
      </div>

      <Stack className="gap-4">
        <Button type="submit" disabled={isSubmitting} className="w-fit">
          {isSubmitting ? "Sending..." : "Discuss a project"}
        </Button>
        {result ? <DevModeResult message={result} /> : null}
      </Stack>
    </form>
  );
}
