# Serendip

Appli mobile personnelle de culture générale, 100 % hors ligne : un fait par notification, des quiz de révision (système de Leitner) et des quiz aléatoires.

- `content/` : pipeline d'extraction (Wikipédia FR « Le saviez-vous ? », Wikidata) qui produit le pack JSON versionné.
- `app/` : l'appli Expo (React Native), à venir.

Le contenu n'est jamais rédigé à la main ni par un LLM : il vient uniquement des sources ci-dessus, par traitement mécanique.

## Pipeline de contenu

Prérequis : Node ≥ 22.12 et pnpm (sous WSL).

```bash
pnpm install
pnpm --filter @serendip/content facts   # → content/out/facts.json + content/out/report-facts.md
pnpm test
pnpm typecheck
```

Les réponses brutes des API sont mises en cache dans `content/cache/` (hors git). Une relance ne retélécharge que ce qui manque, et le résultat est identique d'une exécution à l'autre. Supprimer le cache force une mise à jour complète depuis Wikipédia.

La catégorie d'un fait vient des portails de son article principal, via la table `content/mappings/portails.json` (modifiable à la main). Le rapport liste les portails non reconnus les plus fréquents.

## Licences

Textes issus de Wikipédia : CC BY-SA 4.0, chaque fait garde le lien vers son article source. Données Wikidata : CC0.
