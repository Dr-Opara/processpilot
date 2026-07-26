import "server-only";
import type { TrainingAssessmentQuestion } from "@/lib/db/database.types";

/**
 * Pure multiple-choice assessment scoring — shared by
 * training-assignments.ts's completeTrainingAssignment(). Deliberately
 * not a general assessment engine: one correct option per question, no
 * partial credit, no branching/adaptive logic.
 */
export interface ScoreAssessmentResult {
  scorePercent: number;
  passed: boolean;
}

export function scoreAssessment(
  questions: TrainingAssessmentQuestion[],
  answers: Record<string, string>,
  passingScorePercent: number,
): ScoreAssessmentResult {
  if (questions.length === 0) return { scorePercent: 100, passed: true };

  const correctCount = questions.filter(
    (question) => answers[question.id] === question.correctOptionKey,
  ).length;
  const scorePercent = Math.round((correctCount / questions.length) * 100);
  return { scorePercent, passed: scorePercent >= passingScorePercent };
}
