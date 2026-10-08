# Pythonerie

Un espace d'apprentissage de la programmation **en français**, dans le navigateur.

L'écran est découpé en trois zones :

1. **Mes programmes** : l'arbre des programmes conservés, rangés dans des répertoires si on le souhaite, avec les exemples.
2. **L'éditeur** : toujours ouvert, avec coloration syntaxique, indentation automatique et complétion. La console est juste en dessous.
3. **Le canevas** : le programme peut y écrire, y dessiner, y faire avancer une tortue, animer des formes et réagir à la souris et au clavier.

Le langage est un pseudo-Python francisé (`si`, `sinon`, `pour … dans`, `tantque`, `fonction`, `retourne`…). Il est transpilé en LispE, puis exécuté par LispE compilé en WebAssembly, comme dans TamedAgents.

## Lancer Pythonerie

```bash
cd Pythonerie
python3 serveur.py          # ouvre http://localhost:8000
```

Options : `--port 8080`, `--hote 0.0.0.0` pour une salle de classe en réseau local, `--sans-navigateur`.

`serveur.py` n'utilise que la bibliothèque standard de Python. Il sert les fichiers et conserve les programmes dans `programmes/`, un fichier `.py` par programme. Les répertoires de l'arbre sont de vrais sous-répertoires (`programmes/Jeux/balle.py`).

On peut aussi servir le répertoire avec n'importe quel serveur statique (`python3 -m http.server`). Les programmes sont alors gardés dans le navigateur (`localStorage`). Il faut un serveur dans tous les cas : le WebAssembly ne se charge pas depuis `file://`.

## Ranger ses programmes

Comme dans TamedAgents :

- Le bouton répertoire crée un **répertoire**, et « ＋ Nouveau » crée un **programme**. Les deux vont dans le *dossier courant*, celui qu'on vient de cliquer (surligné) ou celui du programme ouvert. Un clic dans la zone vide de l'arbre revient à la racine. Les exemples et les fichiers importés vont aussi dans le dossier courant.
- Un clic sur un répertoire l'ouvre ou le replie.
- Au survol d'une ligne apparaissent les actions : renommer, exporter (télécharger le `.py`) et supprimer pour un programme ; renommer et supprimer pour un répertoire.
- Supprimer un répertoire ne détruit rien : son contenu remonte d'un niveau. En cas de doublon, un nom devient « nom 2 ».
- On range un programme ou un répertoire en le glissant sur un répertoire. On le ramène à la racine en le glissant dans la zone vide de l'arbre ou sur le titre « Mes programmes ».

## Le langage en bref

```python
# Les blocs se repèrent à l'indentation ; la ligne qui ouvre un bloc finit par ":"
fonction carre(x):
    retourne x * x

pour i dans intervalle(1, 6):
    si i % 2 == 0:
        affiche(i, "est pair, son carré vaut", carre(i))
    sinon:
        affiche(f"{i} est impair")

notes = [12, 15, 9]
notes.ajoute(18)
pairs = [n pour n dans notes si n % 2 == 0]

fond("bleu clair")
couleur("jaune")
disque(400, 300, 80)
texte(330, 420, "Bonjour !")
```

| Python | Pythonerie |
|---|---|
| `if / elif / else` | `si / sinonsi / sinon` |
| `while` | `tantque` |
| `for x in l` | `pour x dans l` |
| `def` | `fonction` (ou `def`) |
| `return / break / continue / raise` | `retourne` (ou `renvoie`) `/ sortir / continuer / lever` |
| `and / or / not / in / is` | `et / ou / non / dans / est` |
| `True / False / None` | `Vrai / Faux / Rien` |
| `class / self` | `classe / soi` |
| `try / except` | `essaie / sauf` (ou `attrape`) |
| `global` | `globale` |
| `match / case` | `selon (x): / cas "a": …` |
| `print` | `affiche` (avec retour à la ligne), `ecris` (sans) |
| `", ".join(l)` | `", ".joindre(l)` |

Pythonerie suit les règles de Python là où LispE en diffère :

- `1 + 0.5` vaut `1.5`, `1 < 1.5` est vrai et `[1, 2] + [3]` vaut `[1, 2, 3]`. En LispE, c'est le type du premier argument qui l'emporte.
- `affiche` montre `[1, 2]`, `Vrai` et `{"a": 1}`.
- Dans une fonction, `x = …` crée une variable locale. `globale x` permet de modifier la variable du programme. `x += …` modifie directement la variable du programme si la fonction n'a pas de variable locale `x`, ce qui simplifie les animations.
- Une fonction de l'élève peut porter le nom d'une fonction de la bibliothèque (`somme`, `carre`…) ou d'une instruction LispE (`max`, `sum`…). Une variable peut aussi s'appeler `somme`, `max` ou `largeur`. Le transpileur renomme ces noms (`somme_perso`, `max_v`), car LispE interdit les redéfinitions.

Les accents sont facultatifs dans les mots-clefs, les fonctions et les noms de couleurs : `épaisseur` ou `epaisseur`, `carré` ou `carre`, `va_à` ou `va_a`, `règle` ou `regle`, `"gris foncé"` ou `"gris fonce"`. L'analyseur et le transpileur comparent les formes passées par `deaccentuate`. Les noms choisis par l'élève (`élève`, `résultat`) gardent leurs accents : `élève` et `eleve` sont deux variables différentes, comme en Python.

Le bouton **λ LispE** montre le code LispE produit. Le bouton **❓ Aide** présente toutes les fonctions.

### Dessin, tortue, animation

Le canevas mesure 800 × 600. L'origine est en haut à gauche et y augmente vers le bas.

- Formes : `point`, `ligne`, `rectangle`/`rectangle_plein`, `carre`/`carre_plein`, `cercle`, `disque`, `ellipse`/`ellipse_pleine`, `triangle`/`triangle_plein`, `polygone`/`polygone_plein`.
- Style : `fond`, `couleur`, `couleur_trait`, `couleur_remplissage`, `epaisseur`, `rgb(r, g, b)`. Les noms de couleurs sont en français (`"rouge"`, `"bleu clair"`…), et toute couleur CSS est acceptée.
- Texte : `texte(x, y, message)`, `taille_texte`, `police`.
- Saisie au clavier : `demande("Ton nom ?")` renvoie un texte, `demande_nombre(...)` un nombre. Les synonymes sont `lire`, `lire_nombre` et `input`. La question s'affiche dans une boîte de dialogue du navigateur.
- Tortue : `avance`, `recule`, `gauche`, `droite`, `lève_crayon`, `baisse_crayon`, `va_à`, `oriente`, `origine`, `cache_tortue`. La tortue n'apparaît qu'à la première commande de tortue.
- Animation et événements : `animer(fonction, délai_ms)`, `quand_clic(f)` qui appelle `f(x, y)`, `quand_souris(f)`, `quand_touche(f)` qui appelle `f(touche)`, et `arrete()`.

## Organisation du répertoire

```
Pythonerie/
├── index.html            les trois zones et l'aide
├── style.css             thème clair et sombre (palette de TamedAgents)
├── serveur.py            serveur local et API des programmes
├── js/
│   ├── pythonerie.js     application : programmes, éditeur, compilation, exécution
│   ├── canevas.js        API de dessin (objet Pyt) appelée depuis LispE
│   └── mode-pythonerie.js coloration CodeMirror, complétion
├── lispe/                copie de lispe/ de TamedAgents : LispE en WebAssembly
│   ├── lispe.js, lispe.wasm
│   └── lispe_functions.js   API JS : callCreateLispE, callEvalLispE…
├── basic/                le langage francisé
│   ├── basic.grm         grammaire (mots-clefs français)
│   ├── compiler.lisp     génère basic.lisp à partir de basic.grm
│   ├── rules.lisp        règles de découpage utilisées par compiler.lisp
│   ├── basic.lisp        analyseur généré (ne pas modifier à la main)
│   ├── transpiler.lisp   arbre → LispE, indentation → balises de fin, règles Python
│   └── bibliotheque.lisp fonctions françaises et liaisons vers le canevas
├── exemples/             dix exemples progressifs (index.json)
└── programmes/           programmes des élèves et leurs répertoires (avec serveur.py)
```

### API de serveur.py

Un chemin désigne un programme (sans `.py`) ou un répertoire : `Jeux/Balle`.

| Requête | Effet |
|---|---|
| `GET /api/programmes` | `{"programmes": [{"chemin", "modifie"}], "dossiers": [...]}` |
| `GET /api/programmes/<chemin>` | contenu du programme |
| `PUT /api/programmes/<chemin>` | enregistre le programme et crée les répertoires si besoin |
| `POST /api/programmes/<chemin>` `{"renomme": "nouveau/chemin"}` | renomme ou déplace |
| `DELETE /api/programmes/<chemin>` | supprime le programme |
| `POST /api/dossiers/<chemin>` `{}` ou `{"renomme": ...}` | crée, renomme ou déplace un répertoire |
| `DELETE /api/dossiers/<chemin>` | supprime le répertoire, son contenu remonte d'un niveau |

Les chemins qui sortiraient de `programmes/` (`..`, noms commençant par un point) sont refusés.

### Chaîne d'exécution

1. `transpiler.lisp` (`compilepython`) réécrit d'abord les f-chaînes. Il transforme ensuite l'indentation en balises explicites (`finsi`, `finpour`, `finfonction`…).
2. `basic.lisp` construit l'arbre syntaxique. `transpiler.lisp` le traduit en LispE et applique les règles de Python : opérateurs numériques, portée des variables, noms réservés, affichage.
3. Un interpréteur LispE neuf charge `bibliotheque.lisp`, puis exécute le code.
4. Les fonctions de dessin appellent JavaScript par `evaljs` : `(evaljs (list "Pyt.cercle" x y r false))` exécute `Pyt.cercle(x, y, r, false);` dans `canevas.js`. Les animations et les événements rappellent LispE avec `callEvalLispE`.

### Modifier la grammaire

Après une modification de `basic/basic.grm`, on régénère l'analyseur :

```bash
cd basic
lispe compiler.lisp      # réécrit basic.lisp
```

### Limites connues

- Le programme s'exécute dans la page. Une boucle sans fin (`tantque Vrai:` sans `sortir`) bloque l'onglet. Pour une animation, il faut utiliser `animer`.
- `Rien` (nil) s'affiche `[]`, car LispE ne distingue pas `nil` de la liste vide.
- Les numéros de ligne des erreurs d'exécution renvoient au code LispE (bouton λ LispE), pas au programme d'origine.
- Une ligne qui commence par `[` ou `(` juste après une expression peut être lue comme la suite de cette expression. Pour une affectation multiple, il faut écrire `a, b = b, a + b` plutôt que `[a, b] = …`.
