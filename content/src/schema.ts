import { z } from "zod";
import { CATEGORY_IDS } from "./categories.js";

// A choice is either plain text or an embedded image (e.g. a flag), referenced
// by a path relative to the pack's asset folder.
export const Choice = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string().min(1) }),
  z.object({ kind: z.literal("image"), image: z.string().min(1), alt: z.string().min(1) }),
]);

export const Question = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  promptImage: z.string().min(1).optional(),
  answer: Choice,
  distractors: z.array(Choice).length(3),
  // 1 = easy, 3 = hard. Derived mechanically (e.g. from Wikidata sitelink counts).
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export const Category = z.enum(CATEGORY_IDS);

// Tags flag facts for later audit; never used to hide content.
export const FactTag = z.enum([
  "peut-changer", // contains a time-sensitive claim ("actuellement", superlatives…)
]);

export const Fact = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  category: Category,
  source: z.url(),
  // Date the anecdote appeared on the Wikipedia home page, if known (YYYY-MM-DD).
  publishedOn: z.iso.date().optional(),
  tags: z.array(FactTag),
  questions: z.array(Question),
});

export const Trivia = Question.extend({
  category: Category,
  family: z.string().min(1),
  wikidata: z.url(),
});

export const Pack = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  facts: z.array(Fact),
  trivia: z.array(Trivia),
});

export type Choice = z.infer<typeof Choice>;
export type Question = z.infer<typeof Question>;
export type Fact = z.infer<typeof Fact>;
export type Trivia = z.infer<typeof Trivia>;
export type Pack = z.infer<typeof Pack>;
