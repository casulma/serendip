import { describe, expect, it } from "vitest";
import { categorize, extractPortals, mayChange } from "../src/facts/categorize.js";

describe("extractPortals", () => {
  it("reads multi-portal and legacy syntaxes, lowercased, deduplicated", () => {
    const w = "texte\n{{Portail|Première Guerre mondiale|Bretagne|armée française}}\n{{Portail chimie}}\n{{Portail|chimie}}";
    expect(extractPortals(w)).toEqual(["première guerre mondiale", "bretagne", "armée française", "chimie"]);
  });

  it("returns nothing without portals", () => {
    expect(extractPortals("Pas de portail ici.")).toEqual([]);
  });
});

describe("categorize", () => {
  const mapping = {
    strong: { chimie: "sciences", "première guerre mondiale": "histoire", "armée française": "histoire" },
    weak: { bretagne: "geographie", france: "geographie" },
  } as const;

  it("picks the majority category", () => {
    expect(categorize(["première guerre mondiale", "bretagne", "armée française"], mapping).category).toBe("histoire");
  });

  it("breaks ties with the first listed portal", () => {
    expect(categorize(["armée française", "chimie"], mapping).category).toBe("histoire");
    expect(categorize(["chimie", "armée française"], mapping).category).toBe("sciences");
  });

  it("ignores context portals when a thematic one matches", () => {
    expect(categorize(["bretagne", "france", "chimie"], mapping).category).toBe("sciences");
    expect(categorize(["bretagne", "paranormal"], mapping).category).toBe("geographie");
  });

  it("explains why nothing matched", () => {
    expect(categorize([], mapping)).toMatchObject({ category: undefined, reason: "aucun portail" });
    expect(categorize(["paranormal"], mapping)).toMatchObject({ category: undefined, reason: "aucun portail reconnu" });
  });
});

describe("mayChange", () => {
  it("flags time-sensitive wording", () => {
    expect(mayChange("Le glacier a actuellement disparu.")).toBe("actuellement");
    expect(mayChange("C’est le plus ancien établissement du Canada.")).toBe("le plus");
    expect(mayChange("Le sodium réagit avec l’eau.")).toBeUndefined();
  });
});

describe("mayChange with accents", () => {
  it("handles accented boundaries", () => {
    expect(mayChange("À ce jour, aucun spécimen n’a été trouvé.")).toBe("à ce jour");
    expect(mayChange("C’est la dernière locomotive.")).toBe("dernière");
    expect(mayChange("Une recordwoman")).toBeUndefined();
  });
});

describe("categorize with patterns", () => {
  it("applies patterns after explicit entries, per tier", () => {
    const mapping = {
      strong: { chimie: "sciences" },
      weak: {},
      patterns: [
        { regex: /^années \d{3,4}$/u, category: "histoire", tier: "weak" },
        { regex: /^cinéma\b/u, category: "musique-cinema", tier: "strong" },
      ],
    } as const;
    expect(categorize(["années 1960", "cinéma italien"], mapping).category).toBe("musique-cinema");
    expect(categorize(["années 1960", "inconnu"], mapping).category).toBe("histoire");
  });
});

describe("textProblem", () => {
  it("rejects truncated teasers and relative dates", async () => {
    const { textProblem } = await import("../src/facts/categorize.js");
    expect(textProblem("Savez-vous comment s'appelle un ensemble breton ? Réponse")).toBe("phrase incomplète");
    expect(textProblem("Il y a 121 ans, le Krakatoa explosait.")).toBe("date relative (fausse aujourd'hui)");
    expect(textProblem("Yang Huanyi est récemment décédée.")).toBe("date relative (fausse aujourd'hui)");
    expect(textProblem("Le Krakatoa a explosé en 1883.")).toBeUndefined();
    expect(textProblem("Céline Dion a gagné l'Eurovision… pour la Suisse.")).toBeUndefined();
  });
});
