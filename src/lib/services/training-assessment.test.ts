import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { scoreAssessment } from "./training-assessment";
import type { TrainingAssessmentQuestion } from "@/lib/db/database.types";

const questions: TrainingAssessmentQuestion[] = [
  {
    id: "q1",
    prompt: "2+2?",
    options: [
      { key: "a", label: "3" },
      { key: "b", label: "4" },
    ],
    correctOptionKey: "b",
  },
  {
    id: "q2",
    prompt: "Sky color?",
    options: [
      { key: "a", label: "Blue" },
      { key: "b", label: "Green" },
    ],
    correctOptionKey: "a",
  },
];

describe("scoreAssessment", () => {
  it("scores 100% and passes when a course has no questions", () => {
    expect(scoreAssessment([], {}, 80)).toEqual({ scorePercent: 100, passed: true });
  });

  it("computes the percentage of correct answers", () => {
    expect(scoreAssessment(questions, { q1: "b", q2: "b" }, 80)).toEqual({
      scorePercent: 50,
      passed: false,
    });
  });

  it("passes when the score meets the threshold", () => {
    expect(scoreAssessment(questions, { q1: "b", q2: "a" }, 80)).toEqual({
      scorePercent: 100,
      passed: true,
    });
  });

  it("fails when the score is below the threshold even with partial credit", () => {
    expect(scoreAssessment(questions, { q1: "b", q2: "b" }, 60)).toEqual({
      scorePercent: 50,
      passed: false,
    });
  });
});
