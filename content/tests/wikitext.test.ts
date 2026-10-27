import { describe, expect, it } from "vitest";
import { expandTemplates, formatNumber, stripFiles, toPlainText, UnsupportedWikitext } from "../src/lib/wikitext.js";

const NBSP = " ";
const plain = (s: string) => toPlainText(s).replaceAll(NBSP, " ");

describe("formatNumber", () => {
  it("groups thousands and uses a decimal comma", () => {
    expect(formatNumber("1234567.5")).toBe(`1${NBSP}234${NBSP}567,5`);
    expect(formatNumber("1500")).toBe("1500");
    expect(formatNumber("abc")).toBe("abc");
  });
});

describe("expandTemplates", () => {
  it("renders common templates", () => {
    const t = (s: string) => expandTemplates(s).replaceAll(NBSP, " ");
    expect(t("{{nobr|15 ans}}")).toBe("15 ans");
    expect(t("{{citation|révolte contre les forts}}")).toBe("« révolte contre les forts »");
    expect(t("{{date|1|janvier|1501}}")).toBe("1er janvier 1501");
    expect(t("{{date|01.01.2019|en astronomie}}")).toBe("1er janvier 2019");
    expect(t("{{date||juin|2007}}")).toBe("juin 2007");
    expect(t("{{date-|janvier 1959}}")).toBe("janvier 1959");
    expect(t("{{s|VI}}")).toBe("VIe siècle");
    expect(t("{{s-|I}}")).toBe("Ier");
    expect(t("{{1er}} janvier")).toBe("1er janvier");
    expect(t("{{XIXe siècle}}")).toBe("XIXe siècle");
    expect(t("{{unité|5|km|2}}")).toBe("5 km²");
    expect(t("{{nombre|12000|habitants}}")).toBe("12 000 habitants");
    expect(t("{{lang|en|New Horizons}}")).toBe("New Horizons");
    expect(t("{{noble|Napoléon Ier}}")).toBe("Napoléon Ier");
    expect(t("l’{{nobr|année 1}}")).toBe("l’année 1");
  });

  it("rejects unknown templates instead of guessing", () => {
    expect(() => expandTemplates("{{fchim|H|2|O}}")).toThrow(UnsupportedWikitext);
  });
});

describe("stripFiles", () => {
  it("removes file blocks including nested links", () => {
    expect(stripFiles("[[Fichier:X.jpg|40px|droite|Photo de [[Paris]].]]Texte")).toBe("Texte");
  });
});

describe("toPlainText", () => {
  it("cleans a 2024 anecdote", () => {
    const w =
      "<!--@ID_22896-->[[Fichier:Koromo-City-to-Toyota-City-1.jpg|40px|droite|Bannière célébrant le changement de nom. Photographié en {{date-|janvier 1959}}.]]La ville siège de [[Toyota]], '''[[Toyota (Aichi)|Koromo]]''' ''(photo)'', a décidé de changer son nom pour celui du constructeur automobile en 1959.";
    expect(plain(w)).toBe(
      "La ville siège de Toyota, Koromo, a décidé de changer son nom pour celui du constructeur automobile en 1959.",
    );
  });

  it("cleans a 2016 anecdote with a link trail", () => {
    const w =
      "[[Fichier:Schedel_erfurt.jpg|40px|right|Xylographie.]]   Tous les '''[[incunable]]s''' ''(xylographie)'' ont été [[Imprimerie|imprimés]] avant le {{date|1|janvier|1501}}.";
    expect(plain(w)).toBe("Tous les incunables ont été imprimés avant le 1er janvier 1501.");
  });

  it("drops 2004-era (voir …) pointers", () => {
    const w =
      "[[Sparte]] était une puissance terrestre tandis qu'[[Athènes]] était une puissance navale <small>(voir '''[[Guerre du Péloponnèse]]''')</small>.";
    expect(plain(w)).toBe("Sparte était une puissance terrestre tandis qu'Athènes était une puissance navale.");
  });

  it("rejects math markup", () => {
    expect(() => toPlainText("Le '''[[rayon solaire]]''' (<math>R_{\\odot}</math>)")).toThrow(UnsupportedWikitext);
  });
});

describe("apostrophe template and trailing dots", () => {
  it("keeps {{'}} next to bold markup and drops a doubled final dot", () => {
    const w = "En '''[[Somalie]]''', près de 100% des fillettes subissent l{{'}}'''[[excision]]'''. <small>[http://www.unicef.org/x.htm]</small>.";
    expect(toPlainText(w)).toBe("En Somalie, près de 100% des fillettes subissent l’excision.");
    expect(toPlainText("Et ainsi de suite...")).toBe("Et ainsi de suite...");
  });
});
