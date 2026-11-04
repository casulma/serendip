# Serendip — spécification fonctionnelle

Quiz de culture générale façon *Questions pour un champion*, 100 % hors ligne.

## Contenu
- Banque de questions rédigées par Claude selon `docs/charte-questions.md`, en 12 catégories, 3 niveaux (Facile, Moyen, Expert).
- Chaque question cite un article Wikipédia FR ; seules les questions dont la réponse figure dans l'article sont embarquées (vérification automatique, `pnpm --filter @serendip/content verify`).
- Pas de dates de naissance, rien d'éphémère.

## Partie
- 5, 10 ou 20 questions (10 par défaut), catégories prises à tour de rôle pour varier.
- On **tape la réponse**. Sont acceptés : majuscules/accents/ponctuation, articles (« la Joconde »), petites fautes de frappe sur les mots longs, nom de famille seul (« Einstein »), chiffres en lettres, variantes prévues. Les nombres doivent être exacts.
- « Voir 4 propositions » : QCM de secours, la bonne réponse rapporte 1 point au lieu de 2.
- « Je passe » : compte comme une erreur.
- Correction immédiate : bonne réponse, explication qui apprend quelque chose, lien vers l'article.
- « J'avais bon » : si le correcteur refuse une réponse juste, on la compte juste.
- Score en fin de partie et récapitulatif.

## Questions à revoir
- Une question ratée (ou passée) passe **à revoir**.
- À partir du lendemain, elle revient dans les parties suivantes (jusqu'à 30 % d'une partie) avec le badge **↻ À revoir**.
- Trouvée : elle sort des questions à revoir (« Rattrapée ! »).
- L'accueil affiche le nombre de questions à revoir et propose « Revoir mes erreurs maintenant » (toutes, sans attendre le lendemain).

## Stats
Réponses, taux de réussite, questions à revoir, part de la banque découverte ; réussite et avancement par catégorie.

## Réglages
Questions par partie, niveaux, catégories (avec le nombre de questions correspondantes), explication du fonctionnement, crédits.

## Interface
Français, mode sombre, une couleur et un pictogramme par catégorie.
