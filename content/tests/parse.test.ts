import { describe, expect, it } from "vitest";
import { findMainArticle, findMainDisplay, parseArchive, parsePublishedOn } from "../src/facts/parse.js";

describe("parsePublishedOn", () => {
  it("reads both date formats", () => {
    expect(parsePublishedOn("*:<small>présente 3 jours en page d'accueil du 01 janvier 2024 à 00:00:47")).toBe("2024-01-01");
    expect(parsePublishedOn("*:<small>présente en page d'accueil entre 2016-01-01 00:00:34 et 2016-01-03")).toBe("2016-01-01");
    expect(parsePublishedOn("*:<small>rien</small>")).toBeUndefined();
  });
});

describe("findMainArticle", () => {
  it("takes the first bold link", () => {
    expect(findMainArticle("La ville de [[Toyota]], '''[[Toyota (Aichi)|Koromo]]''' a…")).toBe("Toyota (Aichi)");
    expect(findMainArticle("'''''[[Smilodon fatalis]]''''' ronronne")).toBe("Smilodon fatalis");
    expect(findMainArticle("La [[Helaeomyia petrolei|'''mouche du pétrole''']] est…")).toBe("Helaeomyia petrolei");
    expect(findMainArticle("la mission '''{{nobr|''[[Vostok 4]]''}}'''")).toBe("Vostok 4");
  });

  it("ignores links inside file captions", () => {
    expect(findMainArticle("[[Fichier:X.jpg|40px|'''[[Paris]]''']]Le '''[[Louvre]]''' est…")).toBe("Louvre");
  });
});

describe("parseArchive", () => {
  const page = [
    "{{Palette Le saviez-vous}}",
    "* <!--@ID_22792-->Selon l’assistant [[Albert Pierrepoint|du bourreau]], '''[[James Inglis]]''' est allé se faire [[Pendaison|pendre]] en courant presque.",
    "*:<small>présente 3 jours en page d'accueil du 01 janvier 2024 à 00:00:47 au 04 janvier 2024 à 00:00:53.</small>",
    "* L’'''[[Université Laval]]''' est le plus ancien établissement d’enseignement supérieur du [[Canada]].",
  ].join("\n");

  it("extracts ids, subjects and dates", () => {
    const [a, b] = parseArchive(2024, page);
    expect(a).toMatchObject({ id: "lsv-22792", mainArticle: "James Inglis", publishedOn: "2024-01-01" });
    expect(b?.id).toMatch(/^lsv-2024-[0-9a-f]{12}$/);
    expect(b?.publishedOn).toBeUndefined();
  });

  it("is deterministic", () => {
    expect(parseArchive(2024, page)).toEqual(parseArchive(2024, page));
  });
});

describe("findMainDisplay", () => {
  it("returns the displayed text for plain bold links only", () => {
    expect(findMainDisplay("Le '''[[sodium]]''' réagit")).toBe("sodium");
    expect(findMainDisplay("la ville '''[[Toyota (Aichi)|Koromo]]''' a")).toBe("Koromo");
    expect(findMainDisplay("La [[Helaeomyia petrolei|'''mouche du pétrole''']] est")).toBe("mouche du pétrole");
    expect(findMainDisplay("Tous les '''[[incunable]]s''' ont")).toBeUndefined();
    expect(findMainDisplay("L’'''[[Ère chrétienne|l’{{nobr|année 1}}]]'''")).toBeUndefined();
  });
});
