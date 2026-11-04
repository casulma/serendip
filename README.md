# Serendip

Appli mobile personnelle de culture générale façon *Questions pour un champion*, 100 % hors ligne : on tape sa réponse, et les questions ratées reviennent plus tard avec le badge « ↻ À revoir ». Spécification : `docs/fonctionnel.md`.

- `content/` : la banque de questions (`content/questions/*.json`), sa vérification contre Wikipédia et l'assemblage du pack.
- `app/` : l'appli Expo (React Native), Android d'abord.

## Questions

Rédigées par Claude selon `docs/charte-questions.md`. Chaque question cite un article Wikipédia FR ; un script vérifie que la réponse (ou une variante acceptée) figure dans l'article, et seules les questions vérifiées entrent dans le pack.

```bash
pnpm install
pnpm --filter @serendip/content all     # vérifie (out/report-questions.md) puis construit out/pack.json
```

## Appli

Le pack est copié dans `app/assets/pack/` par `app/scripts/sync-pack.mjs` (lancé par `start`, `typecheck` et le build EAS).

```bash
cd app
npx eas-cli login
npx eas-cli build -p android --profile preview
```

Vérifications avant commit : `pnpm lint && pnpm typecheck && pnpm test`.
