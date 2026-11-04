import { z } from "zod";
import { CATEGORY_IDS } from "./categories.js";

// See docs/charte-questions.md for the editorial rules behind each field.
export const Question = z.object({
  id: z.string().regex(/^[a-z-]+-\d{3}$/),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  question: z.string().trim().min(10).endsWith("?"),
  answer: z.string().trim().min(1),
  accept: z.array(z.string().trim().min(1)),
  choices: z.array(z.string().trim().min(1)).length(3),
  explanation: z.string().trim().min(20),
  wikipedia: z.string().trim().min(1),
});

export const QuestionFile = z.object({ category: z.enum(CATEGORY_IDS), questions: z.array(Question) });

/** A question as shipped in the pack: its category inlined. */
export const PackQuestion = Question.extend({ category: z.enum(CATEGORY_IDS) });

export const Pack = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  questions: z.array(PackQuestion),
});

export type Question = z.infer<typeof Question>;
export type PackQuestion = z.infer<typeof PackQuestion>;
export type Pack = z.infer<typeof Pack>;
