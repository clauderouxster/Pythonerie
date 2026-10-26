# Écrire des programmes pour La Pythonerie — guide pour Claude

Ce fichier s'adresse à Claude (ou à toute autre IA) à qui l'on demande d'écrire un programme pour **La Pythonerie** : https://clauderouxster.github.io/Pythonerie/ (dépôt : https://github.com/clauderouxster/Pythonerie).

La Pythonerie fait programmer des enfants (à partir de 7 ans) dans un **Python en français**. Le programme est traduit en LispE, puis exécuté dans le navigateur (WebAssembly). Ce n'est pas du Python : beaucoup de choses se ressemblent, mais les mots-clefs sont français, la bibliothèque est différente, et certaines tournures de Python n'existent pas (voir « Pièges »).

## Ce que tu dois rendre

- **Un seul programme complet**, dans un bloc de code. L'élève le colle dans l'éditeur (ou l'importe en `.pyf`, l'extension des programmes de la Pythonerie) et clique sur « Exécuter ».
- Ou bien, quand il faut plusieurs programmes, des onglets de données ou des fichiers, **un projet complet en JSON**, dans un bloc de code `json` (voir « Un projet en JSON ») : l'élève le colle avec ☰ → « 📋 Coller un projet (JSON)… ».
- Ou bien, pour une **pile de cartes** à la HyperCard, le seul fichier JSON de la pile (voir « Des piles de cartes »).
- Une première ligne de commentaire avec le titre, puis quelques lignes qui expliquent comment jouer ou utiliser le programme.
- **Des noms français avec leur orthographe correcte** : `épaisseur`, `état`, `vitesse_balle`. Les accents sont obligatoires dans les noms du langage (`va_à`, `lève_crayon`, `carré`), et souhaités dans les tiens.
- Des commentaires courts et simples, lisibles par un enfant.
- Pas de dépendance extérieure : seuls les fichiers du site (voir « Médias »), ceux du projet de l'élève (voir « Projets ») et les fonctions listées ici existent.

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
| `try / except Exception as e` | `essaie:` … `sauf(e):` (ou `attrape(e):`), ou `sauf:` sans variable — dans `sauf:`, `retourne` quitte bien la fonction ; dans `sauf(e):`, il ne quitte que le bloc |
| `and / or / not / in / not in / is` | `et / ou / non / dans / non dans / est` ; `oux` = ou exclusif |
| `True / False / None` | `Vrai / Faux / Rien` |
| `class C: / self` | `classe C:` / `soi` (méthodes avec `def`, constructeur `__init__(soi, …)`) |
| `match x: case "a":` / `case _:` | `selon (x):`, puis des blocs `cas "a":` ou `cas 3:` (un texte ou un nombre positif : `cas -1:` est refusé) et, en dernier, `défaut:` ; chaque `cas` et `défaut` ouvre un bloc décalé sur les lignes suivantes (pas d'instruction sur la même ligne) |
| `lambda x: x * 2` | `lambda(x) x * 2` (ou `λ`) |
| `f"{x}"` | `f"{x}"` (les expressions entre accolades suivent la syntaxe de la Pythonerie) |
| `[x * x for x in l if x > 0]` | `[x * x pour x dans l si x > 0]` |
| `a, b = b, a` | `a, b = b, a` (et `x, y = point` pour dépaqueter une liste) |
| `global x` | **n'existe pas** : voir ci-dessous |

**Après un `:`, on va toujours à la ligne.** Une ligne qui ouvre un bloc (`si`, `sinonsi`, `sinon`, `pour`, `tantque`, `fonction`, `classe`, `selon`, `cas`, `défaut`, `essaie`, `sauf`…) se termine par `:`, et son contenu s'écrit sur les lignes suivantes, décalées de quatre espaces : jamais `si x > 0: affiche(x)` sur une seule ligne. C'est une règle de la Pythonerie, voulue pour éviter les confusions.

Opérateurs : `+ - * / // % **`, `+= -= *= /=`, comparaisons `== != < <= > >=`. Ils donnent le même résultat qu'en Python, même entre entiers et réels (`1 + 0.5` vaut `1.5`, `7 / 2` vaut `3.5`, `[1, 2] + [3]` vaut `[1, 2, 3]`), et `+=`, `-=`… marchent aussi sur une case : `l[i] += 1`, `m[i][j] -= v * dt`, `d["a"] *= 2`. **Une comparaison enchaînée a deux opérateurs au plus**, parmi `< <= > >= ==` : `0 <= i < n`, `10 < a < 20` ou `a == b == c` marchent comme en Python, et le terme du milieu n'est calculé qu'une fois. Trois opérateurs (`a < b < c < d`), ou `!=` dans une chaîne, donnent une erreur de syntaxe : écris `a < b et b < c et c < d`. Les listes (`[1, 2]`, `l[0]`, `l[-1]`, `l[1:3]`, `l[i] = v`) et les dictionnaires (`{"a": 1}`, `d["b"] = 2`, `pour clé dans d`) fonctionnent comme en Python. Les chaînes `"…"` acceptent `\n` ; les chaînes `"""…"""` ou `'''…'''` peuvent s'étendre sur plusieurs lignes et gardent leur contenu tel quel, sans échappement.

### Variables du programme et fonctions

- Dans une fonction, `x = …` crée une **variable locale**.
- `x =: …` modifie la **variable du programme** (c'est le `global` de Python).
- `x += …` (et `-=`, `*=`…) modifie la variable du programme si la fonction n'a pas de variable locale `x`.
- Lire une variable du programme, ou modifier une liste du programme (`l[i] = v`, `l.ajoute(x)`), ne demande rien de particulier.
- Un élève peut nommer ses variables comme il veut, même comme une fonction de la bibliothèque (`gauche`, `somme`) : elles sont renommées automatiquement.

## La bibliothèque

### Console
`affiche(a, b, …)` (avec retour à la ligne), `écris(a, …)` (sans), `efface_console()`, `affiche_console()` (montre la console, même en plein écran du canevas, où elle vient sous le canevas ; `cache_console()` l'en retire), **Les questions n'attendent pas.** `demande(question, f)` pose la question dans une petite fenêtre sur le canevas, `lire(question, f)` dans la console (qu'il fait apparaître si elle est cachée) ; l'appel **rend la main tout de suite** et le programme continue. Quand l'élève a répondu (Entrée), `f(réponse)` est appelée ; Échap abandonne la question, et `f` n'est pas appelée. `demande_nombre(question, f)` et `lire_nombre(question, f)` donnent un nombre réel ; `input` est un synonyme de `demande`. Un argument de plus est rendu avec la réponse : `demande(question, f, a)` appelle `f(réponse, a)` (`a` : une valeur quelconque, pour qu'une même fonction serve à plusieurs questions). Plusieurs questions à la suite sont posées l'une après l'autre, dans l'ordre. La fonction est donnée par son nom, sans parenthèses, comme pour `bouton`. Sans fonction de rappel (`demande("Nom ?")`), c'est une erreur. Rien n'est rejoué et rien ne bloque la page : c'est la même chose dans le programme principal, dans un jeu ou dans une fonction d'événement. (Le mode d'emploi l'explique aux enfants avec l'image d'un parent qui dit « appelle-moi quand tu as fini » au lieu d'attendre la fin du match.) **Tout ce qui dépend de la réponse doit se trouver dans `f`** (ou dans une fonction qu'elle appelle) ; une deuxième question se pose dans la fonction de rappel de la première :

```python
fonction répond(nom):
    affiche("Enchanté,", nom)
    demande_nombre("Quel âge as-tu ?", âge, nom)

fonction âge(n, nom):
    affiche(nom, "aura", entier(n) + 1, "ans l'an prochain")

demande("Comment t'appelles-tu ?", répond)
```

Pour une suite de questions (un quiz), une fonction pose la question suivante, et la fonction de rappel corrige la réponse puis la rappelle ; les compteurs sont des variables du programme, modifiées avec `=:` (voir le quiz des capitales, dans `docs/matériels/quiz_des_capitales.zip`).

`assigne(nom, valeur)` range `valeur` dans la variable du programme qui s'appelle `nom` (un texte), comme `nom =: valeur`, mais avec un nom calculé : une seule fonction de rappel peut ainsi remplir plusieurs variables (`demande("Ton nom ?", range, "nom")` avec `fonction range(r, variable):` puis `assigne(variable, r)`).

### Nombres
`aléatoire(a, b)` (entier, bornes comprises), `hasard()` (entre 0 et 1), `choisis(liste)`, `absolu(x)` (ou `abs`), `racine(x)`, `puissance(x, y)`, `arrondi(x)` / `arrondi(x, n)`, `somme(l)`, `maximum(l)` ou `maximum(a, b)`, `minimum(…)`, `sinus(degrés)`, `cosinus(degrés)`, `pi`, `entier(x)`, `réel(x)`, `nombre(texte)` (réel, accepte « 2,5 », 0.0 sinon), `chaîne(x)`, `typede(x)` (le genre en français, en texte : `"entier"`, `"réel"`, `"texte"`, `"liste"`, `"dictionnaire"`, `"booléen"`, `"rien"`, ou le nom de la classe d'un objet ; à préférer pour comparer : `si typede(d) == "dictionnaire":`), `type_de(x)` (le nom LispE, un atome anglais), `intervalle(fin)` / `intervalle(début, fin, pas)` (ou `range`), `longueur(x)` (ou `len`).

`7 / 2` vaut `3.5`, `7 // 2` vaut `3`, `[1, 2] + [3]` vaut `[1, 2, 3]`.

### Listes et textes
`liste.ajoute(x)` (ou `append`), `ramène_élément(liste)` (retire le dernier élément et le rend ; `ramène_élément(liste, i)` : celui d'indice i ; `liste.pop()`, lui, rend la liste), `trie(l)`, `inverse(l)`, `contient(conteneur, x)`, `majuscules(t)`, `minuscules(t)`, `remplace(t, avant, après)`, `découpe(t, séparateur)` (aux espaces par défaut), `nettoie(t)` (ou `strip`), `"sép".joindre(l)`, `tri_localisé(l)` (une copie des textes dans l'ordre du dictionnaire : « é » avec les « e », les majuscules avec les minuscules, là où `trie` les sépare). Les fonctions de texte s'écrivent aussi comme des méthodes : `ligne.découpe(",")`, `texte.majuscules()`.

### Dessin (canevas de 800 × 600, origine en haut à gauche, y vers le bas)
- `canevas(largeur, hauteur)` change la taille (à appeler au début ; le dessin est effacé). **Une taille par sens d'écran** : `portrait(largeur, hauteur)` (c'est `canevas`) pour l'écran tenu en hauteur, `paysage(largeur, hauteur)` pour l'écran en largeur ; quand on tourne une tablette ou un téléphone, le canevas prend aussitôt l'autre taille (le dessin est effacé : redessine tout dans `animer`). Un ordinateur est en largeur ; `largeur()`, `hauteur()` donnent la taille actuelle. `appareil()` dit sur quoi tourne le programme : `["ordinateur", 1440, 900]`, `["tablette", 1180, 820]` ou `["téléphone", 390, 844]` (le genre, puis la largeur et la hauteur de l'écran dans le sens où on le tient) ; sur une tablette ou un téléphone, il n'y a pas de clavier : prévois des boutons ou le glissé du doigt (`quand_glisse`). Chaque exécution repart de 800 × 600.
- `efface()`, `fond(c)`, `couleur(c)` (trait et remplissage), `couleur_trait(c)`, `couleur_remplissage(c)`, `épaisseur(e)`, `rgb(r, g, b)`.
- `point(x, y)`, `ligne(x1, y1, x2, y2)`, `rectangle(x, y, l, h)`, `carré(x, y, côté)`, `cercle(x, y, r)`, `disque(x, y, r)`, `ellipse(x, y, rx, ry)`, `triangle(x1, y1, x2, y2, x3, y3)`, `polygone([[x1, y1], [x2, y2], …])`, et leurs versions pleines : `rectangle_plein`, `carré_plein`, `ellipse_pleine`, `triangle_plein`, `polygone_plein` (`disque` est le cercle plein).
- `texte(x, y, message)` : (x, y) est le **coin en haut à gauche** du texte. `taille_texte(n)`, `police(nom)`. `largeur_texte(message)` rend la largeur (un réel, en points du canevas) qu'aurait le texte avec la police et la taille du moment (la plus longue ligne s'il y en a plusieurs ; `épaisseur` n'y change rien) : `texte(400 - largeur_texte(t) / 2, 280, t)` centre un titre sur un canevas de 800. Une ligne fait `1,2 × taille` de haut ; `hauteur_texte(message)` rend la hauteur des lettres (du haut de la plus haute au bas de la plus basse).
- Pixels : `couleur_pixel(x, y)` rend `[rouge, vert, bleu, opacité]` (0 à 255 ; `[0, 0, 0, 0]` hors du canevas). `pixels(x, y, l, h)` rend les points d'un rectangle ligne après ligne, 4 valeurs par point (une liste de `l * h * 4` entiers ; le point (c, ligne) commence à l'indice `(ligne * l + c) * 4`) ; `pose_pixels(x, y, l, h, valeurs)` les redessine (même rangement, valeurs ramenées entre 0 et 255). Les noms de couleur ne donnent pas des valeurs « rondes » (`"rouge"` vaut `[229, 57, 53, 255]`) : pour tester une couleur, compare avec un point dessiné en `rgb(…)`. Reposer tout le canevas prend presque une seconde : à éviter dans `animer`.
- Couleurs : `rouge, vert, bleu, jaune, orange, violet, rose, marron, noir, blanc, gris, cyan, magenta, turquoise, beige, or, argent, bleu marine`, et les nuances avec `clair` ou `foncé` (invariables) : `rouge clair, rouge foncé, vert clair, vert foncé, bleu clair, bleu foncé, jaune clair, jaune foncé, orange clair, orange foncé, violet clair, violet foncé, rose clair, rose foncé, marron clair, marron foncé, gris clair, gris foncé`. Toute couleur CSS marche aussi (`"#ff8800"`). Un nom inconnu (`"vert pomme"`) ne fait rien : utilise `rgb(…)`.

### Graphiques (comme dans un tableur)
```python
mois = ["Janv.", "Févr.", "Mars", "Avril"]
graphique("colonnes", [[120, 135, 160, 150], [80, 95, 90, 120]], mois, {"titre": "Ventes et achats", "séries": ["Ventes", "Achats"], "zone": [0, 0, 400, 300]})
graphique("camembert", [45, 25, 15, 15], ["Chats", "Chiens", "Lapins", "Poissons"], {"titre": "Animaux", "zone": [400, 0, 400, 300]})
graphique("courbes", [12, 15, 14, 18], mois, {"titre": "Températures", "axe_y": "°C", "zone": [0, 300, 800, 300]})
```
- `graphique(genre, valeurs, étiquettes, options)` dessine un graphique dans tout le canevas, ou dans la zone de l'option `"zone"`. Une seule instruction pour tous les genres. `étiquettes` (les noms des catégories) et `options` (un dictionnaire) sont facultatives, et les options peuvent venir à la place des étiquettes : `graphique("camembert", parts, {"titre": "Parts"})`.
- **Les genres** : `"colonnes"` (ou `"histogramme"`, le nom d'Excel), `"barres"` (horizontales), `"colonnes_empilées"`, `"barres_empilées"`, `"courbes"`, `"aires"`, `"aires_empilées"`, `"camembert"`, `"anneau"`, `"nuage"` (nuage de points), `"bulles"`, `"radar"`, `"répartition"` (l'histogramme des statisticiens : les valeurs brutes comptées par classes), `"boîte"` (boîte à moustaches), `"cascade"`, `"entonnoir"`, `"mosaïque"` (carte proportionnelle). Accents, majuscules et espaces sont indifférents (`"colonnes empilees"`) ; les noms anglais marchent aussi (`"column"`, `"pie"`…).
- **Les valeurs** : une liste de nombres (une série) ou une liste de listes (une série chacune, 8 au plus) ; `Rien` fait un trou. `nuage` prend des points `[x, y]` (ou une liste de listes de points, une par série) ; `bulles` des `[x, y, taille]` ; `répartition` et `boîte` les valeurs brutes (`boîte` : une liste par boîte) ; `cascade` les variations (+ ou −), le total s'ajoute au bout ; `camembert`, `anneau`, `entonnoir` et `mosaïque` une seule série de nombres positifs.
- **Les options** : `"titre"` ; `"séries"` (les noms des séries, pour la légende) ; `"zone": [x, y, largeur, hauteur]` (plusieurs graphiques sur un canevas) ; `"couleurs"` (une liste de couleurs ; sinon une palette lisible par les daltoniens) ; `"axe_x"`, `"axe_y"` (titres des axes) ; `"valeurs": Vrai` (les nombres sur les colonnes, les barres, les courbes ; sur un camembert, la valeur au lieu du pourcentage) ; `"légende": Vrai` ou `Faux` ; `"pourcentage": Vrai` (empilées à 100 %) ; `"classes": n` (répartition) ; `"tendance": Vrai` (nuage : la droite des moindres carrés) ; `"total": Faux` ou un texte (cascade) ; `"min"`, `"max"` (l'axe des valeurs) ; `"fond"` (une couleur, ou `Rien` pour un fond transparent ; blanc par défaut) ; `"survol": Faux` ; `"points": Vrai` ou `Faux` (les points d'une courbe). Une option inconnue est une erreur qui donne la liste.
- Le graphique efface sa zone avant de se dessiner : dessine-le **avant** ce que tu veux poser par-dessus. Quand la souris passe sur une colonne, une part ou un point, une bulle montre les valeurs. Les nombres s'écrivent à la française (1 234,5). Dans un dessin : `d.graphique(…)`, puis `montre_dessin(d)` (aussi dans une `zone_défilante`). Au-delà de 8 parts, un camembert regroupe les plus petites dans « Autre ». Voir `24_graphiques.pyf` et `25_sondage.pyf`.

### Tortue (part du centre, regarde vers la droite)
`avance(d)`, `recule(d)`, `gauche(angle)`, `droite(angle)`, `lève_crayon()`, `baisse_crayon()`, `va_à(x, y)`, `oriente(angle)` (0 = droite, 90 = bas), `origine()`, `montre_tortue()`, `cache_tortue()`, `position_x()`, `position_y()`, `position()` (la liste `[x, y]`), `cap()`. La tortue n'apparaît qu'à sa première commande ; dans un jeu, appelle `cache_tortue()`.

### Animation et événements
- `animer(f, délai)` appelle `f()` toutes les `délai` millisecondes (16 à 30 pour un jeu fluide). C'est **la seule façon** de faire une boucle de jeu.
- `appel_dans(f, délai)` appelle `f()` toutes les `délai` millisecondes, au rythme d'une horloge, même quand l'écran n'est pas redessiné (une horloge, un compte à rebours) ; `heure()` rend l'heure de l'appareil, `[heures, minutes, secondes, millisecondes]`.
- `quand_clic(f)` → `f(x, y)` ; `quand_souris(f)` → `f(x, y)` quand la souris bouge ; `quand_glisse(f)` → `f(x, y)` quand elle bouge bouton appuyé (ou le doigt sur une tablette) ; `quand_touche(f)` → `f(touche)`. Un seul gestionnaire par événement (un nouvel appel remplace le précédent).
- Noms des touches, **en français** : `"gauche"`, `"droite"`, `"haut"`, `"bas"`, `"espace"`, `"entrée"`, `"échap"`, `"retour arrière"`, `"tabulation"`, `"suppr"`, `"début"`, `"fin"`, `"page haut"`, `"page bas"`, `"maj"`, `"ctrl"`, `"alt"` ; une lettre, un chiffre ou un signe reste tel quel (`"a"`, `"z"`, `"7"`). Pense aux claviers AZERTY : Z Q S D plutôt que W A S D.
- **Pour un mouvement continu, utilise `touche_enfoncée(nom)` dans la fonction d'`animer`** (`si touche_enfoncée("gauche"):` puis, à la ligne et décalé, `x -= 5`), plutôt que `quand_touche`, qui dépend de la répétition automatique du système (un appui, une pause, puis des répétitions : le jeu avance par à-coups). Plusieurs touches peuvent être tenues à la fois. Garde `quand_touche` pour les actions ponctuelles (tirer, lancer, rejouer). `quand_relâche(f)` appelle `f(touche)` au relâchement, avec le même nom qu'à l'appui. Les touches tenues sont relâchées quand la page perd le focus ou à la sortie du plein écran.
- `saisie(clef, x, y, f)` pose un champ de saisie (une case de texte de 200 points de large, sauf `largeur_saisie`) au point (x, y) du canevas ; `clef` est son nom. Le champ prend la police (`police`) et la taille (`taille_texte`) courantes au moment de sa création : règle-les avant d'appeler `saisie`. Entrée, ou un clic dans un autre champ (si la valeur a changé), appelle `f(clef, valeur)` ; la valeur est toujours un texte (`entier(valeur)` pour un nombre). Un nouvel appel avec la même clef déplace le champ. Les touches tapées dans un champ ne vont pas à `quand_touche`.
- `active_saisie(clef)` donne la main à un champ (son contenu est sélectionné ; le champ quitté envoie sa valeur si elle a changé) ; `saisie_active()` renvoie la clef du champ actif (`""` sinon) ; `largeur_saisie(l)` règle la largeur des champs créés ensuite (200 au départ). Dans un champ, `haut`, `bas` et `entrée` sont transmis à `quand_touche`, ainsi que `gauche` / `droite` quand le curseur est au bord du texte : c'est ce qui permet de passer de champ en champ (voir `18_tableur.pyf`). Pour convertir la valeur, `nombre(valeur)` accepte « 2,5 » comme « 2.5 » et donne `0.0` si ce n'est pas un nombre.
- Les autres objets du canevas suivent les mêmes règles que `saisie` (une clef = un objet, un nouvel appel le déplace ; police et taille du moment ; supprimés à chaque exécution) :
  - `bouton(clef, x, y, texte, f)` → `f(clef, texte)` au clic (toutes les fonctions d'objets reçoivent deux valeurs) ;
  - `bouton_image(clef, x, y, image, f)` ou `bouton_image(clef, x, y, image, image_appuyée, f)` → `f(clef, image)` au clic : un bouton qui a l'aspect d'une image (numéro de `charge_image` ou de `capture_image`), à sa taille, avec un second aspect facultatif tant qu'on appuie. Pour dessiner soi-même les deux aspects : dessiner, `normal = capture_image(x, y, l, h)` (un rectangle du dessin devient une image), dessiner le second, le capturer, puis `efface()`. La capture reprend le fond autour du dessin : dessiner sur le fond final, ou utiliser un png transparent ;
  - `case_à_cocher(clef, x, y, texte, f)` → `f(clef, Vrai/Faux)` ;
  - `bouton_radio(clef, groupe, x, y, texte, f)` → un seul coché par groupe, `f(groupe, clef)` quand on le choisit ;
  - `glissière(clef, x, y, mini, maxi, valeur, f)` → `f(clef, valeur)` pendant qu'on la déplace (entière si mini, maxi et valeur sont entiers, sinon par centièmes) ;
  - `liste_déroulante(clef, x, y, éléments, f)` → `f(clef, choix)` ;
  - `liste_hiérarchique(clef, x, y, lignes, arbre, f)` → un élément est un texte ou `[nom, [enfants…]]` ; `f(clef, chemin)`, chemin étant la liste des noms depuis la racine (`chemin[-1]` est l'élément cliqué ; un groupe donne un chemin plus court) ;
  - `zone_édition(clef, x, y, lignes, f)` → texte sur plusieurs lignes, `f(clef, texte)` quand on la quitte ou avec Ctrl+Entrée ;
  - `zone_défilante(clef, x, y, l, h, largeur, hauteur, f)` → une zone de **dessin** qui défile : une fenêtre de l × h au point (x, y) sur une surface de largeur × hauteur. Elle défile verticalement si `hauteur > h`, horizontalement si `largeur > l` (molette, doigt, barres). On y dessine avec `montre_dessin(d, clef)`, `d` étant un dessin préparé (voir plus bas) en coordonnées de la surface, (0, 0) en haut à gauche ; la surface est effacée avant chaque `montre_dessin(d, clef)`. Le dessin peut contenir du texte : `d.texte(…)`. `f` est facultative : `f(clef, [x, y])` au clic, en coordonnées de la surface. `valeur_objet(clef)` rend le coin visible `[x, y]`, `change_objet(clef, [x, y])` fait défiler jusque-là ;
  - `zone_texte(clef, x, y, l, h, texte)` → une zone de **texte seul** qui défile, en lecture seule : une fenêtre de l × h au point (x, y). Les lignes sont séparées par `"\n"` et ne sont jamais coupées (elle défile horizontalement si elles dépassent). `change_objet(clef, texte)` remplace le texte (un journal, les règles d'un jeu), `valeur_objet(clef)` le rend. Pour un texte mêlé de formes ou de couleurs, prends `zone_défilante` et `d.texte(…)`.
  - `valeur_objet(clef)` lit la valeur de n'importe quel objet (texte, nombre, Vrai/Faux, chemin) ; `change_objet(clef, valeur)` la change sans appeler `f` ; `retire_objet(clef)` enlève un objet, `retire_objets()` les enlève tous (pour changer d'écran). Les fonctions sont données par leur nom, sans parenthèses.
- `arrête()` arrête les animations. L'élève a aussi un mode plein écran, et le bouton ▶ Exécuter devient ■ Arrêter tant que le programme tourne.
- Le clavier ne marche qu'après un clic dans le canevas (ou en plein écran) : dis-le dans les commentaires.

### Les dessins (préparer, puis dessiner d'un coup)
```python
décor = nouveau_dessin()
décor.fond("bleu clair")
pour i dans intervalle(300):
    décor.couleur("blanc")
    décor.disque(hasard() * 800, hasard() * 400, 2)     # des étoiles
décor.couleur("vert")
décor.rectangle_plein(0, 450, 800, 150)

x = 0

fonction image():
    montre_dessin(décor)            # tout le décor, en un seul appel
    couleur("rouge")
    disque(x, 420, 20)              # ce qui bouge se dessine tout de suite
    x += 3

animer(image, 30)
```
- `d = nouveau_dessin()` rend un dessin vide. Les instructions de dessin (`efface`, `fond`, `couleur`, `couleur_trait`, `couleur_remplissage`, `épaisseur`, `point`, `ligne`, `rectangle`, `carré`, `cercle`, `disque`, `ellipse`, `triangle`, `polygone` et leurs formes pleines, `texte`, `taille_texte`, `police`, `place_image`, `graphique`) et celles de la tortue (`avance`, `recule`, `droite`, `gauche`, `va_à`, `oriente`, `origine`, `lève_crayon`, `baisse_crayon`, `montre_tortue`, `cache_tortue`) acceptent un dessin devant le point : `d.disque(x, y, r)` ne dessine rien, il ajoute sa commande au dessin. Écris-les en méthode, comme en 3D ; `disque(d, x, y, r)` est le même appel. Sans dessin, elles dessinent tout de suite, comme avant : c'est la forme simple, à garder pour quelques formes.
- `montre_dessin(d)` dessine toutes les commandes, dans l'ordre, en un seul appel au navigateur. Le navigateur garde le dessin : le montrer de nouveau (à chaque image d'`animer`) ne renvoie pas ses commandes tant qu'il n'a pas changé, et ne coûte presque rien. `vide_dessin(d)` retire toutes ses commandes, pour le reconstruire. `montre_dessin(d, clef)` le dessine dans la `zone_défilante` clef au lieu du canevas.
- Les commandes rejouent les mêmes instructions : une couleur, une épaisseur ou une police choisie dans le dessin reste choisie après lui, et la tortue d'un dessin repart d'où elle se trouve à chaque `montre_dessin`. Un dessin qui commence par `fond(…)` remplace `efface()`.
- Les fonctions qui rendent une valeur (`position_x`, `couleur_pixel`, `largeur_texte`…) et les objets (`bouton`, `saisie`…) n'entrent pas dans un dessin.
- Quand s'en servir : un décor ou une figure de centaines de formes, redessiné à chaque image. Préparé une fois, il coûte un seul appel par image au lieu d'un appel par forme.

### La 3D (avec three.js)
```python
scène = nouvelle_scène()
soleil = scène.sphère(0, 0, 0, 3, "jaune")
soleil.lumineux()                         # éclairé par lui-même
orbite = scène.groupe()                   # un nouveau groupe : ses objets bougent avec lui
terre = orbite.sphère(10, 0, 0, 1, "bleu")
scène.lumière(0, 0, 0)                    # une lumière au centre du Soleil
scène.caméra(0, 15, 30, 0, 0, 0)          # où est la caméra, et ce qu'elle regarde
montre_3d(scène)                          # la scène apparaît, sous le canevas 2D

fonction image():
    orbite.tourne(0, 1, 0)                # un degré de plus autour de l'axe y
    efface()                              # la 2D (transparente en 3D) : un texte par-dessus
    texte(10, 10, "Le système solaire")

caméra_libre()
animer(image, 16)
```
- **Écris les primitives 3D en méthode**. Pour créer un objet, la scène (ou le groupe) devant le point : `s.cube(x, y, z, côté, couleur)`, `s.boîte(x, y, z, largeur, hauteur, profondeur, couleur)`, `s.sphère(x, y, z, rayon, couleur)`, `s.cylindre(x, y, z, rayon, hauteur, couleur)`, `s.cône(x, y, z, rayon, hauteur, couleur)`, `s.anneau(x, y, z, rayon_intérieur, rayon_extérieur, couleur)` (couché à plat), `s.lumière(x, y, z)` (ou avec une intensité, 2.5 au départ), `s.caméra(x, y, z, vx, vy, vz)`. Chacune rend le **numéro** du nouvel objet. La couleur est facultative (blanc). `s.groupe(x, y, z)` rend un nouveau groupe : on y ajoute des objets comme dans une scène (`lune = orbite.sphère(…)`), et on le donne à `tourne` ou `déplace` comme un numéro. Le transpileur fait de `s.sphère(…)` le même appel que `sphère(s, …)`, mais l'écriture en méthode montre mieux qui reçoit le nouvel objet : c'est celle des exemples et de la documentation.
- y est vers le haut ; une scène de quelques dizaines d'unités se voit bien avec la caméra par défaut. Il y a toujours une faible lumière ambiante : sans `lumière`, tout est sombre mais visible.
- `montre_3d(scène)` (une fois) envoie la scène. Après, toujours en méthode, sur un numéro d'objet ou un groupe (`terre.tourne(0, 1, 0)`, `a[7].cache_objet()` : l'objet devant le point peut être un élément de liste) : `o.déplace(x, y, z)` (position absolue), `o.tourne(ax, ay, az)` (degrés ajoutés), `o.oriente_3d(ax, ay, az)` (`oriente` est celui de la tortue), `o.colore(c)`, `o.texture(image)` (un numéro de `charge_image` : une carte équirectangulaire pour une sphère, une bande radiale pour un anneau), `o.lumineux()`, `o.cache_objet()`, `o.montre_objet()` ; `regarde(x, y, z)`, `caméra_libre()`, `quand_clic_objet(f)` → `f(numéro)`. Une primitive appelée après `montre_3d` ajoute son objet aussitôt.
- En 3D, `efface()` rend la 2D transparente (sans fond blanc) et `fond(c)` colore le fond de la scène. Le bouton Image, `capture_image`, `couleur_pixel` et `pixels` voient la scène 3D avec la 2D par-dessus, comme à l'écran ; mais la scène n'est dessinée qu'à l'image suivante (three.js se charge, puis dessine) : lis ou capture les pixels depuis la fonction d'`animer` ou d'un clic, pas juste après `montre_3d`. Toute la logique passe par `animer`, comme en 2D ; il n'y a pas d'autre boucle.
- Pour un jeu : crée tous les objets au départ (des « réserves » : des listes d'objets cachés avec `objet.cache_objet()`), puis prends-en un quand il en faut (`objet = ramène_élément(réserve)`, puis `objet.montre_objet()`) et rends-le quand il disparaît (`objet.cache_objet()`, `réserve.ajoute(objet)`). Ne crée pas d'objet à chaque image : la scène les garderait tous. Une caméra au-dessus du centre, `scène.caméra(0, h, 0.01, 0, 0, 0)`, voit un plan horizontal de `1,07 × h` sur `0,93 × h` (sur un canevas 4/3) : les coordonnées de la souris se ramènent alors simplement à ce plan.

### Images et sons
`img = charge_image(adresse)`, `place_image(img, x, y)` ou `place_image(img, x, y, l, h)` ; `snd = charge_son(adresse)`, `joue_son(snd)`. `liste_sons()`, `liste_images()` et `liste_données()` rendent les noms des fichiers du projet (triés, à donner tels quels à `charge_son`, `charge_image`, `charge_données`) ; `liste_sons()` et `liste_images()` y ajoutent ceux des médias du site (`"médias/sounds/ding.wav"`, `"médias/sounds/piano/do_4.wav"`, `"médias/images/étoile.svg"`…). Charge les médias **une fois, au début** du programme, puis garde le numéro dans une variable. Écris le nom du son **en toutes lettres** dans `charge_son("…")` (pas une variable ni un calcul) : la Pythonerie décode alors ce son avant de lancer le programme, et il est prêt à jouer tout de suite. Un nom seul (`"chat.png"`, `"bravo.wav"`) désigne un fichier des répertoires images ou sons du projet ; un chemin (`médias/sounds/ding.wav`) un fichier du site ; `https://…` une adresse Internet : une image ou un son en ligne s'utilise directement, `charge_image("https://upload.wikimedia.org/…")`, même si le site ne permet pas de télécharger le fichier.

### Fichiers et données
- `don0`, `don1`… : le texte des onglets de données du projet (bouton « Données » de l'éditeur) : tous les programmes du projet, et ceux qu'ils importent, voient les mêmes. Un onglet vide ne crée pas de variable. À utiliser quand l'élève colle ses propres données.
- `range_données("don1", valeur)` : écrit la valeur (une liste ou un nombre est écrit comme `affiche` l'écrirait) dans l'onglet Don1, enregistré avec le projet. L'onglet doit exister, ou venir juste après le dernier (on le crée) ; sinon, c'est une erreur. Pendant l'exécution, la variable `don1` garde sa valeur du départ ; `prend_données("don1")` renvoie le texte actuel de l'onglet (y compris ce qu'un `range_données` vient d'y écrire, `""` s'il est vide ; un onglet inexistant est une erreur).
- `charge_données(nom)` : le texte d'un fichier du répertoire **données** du projet (par exemple `charge_données("capitales.csv")`) ; un fichier absent est une erreur. Ce n'est pas un fichier du site : l'élève (ou un projet des Matériels) doit l'avoir mis dans le projet.
- `charge_programme(nom)` : le code d'un programme du projet ; `sauve_programme(nom, code)` l'écrit ou le crée, sans l'ouvrir (un programme peut en écrire un autre, qu'un troisième importe) ; `vérifie_code(code)` rend `""` si le code se compile, sinon le message d'erreur, sans rien exécuter. Pas disponibles dans une application Web.
- Avec `serveur.py` seulement (salle de classe, examen) : `sauve_dans_serveur(professeur, chemin, valeur)` écrit un fichier dans le répertoire du professeur sur le serveur (`sauve_dans_serveur("dupont", f"contrôle1/{nom}.json", réponses)`) ; l'élève ne peut pas le relire. Le chemin est gardé tel quel : mets-y le nom de l'élève pour un fichier par élève, que donne `login()` (le nom sous lequel l'élève travaille ; « Unique » en mode utilisateur unique ; en mode classe, `serveur.py --professeur dupont`, l'identifiant de l'élève vérifié par le serveur) : `f"contrôle1/{login()}.json"`. En mode classe, les envois ne vont qu'au professeur de la classe, et portent l'identité vérifiée. Une valeur qui n'est pas un texte part en JSON ; `sauve_dans_serveur(professeur, chemin, valeur, f)` appelle `f(Vrai)` quand c'est enregistré (une erreur s'écrit dans la console). Extensions : `.txt`, `.json`, `.csv`, `.tsv`, `.md`. Un fichier réécrit garde ses versions précédentes. Pour le professeur, en mode administrateur (port 8001 de `serveur.py`, une fois connecté) : `liste_dans_serveur(chemin, f)` → `f(entrées)`, une entrée `{"chemin", "élève", "date", "taille", "actuel"}` par version reçue sous `chemin` (`""` : tout) ; `lit_dans_serveur(chemin, f)` → `f(contenu)`, le texte, ou la valeur d'un `.json` ; `sauve_élèves(liste, f)` enregistre la liste des élèves de la classe, `[{"identifiant", "nom"}, …]` (ou des paires `[identifiant, nom]`), et `f(nombre)` reçoit le nombre d'élèves (`lit_dans_serveur("élèves.json", f)` la relit). Ces trois fonctions sont asynchrones, comme `demande`, et acceptent un argument de plus pour `f`.
- `sauve_données(nom, valeur)` : écrit (ou remplace) le fichier `nom` dans le répertoire **données** du projet (`.txt`, `.csv`, `.tsv`, `.json` ou `.md` ; sans extension, `.txt`) ; une valeur qui n'est pas un texte est écrite comme `affiche` l'écrirait : pour du JSON, `sauve_données("pile.json", en_json(d))`, relu par `analyse_json(charge_données("pile.json"))`. Le fichier apparaît dans le projet et part avec lui (export, application Web). Dans une application Web, il ne vit que le temps de la visite.
- `lit_fichier(f)` : l'élève choisit un fichier de son ordinateur dans une fenêtre, puis `f(texte)` reçoit son contenu (`lit_fichier(f, a)` : `f(texte, a)`) ; comme pour une question, le programme continue sans attendre, et `f` n'est pas appelée si l'élève annule. Il n'y a pas de lecture d'une adresse Internet.
- `écrit_fichier(nom, texte)` : enregistre le texte dans le dossier Téléchargements (`"scores"` devient `scores.txt`).
- `ouvre_page(adresse)` : ouvre une page `https://…` dans un nouvel onglet ; une autre adresse est une erreur. Le navigateur bloque une fenêtre ouverte sans geste de l'élève : appelle `ouvre_page` dans la fonction d'un bouton ou de `quand_clic` (ou au début du programme, juste après ▶ Exécuter), pas dans `animer`.

### Médias disponibles sur le site
Chemins à donner tels quels à `charge_image` / `charge_son` :
- images : `médias/images/étoile.svg`, `médias/images/La Pythonerie.png` (le logo de la Pythonerie, 1254 × 1254)
- sons : `médias/sounds/ding.wav`, `pop.wav`, `tir.wav` (laser), `explosion.wav`, `boum.wav` (gros choc), `pas_1.wav` à `pas_4.wav` (notes graves brèves)
- piano, trois octaves (3, 4 et 5) : `médias/sounds/piano/<note>_<octave>.wav`, les notes portant leur nom anglais : `C` (do), `C_sharp` (do dièse), `D` (ré), `D_sharp`, `E` (mi), `F` (fa), `F_sharp`, `G` (sol), `G_sharp`, `A` (la), `A_sharp`, `B` (si) (de `C_3.wav` à `B_5.wav`, `F_sharp_4.wav`…)
- le bouton **🎨 Médias**, sous **🧪 Exemples**, liste tous ces fichiers, dans deux répertoires, sounds et images, : un clic fait écouter le son ou voir l'image, et **📋 Copier** donne la ligne qui le charge

## Projets

Les programmes de l'élève forment un **projet**, qui a un nom (« Sans Nom » au départ) et trois répertoires fixes : `images` (png, jpg, gif, svg, webp), `sons` (wav, mp3, ogg) et `données` (txt, csv, tsv, json, md), 5 Mo au plus par fichier.

- `importe "outils"`, seul sur sa ligne, ajoute au programme le code du programme « outils » du projet (fonctions, variables). `importe "jeux/outils"` désigne un programme d'un dossier ; le chemin est cherché depuis le dossier du programme qui importe, puis à la racine. Seuls les programmes du projet s'importent (pas de module Python), pas de `comme`, pas de `from … import`. Une fonction définie dans deux programmes importés est une erreur.
- **Le programme principal peut commencer par la ligne `#__main__`**, avant la ligne du titre (`#__main__`, puis `# La fusée`). « 🌐 Créer une application Web » lance alors ce programme sans rien demander ; s'il y en a plusieurs, il ne propose qu'eux ; sans repère, il propose tous les programmes. C'est facultatif, mais utile dans un projet de plusieurs programmes : mets-le en tête du programme principal, jamais en tête d'un programme importé.
- Si ton programme a besoin de données, d'images ou de sons qui ne sont pas sur le site, dis à l'élève de les glisser dans le bon répertoire du projet, et désigne-les par leur seul nom. Un fichier du répertoire `données` s'ouvre dans l'éditeur d'un clic dans l'arbre du projet : l'élève peut y taper ou corriger ses données, qui sont enregistrées toutes seules.
- Le projet exporté par la Pythonerie est un fichier `.zip` qui contient
  - `projet.json` : `{"format": "projet-pythonerie", "version": 3, "nom": "Le quiz des capitales", "élève": "", "créé": "2026-10-10T09:00:00Z"}` ;
  - `programmes/Quiz.pyf`, `programmes/outils.pyf`… (un programme rangé dans un dossier : `programmes/jeux/outils.pyf`) ;
  - au besoin `onglets/don0.txt`, `onglets/don1.txt`… (les onglets de données, numérotés sans trou) ;
  - au besoin `images/…`, `sons/…`, `données/…` (un seul niveau, les extensions de chaque répertoire).
  Exemple à lire : `docs/matériels/quiz_des_capitales.zip`. Si tu peux exécuter du code et produire un fichier, tu peux fabriquer ce zip ; sinon, écris le projet en JSON.

### Un projet en JSON

C'est la façon la plus simple, pour toi, de rendre un projet complet : un seul bloc de texte. L'élève le colle avec ☰ → « 📋 Coller un projet (JSON)… » (ce qui entoure le JSON, comme les ```` ```json ````, est ignoré), ou l'enregistre dans un fichier `.json` et le charge avec « 📥 Charger un projet ». Un enseignant peut aussi déposer le `.json` dans `docs/matériels/`, puis lancer `python3 inventaire.py`. Le projet prend la place de celui de l'élève, qui reste dans sa liste « Mes projets » (☰ → « ↶ Revenir au projet précédent » le rouvre).

```json
{
  "format": "projet-pythonerie",
  "version": 3,
  "nom": "La fusée",
  "programmes": {
    "Décollage": "#__main__\n# La fusée\nimporte \"outils/moteur\"\nfusée = charge_image(\"fusée.svg\")\nbip = charge_son(\"médias/sounds/ding.wav\")\naffiche(poussée(3))\n",
    "outils/moteur": "fonction poussée(n):\n    retourne n * 10\n"
  },
  "dossiers": ["outils"],
  "onglets": ["Mercure,1\nVénus,2", "Mars"],
  "fichiers": {
    "données/planètes.csv": "nom,rang\nMercure,1\nVénus,2\n",
    "images/fusée.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"40\" height=\"80\">…</svg>",
    "images/lune.png": { "url": "https://upload.wikimedia.org/…/lune.png" },
    "sons/bravo.wav": { "base64": "UklGR…" }
  }
}
```

- `format` est obligatoire ; `nom` est le nom du projet (sinon « Sans Nom »).
- `programmes` : le nom de chaque programme (avec son dossier : `"outils/moteur"`, sans extension) et son code, avec des `\n` pour les fins de ligne et des `\"` pour les guillemets.
- `dossiers` (facultatif) : des dossiers à créer même vides ; ceux des programmes existent d'office.
- `onglets` (facultatif) : le texte de Don0, Don1… ; `""` pour un onglet vide.
- `fichiers` (facultatif) : chemin `images/…`, `sons/…` ou `données/…` (un seul niveau, extensions de « Projets »), et contenu :
  - **du texte**, tel quel, pour les données et les images SVG ;
  - `{ "url": "https://…" }` : la Pythonerie télécharge le fichier et le range dans le projet, **si le site le permet** (GitHub `raw.githubusercontent.com` et Wikimedia `upload.wikimedia.org` le permettent ; beaucoup d'autres sites non). Sinon le fichier est laissé de côté, et l'élève le voit dans la console : pour une image ou un son en ligne, il est plus sûr d'écrire l'adresse dans le programme, `charge_image("https://…")` ;
  - `{ "base64": "…" }` pour un autre fichier binaire, quand tu peux le calculer réellement (n'invente jamais du base64).
- Préfère les médias du site (`médias/…`, voir plus haut), désignés par leur chemin dans le programme : ils n'ont pas besoin d'être dans le projet.
- Un fichier mal placé, mal nommé ou mal écrit est laissé de côté, et la console le nomme.

## Des piles de cartes (à la HyperCard)

Le projet **« Les cartes (à la HyperCard) »** des Matériels (`docs/matériels/cartes.zip`) refait HyperCard : l'**Éditeur** dessine des cartes, le **Lecteur** les montre. Une **pile** est un fichier JSON du répertoire `données` du projet ; le Lecteur propose, dans sa liste déroulante, tous les `.json` de `données` qui ont des `"cartes"`, sous leur `"titre"`. Trois piles y sont déjà, à lire comme modèles : `apprendre.json` (un cours de Pythonerie, avec des encadrés de code et des boutons « ▶ Exécute »), `pile.json` (le système solaire) et `latin.json` (les déclinaisons latines, avec des images et une carte de crédits).

**Ce que tu rends** quand on te demande une pile : **le seul fichier JSON de la pile**, dans un bloc `json`, et son nom de fichier (court, sans espace : `latin.json`). Tu n'écris aucun programme : le Lecteur et l'Éditeur existent déjà. L'élève ouvre le projet (bouton Matériels → « Les cartes »), enregistre ton JSON sous ce nom et le fait glisser dans le répertoire `données` (ou clique sur le petit ＋ du répertoire), puis exécute le Lecteur et choisit la pile dans la liste. Il pourra ensuite la retoucher dans l'Éditeur (on y fait glisser les éléments).

### Le format

```json
{
  "titre": "Les déclinaisons latines",
  "largeur": 720, "hauteur": 540,
  "cartes": [
    {"nom": "Accueil", "fond": "beige", "son": "médias/sounds/ding.wav", "éléments": [
      {"genre": "texte", "x": 40, "y": 26, "couleur": "rouge foncé", "taille": 40, "texte": "Les déclinaisons latines"},
      {"genre": "texte", "x": 40, "y": 88, "couleur": "noir", "taille": 18, "texte": "Première ligne,\net la deuxième."},
      {"genre": "bouton", "x": 520, "y": 480, "couleur": "noir", "taille": 24, "texte": "Commencer ▶", "action": "suivante"}]},
    {"nom": "Rosa", "fond": "beige", "éléments": [
      {"genre": "image", "x": 470, "y": 100, "couleur": "noir", "taille": 40, "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/…/500px-….jpg"},
      {"genre": "rectangle", "x": 40, "y": 100, "couleur": "marron foncé", "taille": 24, "l": 350, "h": 181},
      {"genre": "texte", "x": 58, "y": 112, "couleur": "beige", "taille": 18, "police": "Menlo, Consolas, 'DejaVu Sans Mono', monospace", "texte": "Nom.  rosa       rosae\nAcc.  rosam      rosās"},
      {"genre": "disque", "x": 600, "y": 400, "couleur": "jaune", "taille": 30},
      {"genre": "bouton", "x": 40, "y": 480, "couleur": "noir", "taille": 24, "texte": "◀ Retour", "action": "précédente"}]}]
}
```

- **La pile** : `"titre"` (le nom dans la liste du Lecteur), `"largeur"` et `"hauteur"` (720 × 540 d'habitude ; une autre taille marche : le canevas s'y adapte), `"cartes"`.
- **Une carte** : `"nom"` (unique : les boutons s'en servent), `"fond"` (une couleur), `"éléments"` (dessinés dans l'ordre de la liste : un rectangle de fond vient avant le texte qu'il porte), et au besoin `"son"` (joué quand la carte s'ouvre) et `"script"` (voir plus bas).
- **Un élément** a toujours `"genre"`, `"x"`, `"y"`, `"couleur"` et `"taille"` ; `(x, y)` est son coin en haut à gauche (le centre pour un disque). Les couleurs sont celles du langage (`"bleu marine"`, `"rouge foncé"`, `"gris clair"`…, ou `"#rrggbb"`).
- **Les genres** :
  - `"texte"` : les lignes de `"texte"`, séparées par `\n`, en lettres de `taille` points ; `"police"` (facultatif) pour du code ou un tableau aligné : `"Menlo, Consolas, 'DejaVu Sans Mono', monospace"` (pas JetBrains Mono, qui dessine `>=` comme `≥`). Une ligne vide garde sa place.
  - `"rectangle"` : plein, de `"l"` sur `"h"` (sinon 3 × taille sur 2 × taille).
  - `"disque"` : plein, de rayon `taille`.
  - `"image"` : large de **4 × taille**, la hauteur suit les proportions de l'image. `"image"` est le nom d'un fichier du répertoire `images` du projet (`"rosa.jpg"`), un média du site (`"médias/images/étoile.svg"`) ou une adresse `https://…`.
  - `"bouton"` : un vrai bouton, qui porte `"texte"` ; `"action"` dit où il mène : `"suivante"`, `"précédente"`, `"première"`, `"dernière"`, le nom d'une carte, `"pile : apprendre.json"` (la première carte d'une autre pile du projet), ou `"aucune"` (on reste : pour un bouton qui n'a qu'un script). `"son"` (facultatif) est joué au clic.
- Les flèches gauche et droite du clavier passent à la carte précédente ou suivante ; la suivante de la dernière est la première.
- Le JSON doit être valide : guillemets doubles, pas de commentaire, `\n` pour aller à la ligne dans un texte, pas de virgule après le dernier élément d'une liste.

### Placer les éléments sans les voir

Le texte ne passe jamais à la ligne tout seul : coupe toi-même les lignes, et calcule les places.

- **Texte** : `y` est le haut de la première ligne ; chaque ligne prend **1,25 × taille** en hauteur. Une lettre fait en moyenne **0,5 × taille** de large (0,6 × taille en police à chasse fixe) : à 18 points, une ligne de 70 lettres fait 630 points, juste ce qui tient entre les marges d'une carte de 720.
- **Bouton** : il mesure **(nombre de lettres × 0,45 + 1,2) × taille** de large et **1,35 × taille** de haut. Pour qu'un bouton finisse à 40 points du bord droit : `x = largeur − 40 − (lettres × 0,45 + 1,2) × taille`.
- **Image** : choisis `taille` d'après les proportions de l'image (largeur l, hauteur h) pour qu'elle tienne dans sa zone : largeur affichée = 4 × taille, hauteur affichée = 4 × taille × h / l.
- **Encadré de code ou tableau** : un rectangle (`"bleu marine"`, `"marron foncé"`), puis un texte en police à chasse fixe, décalé de 18 points à droite et de 12 vers le bas ; pour n lignes de taille t, le rectangle a une hauteur de n × 1,25 × t + 24. Dans une police à chasse fixe, évite les exposants (`1ʳᵉ`), qui ne s'alignent pas : écris `1re`.
- Un modèle qui marche : marges de 40 points ; un titre de 30 à 40 points en haut (y ≈ 22) ; le texte entre 17 et 22 points ; les boutons « ◀ Retour » (à gauche) et « Suite ▶ » (à droite) à la même place sur toutes les cartes (y ≈ 480 pour une hauteur de 540), avec, entre eux, un numéro de carte « 3 / 9 » en gris ; une seule idée par carte.

### Images et sons

- Une image en ligne s'utilise directement par son adresse. Les vignettes de Wikimedia Commons marchent : l'adresse que Commons donne pour une vignette de 500 points (`https://thumb.wikimedia.org/wikipedia/commons/thumb/…/500px-….jpg`, vérifié) : choisis des images à **licence libre** (domaine public, CC0, CC BY, CC BY-SA) et ajoute une dernière carte « Crédits » qui donne, pour chacune, l'auteur, la licence et le nom du fichier sur Commons (CC BY et CC BY-SA l'exigent). Une image en ligne doit rester en ligne : pour une pile qui marche sans Internet, l'élève met les fichiers dans `images/` et la pile les désigne par leur seul nom.
- Les sons : un son du projet (`"bravo.wav"`, répertoire `sons`) ou du site (`"médias/sounds/ding.wav"`, `"pop.wav"`… voir « Médias »).

### Les scripts

Une carte (à son ouverture) ou un bouton (au clic) peut lancer un **script** : `"script": 3` désigne le `cas 3:` du `selon` de la fonction `extensions(id)`, dans le programme `biblios.pyf` du projet. Le Lecteur montre la console, puis appelle `extensions(3)`. N'emploie que les numéros qui existent dans ce `selon`. Si la pile a besoin d'un nouveau script, donne à part ce que l'élève ajoutera lui-même dans `biblios.pyf` : une fonction sans paramètre, écrite au premier niveau (jamais une fonction dans une autre), puis un nouveau `cas` avec le numéro suivant ; l'Éditeur relit ce `selon` et vérifie que `biblios` se compile toujours, mais ne l'écrit jamais.

```
fonction carpe_diem():
    affiche("Carpe diem : cueille le jour (Horace).")

fonction extensions(id):
    selon(id):
        …
        cas 11:
            carpe_diem()
        défaut:
            affiche("— Il n'y a pas de script", id, "dans biblios")
```

Dans un script, `va_vers_carte("Rosa")` montre une autre carte de la pile.

## Pièges (vérifiés) : à éviter absolument

1. **L'expression conditionnelle est permise**, comme en Python : `x = a si c sinon b`. Elle marche aussi en argument (`affiche("un" si n == 1 sinon "plusieurs")`), dans une liste, un dictionnaire, en tête d'une compréhension (`[v si v > 0 sinon 0 pour v dans l]`, à ne pas confondre avec le filtre `[v pour v dans l si v > 0]`), et enchaînée (`a si c1 sinon b si c2 sinon d`). Le `sinon` est obligatoire ; seule la branche choisie est évaluée.
2. **Pas de `non` juste après une parenthèse ouvrante** : `x = (non (a == 2)) et b == 2` est refusé. Écris `non (a == 2) et b == 2`, qui marche, comme toutes les autres combinaisons de parenthèses, `et`, `ou` et `non`.
3. **Pas de boucle sans fin** (`tantque Vrai:` sans `sortir`) : la page ne réagit plus pendant qu'elle tourne, et la Pythonerie l'arrête au bout de 10 millions de tours, avec une erreur. Un `tantque` ne doit donc jamais dépasser 10 millions de tours. Pour tout ce qui bouge, utilise `animer`.
4. **`intervalle` est limité** (quelques centaines de milliers d'éléments au plus) : pour de très grandes boucles, imbrique deux boucles.
5. **Une seule chose par ligne**, pas de `;`. Pas de `import` de modules Python, pas de `global` / `nonlocal`, pas de décorateurs, de `with`, de `yield`, de `*args` ni d'arguments nommés.
6. `Rien` s'affiche `[]`.
7. Un nombre écrit sans point est un entier (`7`) ; avec un point ou un exposant, c'est un réel (`7.0`, `1.5e3`). Pour un score ou un compteur, utilise des entiers. `arrondi(x)` et `**` peuvent donner un réel (`4.0`, `8.0`) : utilise `entier(…)` si tu veux afficher un entier.
8. Pour quitter une fonction avant la fin, écris `retourne Rien`. Si tu dois faire `retourne` dans le bloc qui attrape une erreur, écris `sauf:` sans variable : dans `sauf(e):`, `retourne` ne quitte que le bloc `sauf`, et la fonction continue après.
9. Dans une fonction appelée par `animer`, `quand_clic`…, n'oublie pas `=:` (ou `+=`) pour modifier l'état du jeu ; un simple `=` crée une variable locale, et le jeu semble ne rien faire.
10. **`non` appliqué à une liste agit sur chacun de ses éléments** : `si non pile:` ne teste pas si la liste est vide (avec `pile = []`, la condition est fausse). Écris `si longueur(pile) == 0:`.
11. **Une question ou `lit_fichier` n'attend pas** : `nom = demande("Nom ?")` est une erreur, et le code écrit après `demande("Nom ?", f)` s'exécute avant la réponse. Ce qui a besoin de la réponse va dans la fonction de rappel `f`.
12. Une erreur d'exécution montre l'expression LispE en cause (« dans le code LispE : (at l 5) ») et la fonction où elle s'est produite (avec ses appelants), mais pas la ligne exacte de l'instruction : écris des fonctions courtes, et nomme bien tes variables.

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

Les exemples du site montrent le style attendu ; lis-les avant d'écrire un programme du même genre. Ils sont dans `docs/exemples/` (adresse brute : `https://raw.githubusercontent.com/clauderouxster/Pythonerie/main/docs/exemples/<fichier>`), et la liste est dans `docs/exemples/index.json` ; dans la Pythonerie, un clic sur un exemple l'ouvre dans un projet à son nom, ses images et ses sons restant dans `médias/` :

`01_bonjour.pyf`, `02_conditions.pyf`, `03_boucles.pyf`, `04_fonctions.pyf`, `05_listes.pyf`, `06_dessin.pyf`, `07_tortue.pyf`, `08_animation.pyf` (balle qui rebondit), `09_interaction.pyf` (souris et clavier), `10_classes.pyf` (classes, essaie/sauf), `11_courbe.pyf` (courbe mathématique), `12_images_sons.pyf`, `13_dessin_souris.pyf` (`quand_glisse`), `14_piano.pyf`, `15_casse_briques.pyf`, `16_serpent.pyf`, `17_envahisseurs.pyf`, `18_tableur.pyf` (champs de saisie, flèches, totaux), `19_asteroides.pyf` (pilotage avec `touche_enfoncée`, astéroïdes qui se cassent), `20_atelier.pyf` (tous les objets du canevas), trois versions avec des dessins préparés (`21_casse_briques_dessins.pyf`, `22_envahisseurs_dessins.pyf`, `23_asteroides_dessins.pyf`), `24_graphiques.pyf` (les 17 genres de graphique, choisis dans une `liste_déroulante`) et `25_sondage.pyf` (des boutons qui votent, un camembert et des colonnes redessinés à chaque vote).

Trois **projets** complets sont dans `docs/matériels/` : `quiz_des_capitales.zip` (importe, données, sons), `zaxxon.zip` (un jeu en perspective isométrique : trois programmes, dont `outils/projection`, des boîtes en relief avec `polygone_plein` ; un plan de niveau lu dans `données/forteresse.txt` ; des sons du projet) et `cartes.zip` (les piles de cartes à la HyperCard : voir « Des piles de cartes ») ; `systeme_solaire_3d.zip` montre la 3D (groupes emboîtés, textures, inclinaisons, clic sur un objet) ; `asteroides_3d.zip`, un jeu en 3D (logique en points, montrée sur un plan vu d'en haut ; objets créés au départ dans des réserves, puis cachés et réutilisés).

Le mode d'emploi pour les enfants (`docs/guide.html`) contient un glossaire de tous les mots. Environ 180 instructions avancées de LispE portent aussi un nom français ; elles sont décrites dans `docs/basic/français.lisp` (une ligne `(link "nom" 'instruction) ; description` par instruction). Préfère les fonctions de ce guide, plus simples pour un enfant.

## Avant de rendre le programme, vérifie

- tous les blocs ouverts par `:` sont décalés de 4 espaces ;
- aucune des tournures de la liste « Pièges » ;
- `=:` partout où une fonction modifie une variable du programme ;
- les médias chargés existent dans la liste ci-dessus ;
- les touches et les couleurs ont leur nom français ;
- le programme marche sans clavier (souris ou toucher), si c'est un jeu.
