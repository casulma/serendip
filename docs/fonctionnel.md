# Serendip — spécification fonctionnelle (MVP)

## Contenu

Embarqué dans l'appli (pack JSON versionné), aucun appel réseau.

- **Source principale des faits : OpenQuizzDB** (questions écrites par des rédacteurs bénévoles, CC BY-SA 4.0). Un fait = une question à 4 choix, sa réponse et une anecdote, avec un lien Wikipédia et le crédit du quiz (titre, rédacteur).
- **Option, désactivée par défaut** : anecdotes « Le saviez-vous ? » de Wikipédia FR, plus énigmatiques.
- 10 catégories : Histoire, Géographie, Sciences, Nature & animaux, Arts & littérature, Musique & cinéma, Sport, Société & politique, Langue, Divers.
- Quiz aléatoire : questions issues de Wikidata (capitales, drapeaux, chefs-lieux, superficies, années de naissance, auteurs).

## Faits du jour

- **Quota quotidien : 10 faits par défaut**, réglable. Remise à zéro à minuit (heure du téléphone).
- **Par défaut, aucune notification** : les 10 faits se découvrent en faisant défiler l'onglet « Découvrir ».
- Avec **X notifications par jour** (X ≤ quota), le défilement est limité à **quota − X** faits. Les notifications arrivent toujours à leurs horaires, quoi que l'on ait fait défiler.
- Une carte OpenQuizzDB montre d'abord la question ; « Voir la réponse » révèle la réponse et l'anecdote.
- Le fil montre d'abord les faits déjà reçus aujourd'hui (défilés ou notifiés), puis de nouveaux faits jusqu'à sa limite. Une fois atteinte : « C'est tout pour aujourd'hui, à demain », avec accès au carnet et aux quiz.
- Faits tirés au hasard dans les catégories activées, jamais deux fois le même.
- Un fait reçu (défilé ou notifié) entre dans le carnet et dans les révisions.

## Accueil

- Dernier fait reçu, favori, « Je le savais déjà », accès au fil et aux quiz.
- **« Je le savais déjà »** : mention explicite « Ce fait ne vous sera plus proposé en révision », confirmation « Retirer ce fait de vos révisions ? Il restera dans votre carnet. » Réversible depuis le carnet (« Remettre en révision »).

## « Pas clair »

Sur chaque fait : le fait sort des révisions, du fil et du quota du jour (un autre est proposé), reste dans le carnet marqué et réversible. Réglages → « Exporter les signalements » partage la liste ; collée dans `content/mappings/exclusions.json`, elle écarte ces faits du pack suivant.

## Carnet

Tous les faits reçus : recherche, filtre favoris, lien vers la source, boîte de révision et prochaine date.

## Quiz « Révision »

- Uniquement sur les faits déjà reçus, hors « je le savais déjà » et « pas clair ».
- **Système de Leitner** (répétition espacée), nommé et expliqué dans l'appli : 5 boîtes, prochaine révision à 1 / 3 / 7 / 14 / 30 jours. Bonne réponse : boîte suivante. Erreur : retour en boîte 1.
- Faits OpenQuizzDB : leur propre question (4 choix). Anecdotes Wikipédia : QCM à trous quand il existe, sinon flashcard « je savais / je ne savais pas ».

## Quiz « Aléatoire »

Banque Wikidata indépendante des faits reçus. QCM 4 choix (texte ou drapeaux).

## Dans les deux quiz

Correction immédiate avec le fait ou la source, score en fin de session.

## Réglages

- Faits par jour (total), 10 par défaut.
- Notifications par jour : 0 par défaut, au plus le total ; horaires de chacune.
- Catégories activées.
- Anecdotes Wikipédia « Le saviez-vous ? » : désactivées par défaut.

## Statistiques

Taux de réussite par catégorie, nombre de faits appris (boîte 5 atteinte ou « je le savais déjà »). Pas de badges.

## Interface

Français, simple et lisible, mode sombre.

## V2

Widget écran d'accueil : un mot français rare (Wiktionnaire) et sa définition, renouvelé plusieurs fois par jour.
