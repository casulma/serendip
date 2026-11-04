# Charte de rédaction des questions Serendip

Style visé : **Questions pour un champion** / quiz de culture générale de bonne tenue.
Une question = un énoncé clair, **une seule bonne réponse courte**, que l'on tape au clavier.
Les questions sont rédigées par Claude puis vérifiées automatiquement contre l'article Wikipédia FR cité
(la réponse, ou une variante acceptée, doit apparaître dans l'article).

## Format (JSON, un fichier par catégorie : `content/questions/<categorie>.json`)

```json
{
  "category": "histoire",
  "questions": [
    {
      "id": "histoire-001",
      "difficulty": 1,
      "question": "Quel roi de France fut surnommé le Roi-Soleil ?",
      "answer": "Louis XIV",
      "accept": ["Louis 14"],
      "choices": ["Louis XIII", "Louis XV", "Henri IV"],
      "explanation": "Louis XIV se fit représenter en Apollon, dieu du Soleil, dès le Ballet royal de la nuit en 1653.",
      "wikipedia": "Louis XIV"
    }
  ]
}
```

| Champ | Règle |
|---|---|
| `id` | `<categorie>-<numéro sur 3 chiffres>`, unique, sans trou |
| `difficulty` | 1 = grand public, 2 = bon joueur, 3 = expert. Viser ≈ 40 % / 40 % / 20 % |
| `question` | 8 à 30 mots, se termine par « ? ». Ne contient pas la réponse ni un mot de la réponse |
| `answer` | 1 à 4 mots, forme la plus attendue (« Louis XIV », « Canberra », « l'ornithorynque » → écrire « ornithorynque ») |
| `accept` | variantes réellement acceptables (orthographe, nom seul, abréviation, chiffres/lettres). Peut être vide |
| `choices` | exactement 3 fausses réponses **plausibles, de même nature** que la réponse (même type, même époque, même ordre de grandeur) |
| `explanation` | 1 à 2 phrases (15 à 45 mots) qui **apprennent quelque chose en plus**, pas une reformulation |
| `wikipedia` | titre **exact** d'un article de Wikipédia en français où figure la réponse |

## Ce qu'on veut
- **De la variété** : chaque question doit pouvoir surprendre ou faire dire « ah oui ! ».
- Des formulations à la QPUC : « Quel… », « Qui… », « Comment appelle-t-on… », « Dans quelle ville… », « Je suis… » est permis.
- Des faits **stables et vérifiables**, connus des encyclopédies.
- Un équilibre entre le très connu (difficulté 1) et le pointu mais juste (3).

## Ce qu'on ne veut pas
- **Pas de dates de naissance**, pas de « en quelle année est né… ». Les dates en général : au plus 1 question sur 15, et seulement des dates marquantes (1789, 1969…).
- Pas de nombres trop précis (population, superficie, records chiffrés qui changent).
- Rien de daté ou qui peut changer : « actuel », « en 2023 », records en cours, palmarès récents, personnes en fonction.
- Pas de questions pièges, ambiguës, ou dont la réponse dépend d'une convention discutable.
- Pas de doublon (même fait sous deux formes).
- Pas de contenu choquant, ni de people ou télé-réalité.

## Catégories et objectif (1 000 questions)

| Catégorie (`category`) | Libellé | Questions |
|---|---|---:|
| `histoire` | Histoire | 120 |
| `geographie` | Géographie | 120 |
| `sciences` | Sciences & techniques | 110 |
| `nature` | Nature & animaux | 90 |
| `arts-litterature` | Arts & littérature | 100 |
| `musique` | Musique | 70 |
| `cinema-tv` | Cinéma & télévision | 80 |
| `sport` | Sport & jeux | 80 |
| `langue` | Langue & expressions | 70 |
| `mythologie` | Mythologies & religions | 50 |
| `gastronomie` | Gastronomie & vie quotidienne | 60 |
| `societe` | Société, politique & économie | 50 |
