# Écrire des programmes pour La Pythonerie — guide pour Claude

Ce fichier s'adresse à Claude (ou à toute autre IA) à qui l'on demande d'écrire un programme pour **La Pythonerie** : https://clauderouxster.github.io/Pythonerie/ (dépôt : https://github.com/clauderouxster/Pythonerie).

La Pythonerie fait programmer des enfants (à partir de 7 ans) dans un **Python en français**. Le programme est traduit en LispE, puis exécuté dans le navigateur (WebAssembly). Ce n'est pas du Python : beaucoup de choses se ressemblent, mais les mots-clefs sont français, la bibliothèque est différente, et certaines tournures de Python n'existent pas (voir « Pièges »).

## Ce que tu dois rendre

- **Un seul programme complet**, dans un bloc de code. L'élève le colle dans l'éditeur (ou l'importe en `.py`) et clique sur « Exécuter ».
- Une première ligne de commentaire avec le titre, puis quelques lignes qui expliquent comment jouer ou utiliser le programme.
- **Des noms français avec leur orthographe correcte** : `épaisseur`, `état`, `vitesse_balle`. Les accents sont obligatoires dans les noms du langage (`va_à`, `lève_crayon`, `carré`), et souhaités dans les tiens.
- Des commentaires courts et simples, lisibles par un enfant.
- Pas de dépendance extérieure : seuls les fichiers du site (voir « Médias ») et les fonctions listées ici existent.

## Le langage

Les blocs se repèrent au **décalage de 4 espaces**. La ligne qui ouvre un bloc se termine par `:`.

| Python | La Pythonerie |
|---|---|
| `if / elif / else` | `si / sinonsi / sinon` |
| `while` | `tantque` |
| `for x in l` | `pour x dans l` |
| `def f(x):` | `fonction f(x):` (ou `def`) |
| `return` | `retourne` (ou `renvoie`) ; `retourne Rien` pour sortir tôt |
| `break / continue` | `sortir / continuer` |
| `raise "msg"` | `lever "msg"` |
| `try / except Exception as e` | `essaie:` … `sauf(e):` (ou `attrape(e):`) — les parenthèses sont obligatoires |
| `and / or / not / in / not in / is` | `et / ou / non / dans / non dans / est` ; `oux` = ou exclusif |
| `True / False / None` | `Vrai / Faux / Rien` |
| `class C: / self` | `classe C:` / `soi` (méthodes avec `def`, constructeur `__init__(soi, …)`) |
| `match x: case "a":` | `selon (x):` puis `cas "a": …` |
| `lambda x: x * 2` | `lambda(x) x * 2` (ou `λ`) |
| `f"{x}"` | `f"{x}"` (les expressions entre accolades suivent la syntaxe de la Pythonerie) |
| `[x * x for x in l if x > 0]` | `[x * x pour x dans l si x > 0]` |
| `a, b = b, a` | `a, b = b, a` (et `x, y = point` pour dépaqueter une liste) |
| `global x` | **n'existe pas** : voir ci-dessous |

Opérateurs : `+ - * / // % **`, `+= -= *= /=`, comparaisons `== != < <= > >=`. Les listes (`[1, 2]`, `l[0]`, `l[-1]`, `l[1:3]`, `l[i] = v`) et les dictionnaires (`{"a": 1}`, `d["b"] = 2`, `pour clé dans d`) fonctionnent comme en Python. Les chaînes `"…"` acceptent `\n` ; les chaînes `"""…"""` ou `'''…'''` peuvent s'étendre sur plusieurs lignes et gardent leur contenu tel quel, sans échappement.

### Variables du programme et fonctions

- Dans une fonction, `x = …` crée une **variable locale**.
- `x =: …` modifie la **variable du programme** (c'est le `global` de Python).
- `x += …` (et `-=`, `*=`…) modifie la variable du programme si la fonction n'a pas de variable locale `x`.
- Lire une variable du programme, ou modifier une liste du programme (`l[i] = v`, `l.ajoute(x)`), ne demande rien de particulier.
- Un élève peut nommer ses variables comme il veut, même comme une fonction de la bibliothèque (`gauche`, `somme`) : elles sont renommées automatiquement.

## La bibliothèque

### Console
`affiche(a, b, …)` (avec retour à la ligne), `écris(a, …)` (sans), `efface_console()`, `demande(question)` → texte, `demande_nombre(question)` → nombre (`lire`, `lire_nombre`, `input` sont des synonymes).

### Nombres
`aléatoire(a, b)` (entier, bornes comprises), `hasard()` (entre 0 et 1), `choisis(liste)`, `absolu(x)` (ou `abs`), `racine(x)`, `puissance(x, y)`, `arrondi(x)` / `arrondi(x, n)`, `somme(l)`, `maximum(l)` ou `maximum(a, b)`, `minimum(…)`, `sinus(degrés)`, `cosinus(degrés)`, `pi`, `entier(x)`, `réel(x)`, `nombre(texte)` (réel, accepte « 2,5 », 0.0 sinon), `chaîne(x)`, `type_de(x)`, `intervalle(fin)` / `intervalle(début, fin, pas)` (ou `range`), `longueur(x)` (ou `len`).

`7 / 2` vaut `3.5`, `7 // 2` vaut `3`, `[1, 2] + [3]` vaut `[1, 2, 3]`.

### Listes et textes
`liste.ajoute(x)` (ou `append`), `trie(l)`, `inverse(l)`, `contient(conteneur, x)`, `majuscules(t)`, `minuscules(t)`, `remplace(t, avant, après)`, `découpe(t, séparateur)` (aux espaces par défaut), `nettoie(t)` (ou `strip`), `"sép".joindre(l)`. Les fonctions de texte s'écrivent aussi comme des méthodes : `ligne.découpe(",")`, `texte.majuscules()`.

### Dessin (canevas de 800 × 600, origine en haut à gauche, y vers le bas)
- `canevas(largeur, hauteur)` change la taille (à appeler au début ; le dessin est effacé) ; `largeur()`, `hauteur()` donnent la taille actuelle. Chaque exécution repart de 800 × 600.
- `efface()`, `fond(c)`, `couleur(c)` (trait et remplissage), `couleur_trait(c)`, `couleur_remplissage(c)`, `épaisseur(e)`, `rgb(r, g, b)`.
- `point(x, y)`, `ligne(x1, y1, x2, y2)`, `rectangle(x, y, l, h)`, `carré(x, y, côté)`, `cercle(x, y, r)`, `disque(x, y, r)`, `ellipse(x, y, rx, ry)`, `triangle(x1, y1, x2, y2, x3, y3)`, `polygone([[x1, y1], [x2, y2], …])`, et leurs versions pleines : `rectangle_plein`, `carré_plein`, `ellipse_pleine`, `triangle_plein`, `polygone_plein` (`disque` est le cercle plein).
- `texte(x, y, message)` : (x, y) est le **coin en haut à gauche** du texte. `taille_texte(n)`, `police(nom)`.
- Couleurs : `rouge, vert, bleu, jaune, orange, violet, rose, marron, noir, blanc, gris, cyan, magenta, turquoise, beige, or, argent, bleu marine`, et les nuances avec `clair` ou `foncé` (invariables) : `rouge clair, rouge foncé, vert clair, vert foncé, bleu clair, bleu foncé, jaune clair, jaune foncé, orange clair, orange foncé, violet clair, violet foncé, rose clair, rose foncé, marron clair, marron foncé, gris clair, gris foncé`. Toute couleur CSS marche aussi (`"#ff8800"`). Un nom inconnu (`"vert pomme"`) ne fait rien : utilise `rgb(…)`.

### Tortue (part du centre, regarde vers la droite)
`avance(d)`, `recule(d)`, `gauche(angle)`, `droite(angle)`, `lève_crayon()`, `baisse_crayon()`, `va_à(x, y)`, `oriente(angle)` (0 = droite, 90 = bas), `origine()`, `montre_tortue()`, `cache_tortue()`, `position_x()`, `position_y()`, `cap()`. La tortue n'apparaît qu'à sa première commande ; dans un jeu, appelle `cache_tortue()`.

### Animation et événements
- `animer(f, délai)` appelle `f()` toutes les `délai` millisecondes (16 à 30 pour un jeu fluide). C'est **la seule façon** de faire une boucle de jeu.
- `quand_clic(f)` → `f(x, y)` ; `quand_souris(f)` → `f(x, y)` quand la souris bouge ; `quand_glisse(f)` → `f(x, y)` quand elle bouge bouton appuyé (ou le doigt sur une tablette) ; `quand_touche(f)` → `f(touche)`. Un seul gestionnaire par événement (un nouvel appel remplace le précédent).
- Noms des touches, **en français** : `"gauche"`, `"droite"`, `"haut"`, `"bas"`, `"espace"`, `"entrée"`, `"échap"`, `"retour arrière"`, `"tabulation"`, `"suppr"`, `"début"`, `"fin"`, `"page haut"`, `"page bas"`, `"maj"`, `"ctrl"`, `"alt"` ; une lettre, un chiffre ou un signe reste tel quel (`"a"`, `"z"`, `"7"`). Pense aux claviers AZERTY : Z Q S D plutôt que W A S D.
- `saisie(clef, x, y, f)` pose un champ de saisie (une case de texte de 200 points de large, sauf `largeur_saisie`) au point (x, y) du canevas ; `clef` est son nom. Le champ prend la police (`police`) et la taille (`taille_texte`) courantes au moment de sa création : règle-les avant d'appeler `saisie`. Entrée, ou un clic dans un autre champ (si la valeur a changé), appelle `f(clef, valeur)` ; la valeur est toujours un texte (`entier(valeur)` pour un nombre). Un nouvel appel avec la même clef déplace le champ. Les touches tapées dans un champ ne vont pas à `quand_touche`.
- `active_saisie(clef)` donne la main à un champ (son contenu est sélectionné ; le champ quitté envoie sa valeur si elle a changé) ; `saisie_active()` renvoie la clef du champ actif (`""` sinon) ; `largeur_saisie(l)` règle la largeur des champs créés ensuite (200 au départ). Dans un champ, `haut`, `bas` et `entrée` sont transmis à `quand_touche`, ainsi que `gauche` / `droite` quand le curseur est au bord du texte : c'est ce qui permet de passer de champ en champ (voir `18_tableur.py`). Pour convertir la valeur, `nombre(valeur)` accepte « 2,5 » comme « 2.5 » et donne `0.0` si ce n'est pas un nombre.
- `arrête()` arrête les animations. L'élève a aussi un bouton « Arrêter » et un mode plein écran.
- Le clavier ne marche qu'après un clic dans le canevas (ou en plein écran) : dis-le dans les commentaires.

### Images et sons
`img = charge_image(adresse)`, `place_image(img, x, y)` ou `place_image(img, x, y, l, h)` ; `snd = charge_son(adresse)`, `joue_son(snd)`. Charge les médias **une fois, au début** du programme, puis garde le numéro dans une variable.

### Fichiers et données
- `don0`, `don1`… : le texte des onglets de données du programme (bouton « Données » de l'éditeur). Un onglet vide ne crée pas de variable. À utiliser quand l'élève colle ses propres données.
- `range_données("don1", valeur)` : écrit la valeur (une liste ou un nombre est écrit comme `affiche` l'écrirait) dans l'onglet Don1, enregistré avec le programme. L'onglet doit exister, ou venir juste après le dernier (on le crée) ; sinon, c'est une erreur. Pendant l'exécution, la variable `don1` garde sa valeur du départ ; `prend_données("don1")` renvoie le texte actuel de l'onglet (y compris ce qu'un `range_données` vient d'y écrire, `""` s'il est vide ; un onglet inexistant est une erreur).
- `charge_données(nom)` : le texte d'un fichier du répertoire `docs/matériels/` du site (matériel de l'enseignant ; par exemple `charge_données("capitales.csv")`).
- `lit_fichier()` (sans argument) : un fichier de l'ordinateur, choisi par l'élève dans une fenêtre (le programme repart du début une fois le fichier choisi) ; `lit_fichier("https://…")` : le texte d'une adresse Internet, si le site l'autorise.
- `écrit_fichier(nom, texte)` : enregistre le texte dans le dossier Téléchargements (`"scores"` devient `scores.txt`).

### Médias disponibles sur le site
Chemins à donner tels quels à `charge_image` / `charge_son` :
- `exemples/médias/étoile.svg`
- sons : `exemples/médias/ding.wav`, `pop.wav`, `tir.wav` (laser), `explosion.wav`, `boum.wav` (gros choc), `pas_1.wav` à `pas_4.wav` (notes graves brèves)
- piano, trois octaves : `exemples/médias/piano/do_3.wav` … `si_5.wav`, avec `do_dièse_4.wav`, `ré_dièse_4.wav`, `fa_dièse_4.wav`, `sol_dièse_4.wav`, `la_dièse_4.wav` (octaves 3, 4 et 5)

## Pièges (vérifiés) : à éviter absolument

1. **Pas d'expression conditionnelle** : `x = a si c sinon b` est refusé. Écris un `si` / `sinon`.
2. **Pas de `non` juste après une parenthèse ouvrante** : `x = (non (a == 2)) et b == 2` est refusé. Écris `non (a == 2) et b == 2`, qui marche, comme toutes les autres combinaisons de parenthèses, `et`, `ou` et `non`.
3. **Pas de boucle sans fin** (`tantque Vrai:` sans `sortir`) : elle bloque l'onglet. Pour tout ce qui bouge, utilise `animer`.
4. **`intervalle` est limité** (quelques centaines de milliers d'éléments au plus) : pour de très grandes boucles, imbrique deux boucles.
5. **Une seule chose par ligne**, pas de `;`. Pas de `import` de modules Python, pas de `global` / `nonlocal`, pas de décorateurs, de `with`, de `yield`, de `*args` ni d'arguments nommés.
6. `Rien` s'affiche `[]`.
7. Un nombre écrit sans point est un entier (`7`) ; avec un point ou un exposant, c'est un réel (`7.0`, `1.5e3`). Pour un score ou un compteur, utilise des entiers. `arrondi(x)` et `**` peuvent donner un réel (`4.0`, `8.0`) : utilise `entier(…)` si tu veux afficher un entier.
8. Écris `sauf(e):` avec les parenthèses, et `retourne Rien` pour quitter une fonction avant la fin.
9. Dans une fonction appelée par `animer`, `quand_clic`…, n'oublie pas `=:` (ou `+=`) pour modifier l'état du jeu ; un simple `=` crée une variable locale, et le jeu semble ne rien faire.

## Modèle de jeu

```python
# Mon jeu
# La souris déplace la raquette ; clic ou Espace : commencer.

score = 0
état = "attente"          # "attente", "jeu" ou "perdu"
x = 400

fonction recommence():
    score =: 0
    état =: "jeu"

fonction souris(sx, sy):
    x =: sx

fonction clic(cx, cy):
    si état != "jeu":
        recommence()

fonction clavier(t):
    si t == "espace" et état != "jeu":
        recommence()

fonction avance():
    # la logique du jeu : déplacer, tester les chocs, compter les points
    score += 1

fonction dessine():
    fond("bleu marine")
    couleur("blanc")
    rectangle_plein(x - 50, 560, 100, 14)
    taille_texte(18)
    texte(10, 10, f"Score : {score}")
    si état == "attente":
        taille_texte(26)
        texte(250, 280, "Clic ou Espace : jouer")

fonction image():
    si état == "jeu":
        avance()
    dessine()

cache_tortue()
quand_souris(souris)
quand_glisse(souris)      # sur une tablette
quand_clic(clic)
quand_touche(clavier)
animer(image, 20)
```

## Exemples complets à lire

Les exemples du site montrent le style attendu ; lis-les avant d'écrire un programme du même genre. Ils sont dans `docs/exemples/` (adresse brute : `https://raw.githubusercontent.com/clauderouxster/Pythonerie/main/docs/exemples/<fichier>`), et la liste est dans `docs/exemples/index.json` :

`01_bonjour.py`, `02_conditions.py`, `03_boucles.py`, `04_fonctions.py`, `05_listes.py`, `06_dessin.py`, `07_tortue.py`, `08_animation.py` (balle qui rebondit), `09_interaction.py` (souris et clavier), `10_classes.py` (classes, essaie/sauf), `11_courbe.py` (courbe mathématique), `12_images_sons.py`, `13_dessin_souris.py` (`quand_glisse`), `14_piano.py`, `15_casse_briques.py`, `16_serpent.py`, `17_envahisseurs.py`, `18_tableur.py` (champs de saisie, flèches, totaux).

Le mode d'emploi pour les enfants (`docs/guide.html`) contient un glossaire de tous les mots. Environ 180 instructions avancées de LispE portent aussi un nom français ; elles sont décrites dans `docs/basic/français.lisp` (une ligne `(link "nom" 'instruction) ; description` par instruction). Préfère les fonctions de ce guide, plus simples pour un enfant.

## Avant de rendre le programme, vérifie

- tous les blocs ouverts par `:` sont décalés de 4 espaces ;
- aucune des tournures de la liste « Pièges » ;
- `=:` partout où une fonction modifie une variable du programme ;
- les médias chargés existent dans la liste ci-dessus ;
- les touches et les couleurs ont leur nom français ;
- le programme marche sans clavier (souris ou toucher), si c'est un jeu.
