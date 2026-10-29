# Serendip

Appli mobile personnelle de culture générale, 100 % hors ligne : des faits à découvrir chaque jour (en faisant défiler ou par notification), des quiz de révision (système de Leitner) et des quiz aléatoires.

- `content/` : pipeline d'extraction (OpenQuizzDB, Wikipédia FR « Le saviez-vous ? », Wikidata) qui produit le pack JSON versionné.
- `app/` : l'appli Expo (React Native), Android d'abord. Spécification fonctionnelle : `docs/fonctionnel.md`.

Le contenu n'est jamais rédigé par un LLM ni par nous : il vient uniquement des sources ci-dessus (questions OpenQuizzDB écrites par leurs rédacteurs, le reste extrait mécaniquement).

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

## Appli

Le pack (`content/out/pack.json` et les drapeaux) est copié dans `app/assets/pack/` par `app/scripts/sync-pack.mjs`, lancé automatiquement par `start`, `typecheck` et le build EAS.

Construire l'APK Android (compte gratuit sur expo.dev requis) :

```bash
pnpm install
cd app
npx eas-cli login
npx eas-cli build -p android --profile preview
```

Le lien et le QR code affichés à la fin permettent d'installer l'APK sur le téléphone.

Vérifications avant commit : `pnpm lint && pnpm typecheck && pnpm test`.

## Licences

Questions OpenQuizzDB : CC BY-SA 4.0, chaque question garde le crédit de son quiz et de son rédacteur. Textes issus de Wikipédia : CC BY-SA 4.0, chaque fait garde le lien vers son article source. Données Wikidata : CC0.
