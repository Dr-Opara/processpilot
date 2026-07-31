import { z } from "zod";

const workEmail = z.string().min(1, "Work email is required").email("Enter a valid email address");

export const employeeCountRanges = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

export const primaryUseCases = [
  "Standardizing operations across locations",
  "Employee onboarding and training",
  "Compliance and audit readiness",
  "Customer or service operations",
  "Something else",
] as const;

export const industries = [
  "Property management",
  "Healthcare operations",
  "Professional services",
  "Logistics",
  "Franchises",
  "Other",
] as const;

export const requestDemoSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  workEmail,
  company: z.string().min(1, "Company is required"),
  jobTitle: z.string().min(1, "Job title is required"),
  employeeCount: z.enum(employeeCountRanges, {
    error: "Select an employee count range",
  }),
  primaryUseCase: z.enum(primaryUseCases, {
    error: "Select a primary use case",
  }),
  message: z.string().optional(),
});

export type RequestDemoInput = z.infer<typeof requestDemoSchema>;

export const serviceAreas = [
  "AI services",
  "Cybersecurity services",
  "Compliance and governance",
  "Not sure yet",
] as const;

/**
 * Phase 31: a separate schema from requestDemoSchema, deliberately —
 * this is a professional-services project inquiry, not a SaaS product
 * demo request, even though the two forms share most fields.
 */
export const requestConsultationSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  workEmail,
  organization: z.string().min(1, "Organization is required"),
  serviceArea: z.enum(serviceAreas, {
    error: "Select a service area",
  }),
  message: z.string().optional(),
});

export type RequestConsultationInput = z.infer<typeof requestConsultationSchema>;

export const startTrialSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    workEmail,
    companyName: z.string().min(1, "Company name is required"),
    employeeCount: z.enum(employeeCountRanges, {
      error: "Select an employee count range",
    }),
    industry: z.enum(industries, {
      error: "Select an industry",
    }),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must include an uppercase letter")
      .regex(/[0-9]/, "Password must include a number"),
    agreeToTerms: z.literal(true, {
      error: "You must agree to the terms to continue",
    }),
  })
  .strict();

export type StartTrialInput = z.infer<typeof startTrialSchema>;
