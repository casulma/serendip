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
  const mapping = { chimie: "sciences", bretagne: "geographie", "première guerre mondiale": "histoire", "armée française": "histoire" } as const;

  it("picks the majority category", () => {
    expect(categorize(["première guerre mondiale", "bretagne", "armée française"], mapping).category).toBe("histoire");
  });

  it("breaks ties with the first listed portal", () => {
    expect(categorize(["bretagne", "chimie"], mapping).category).toBe("geographie");
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
