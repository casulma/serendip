import { describe, expect, it } from "vitest";
import { checkQuestion } from "../src/bank.js";
import { normalize } from "../src/normalize.js";
import type { PackQuestion } from "../src/schema.js";

const q = (over: Partial<PackQuestion> = {}): PackQuestion => ({
  id: "histoire-001",
  category: "histoire",
  difficulty: 1,
  question: "Quel roi de France fut surnommé le Roi-Soleil ?",
  answer: "Louis XIV",
  accept: ["Louis 14"],
  choices: ["Louis XIII", "Louis XV", "Henri IV"],
  explanation: "Louis XIV se fit représenter en Apollon, dieu du Soleil, dès 1653.",
  wikipedia: "Louis XIV",
  ...over,
});

describe("normalize", () => {
  it("drops case, accents, ligatures and punctuation", () => {
    expect(normalize("L’Œuvre au Noir !")).toBe("l oeuvre au noir");
  });
});

describe("checkQuestion", () => {
  it("accepts a well-formed question", () => {
    expect(checkQuestion(q())).toEqual([]);
  });

  it("rejects birth-year questions and wrong choices", () => {
    expect(checkQuestion(q({ question: "En quelle année est né Victor Hugo ?" })).map((i) => i.message)).toContain(
      "date de naissance (interdit par la charte)",
    );
    expect(checkQuestion(q({ choices: ["Louis 14", "Louis XV", "Henri IV"] }))[0]!.message).toBe("une proposition est une bonne réponse");
    expect(checkQuestion(q({ choices: ["Louis XV", "louis xv", "Henri IV"] }))[0]!.message).toBe("propositions en double");
    expect(checkQuestion(q({ id: "geographie-001" }))[0]!.message).toBe("identifiant hors catégorie");
  });

  it("warns when the answer leaks into the question", () => {
    const issues = checkQuestion(q({ question: "Quel roi, Louis XIV, fut surnommé le Roi-Soleil ?", answer: "Louis XIV" }));
    expect(issues).toEqual([{ id: "histoire-001", level: "alerte", message: "la question contient la réponse (« louis xiv »)" }]);
    // A shared generic word is not a giveaway.
    expect(checkQuestion(q({ question: "Quelle guerre opposa la Russie à la France de 1853 à 1856 ?", answer: "guerre de Crimée", accept: [] }))).toEqual([]);
  });
});
