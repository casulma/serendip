import { describe, expect, it } from "vitest";
import { BLANK, makeCloze } from "../src/fact-questions/cloze.js";
import type { Entity } from "../src/fact-questions/wikidata.js";

const ent = (qid: string, label: string, types = ["Q11344"], occupations: string[] = []): Entity => ({
  qid,
  label,
  types,
  occupations,
  sitelinks: 100,
});

const elements = [ent("Q1", "hydrogène"), ent("Q2", "hélium"), ent("Q3", "lithium"), ent("Q4", "potassium"), ent("Q5", "fer")];

describe("makeCloze", () => {
  it("hides the main entity and draws same-type distractors", () => {
    const r = makeCloze(
      { factId: "lsv-1", text: "Le sodium réagit avec l’eau en produisant de l’hydroxyde.", display: "sodium", entity: ent("Q658", "sodium") },
      elements,
    );
    expect("question" in r).toBe(true);
    if (!("question" in r)) return;
    expect(r.question.prompt).toBe(`Complétez : Le ${BLANK} réagit avec l’eau en produisant de l’hydroxyde.`);
    expect(r.question.answer).toEqual({ kind: "text", text: "sodium" });
    expect(r.question.distractors).toHaveLength(3);
  });

  it("rejects when the displayed text is not the Wikidata label", () => {
    const r = makeCloze({ factId: "x", text: "La ville de Koromo a changé de nom.", display: "Koromo", entity: ent("Q9", "Toyota") }, elements);
    expect(r).toEqual({ reason: "texte affiché ≠ libellé Wikidata" });
  });

  it("rejects when the answer leaks elsewhere in the text", () => {
    const r = makeCloze(
      { factId: "x", text: "Smilodon fatalis ronronnait, comme tout Smilodon.", display: "Smilodon fatalis", entity: ent("Q9", "Smilodon fatalis") },
      elements,
    );
    expect(r).toEqual({ reason: "réponse devinable dans le texte" });
  });

  it("keeps elision honest: only vowel-initial distractors after l’", () => {
    const r = makeCloze(
      { factId: "x", text: "L’argon est un gaz noble.", display: "argon", entity: ent("Q696", "argon") },
      [...elements, ent("Q6", "or"), ent("Q7", "uranium"), ent("Q8", "étain")],
    );
    if (!("question" in r)) throw new Error(r.reason);
    for (const d of r.question.distractors) expect(d.kind === "text" && /^[aeiouyhé]/i.test(d.text)).toBe(true);
  });

  it("requires a shared occupation for people", () => {
    const people = [
      ent("Q10", "Victor Hugo", ["Q5"], ["Q36180"]),
      ent("Q11", "Émile Zola", ["Q5"], ["Q36180"]),
      ent("Q12", "Zinédine Zidane", ["Q5"], ["Q937857"]),
      ent("Q13", "Honoré de Balzac", ["Q5"], ["Q36180"]),
    ];
    const r = makeCloze(
      { factId: "x", text: "Gustave Flaubert détestait les bourgeois.", display: "Gustave Flaubert", entity: ent("Q14", "Gustave Flaubert", ["Q5"], ["Q36180"]) },
      people,
    );
    if (!("question" in r)) throw new Error(r.reason);
    expect(r.question.distractors.map((d) => (d.kind === "text" ? d.text : "")).sort()).toEqual(["Honoré de Balzac", "Victor Hugo", "Émile Zola"]);
  });

  it("is deterministic", () => {
    const input = { factId: "lsv-1", text: "Le sodium réagit avec l’eau.", display: "sodium", entity: ent("Q658", "sodium") };
    expect(makeCloze(input, elements)).toEqual(makeCloze(input, [...elements].reverse()));
  });
});

describe("areSiblings", () => {
  it("ignores overly generic types and compares taxa by class", async () => {
    const { areSiblings } = await import("../src/fact-questions/cloze.js");
    expect(areSiblings(ent("Q1", "a", ["Q43229"]), ent("Q2", "b", ["Q43229"]))).toBe(false);
    const bird = { ...ent("Q3", "pie", ["Q16521"]), taxonClass: "Q5113" };
    const bird2 = { ...ent("Q4", "geai", ["Q16521"]), taxonClass: "Q5113" };
    const plant = { ...ent("Q5", "vacoa", ["Q16521"]), taxonClass: "Q25314" };
    expect(areSiblings(bird, bird2)).toBe(true);
    expect(areSiblings(bird, plant)).toBe(false);
    expect(areSiblings(bird, ent("Q6", "x", ["Q16521"]))).toBe(false);
  });
});
