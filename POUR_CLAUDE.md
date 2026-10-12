# Écrire des programmes pour La Pythonerie — guide pour Claude

Ce fichier s'adresse à Claude (ou à toute autre IA) à qui l'on demande d'écrire un programme pour **La Pythonerie** : https://clauderouxster.github.io/Pythonerie/ (dépôt : https://github.com/clauderouxster/Pythonerie).

La Pythonerie fait programmer des enfants (à partir de 7 ans) dans un **Python en français**. Le programme est traduit en LispE, puis exécuté dans le navigateur (WebAssembly). Ce n'est pas du Python : beaucoup de choses se ressemblent, mais les mots-clefs sont français, la bibliothèque est différente, et certaines tournures de Python n'existent pas (voir « Pièges »).

## Ce que tu dois rendre

- **Un seul programme complet**, dans un bloc de code. L'élève le colle dans l'éditeur (ou l'importe en `.pyf`, l'extension des programmes de la Pythonerie) et clique sur « Exécuter ».
- Ou bien, quand il faut plusieurs programmes, des onglets de données ou des fichiers, **un projet complet en JSON**, dans un bloc de code `json` (voir « Un projet en JSON ») : l'élève le colle avec ☰ → « 📋 Coller un projet (JSON)… ».
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
| `match x: case "a":` / `case _:` | `selon (x):`, puis des blocs `cas "a":` ou `cas 3:` (un texte ou un nombre) et, en dernier, `défaut:` ; chaque `cas` et `défaut` ouvre un bloc décalé sur les lignes suivantes (pas d'instruction sur la même ligne) |
| `lambda x: x * 2` | `lambda(x) x * 2` (ou `λ`) |
| `f"{x}"` | `f"{x}"` (les expressions entre accolades suivent la syntaxe de la Pythonerie) |
| `[x * x for x in l if x > 0]` | `[x * x pour x dans l si x > 0]` |
| `a, b = b, a` | `a, b = b, a` (et `x, y = point` pour dépaqueter une liste) |
| `global x` | **n'existe pas** : voir ci-dessous |

**Après un `:`, on va toujours à la ligne.** Une ligne qui ouvre un bloc (`si`, `sinonsi`, `sinon`, `pour`, `tantque`, `fonction`, `classe`, `selon`, `cas`, `défaut`, `essaie`, `sauf`…) se termine par `:`, et son contenu s'écrit sur les lignes suivantes, décalées de quatre espaces : jamais `si x > 0: affiche(x)` sur une seule ligne. C'est une règle de la Pythonerie, voulue pour éviter les confusions.

Opérateurs : `+ - * / // % **`, `+= -= *= /=`, comparaisons `== != < <= > >=`. Les listes (`[1, 2]`, `l[0]`, `l[-1]`, `l[1:3]`, `l[i] = v`) et les dictionnaires (`{"a": 1}`, `d["b"] = 2`, `pour clé dans d`) fonctionnent comme en Python. Les chaînes `"…"` acceptent `\n` ; les chaînes `"""…"""` ou `'''…'''` peuvent s'étendre sur plusieurs lignes et gardent leur contenu tel quel, sans échappement.

### Variables du programme et fonctions

- Dans une fonction, `x = …` crée une **variable locale**.
- `x =: …` modifie la **variable du programme** (c'est le `global` de Python).
- `x += …` (et `-=`, `*=`…) modifie la variable du programme si la fonction n'a pas de variable locale `x`.
- Lire une variable du programme, ou modifier une liste du programme (`l[i] = v`, `l.ajoute(x)`), ne demande rien de particulier.
- Un élève peut nommer ses variables comme il veut, même comme une fonction de la bibliothèque (`gauche`, `somme`) : elles sont renommées automatiquement.

## La bibliothèque

### Console
`affiche(a, b, …)` (avec retour à la ligne), `écris(a, …)` (sans), `efface_console()`, `affiche_console()` (montre la console, même en plein écran du canevas, où elle vient sous le canevas ; `cache_console()` l'en retire), `demande(question)` → texte, `demande_nombre(question)` → nombre (`lire`, `lire_nombre`, `input` sont des synonymes). La question s'écrit dans la console, et l'élève répond sous la console. **Le programme repart du début après chaque réponse** (les réponses déjà données sont rendues dans l'ordre, la partie rejouée est muette) : tout le hasard (`aléatoire`, `hasard`, `choisis`, `mélange`, `au_hasard`, les lois de probabilité) refait les mêmes tirages à chaque relance, si bien que les questions ne changent pas. Évite seulement de dépendre de l'heure avant une question. Dans une fonction d'animation ou d'événement, `demande` ouvre une fenêtre du navigateur, qui bloque la page ; quand le canevas est en plein écran (où cette fenêtre ne peut pas s'ouvrir), la question est posée dans un cadre sur le canevas, puis l'événement est **rejoué** avec la réponse : ce qui précède la question dans la fonction s'exécute deux fois. Pose plutôt tes questions dans le programme principal, ou utilise `saisie`.

### Nombres
`aléatoire(a, b)` (entier, bornes comprises), `hasard()` (entre 0 et 1), `choisis(liste)`, `absolu(x)` (ou `abs`), `racine(x)`, `puissance(x, y)`, `arrondi(x)` / `arrondi(x, n)`, `somme(l)`, `maximum(l)` ou `maximum(a, b)`, `minimum(…)`, `sinus(degrés)`, `cosinus(degrés)`, `pi`, `entier(x)`, `réel(x)`, `nombre(texte)` (réel, accepte « 2,5 », 0.0 sinon), `chaîne(x)`, `typede(x)` (le genre en français, en texte : `"entier"`, `"réel"`, `"texte"`, `"liste"`, `"dictionnaire"`, `"booléen"`, `"rien"`, ou le nom de la classe d'un objet ; à préférer pour comparer : `si typede(d) == "dictionnaire":`), `type_de(x)` (le nom LispE, un atome anglais), `intervalle(fin)` / `intervalle(début, fin, pas)` (ou `range`), `longueur(x)` (ou `len`).

`7 / 2` vaut `3.5`, `7 // 2` vaut `3`, `[1, 2] + [3]` vaut `[1, 2, 3]`.

### Listes et textes
`liste.ajoute(x)` (ou `append`), `trie(l)`, `inverse(l)`, `contient(conteneur, x)`, `majuscules(t)`, `minuscules(t)`, `remplace(t, avant, après)`, `découpe(t, séparateur)` (aux espaces par défaut), `nettoie(t)` (ou `strip`), `"sép".joindre(l)`. Les fonctions de texte s'écrivent aussi comme des méthodes : `ligne.découpe(",")`, `texte.majuscules()`.

### Dessin (canevas de 800 × 600, origine en haut à gauche, y vers le bas)
- `canevas(largeur, hauteur)` change la taille (à appeler au début ; le dessin est effacé) ; `largeur()`, `hauteur()` donnent la taille actuelle. Chaque exécution repart de 800 × 600.
- `efface()`, `fond(c)`, `couleur(c)` (trait et remplissage), `couleur_trait(c)`, `couleur_remplissage(c)`, `épaisseur(e)`, `rgb(r, g, b)`.
- `point(x, y)`, `ligne(x1, y1, x2, y2)`, `rectangle(x, y, l, h)`, `carré(x, y, côté)`, `cercle(x, y, r)`, `disque(x, y, r)`, `ellipse(x, y, rx, ry)`, `triangle(x1, y1, x2, y2, x3, y3)`, `polygone([[x1, y1], [x2, y2], …])`, et leurs versions pleines : `rectangle_plein`, `carré_plein`, `ellipse_pleine`, `triangle_plein`, `polygone_plein` (`disque` est le cercle plein).
- `texte(x, y, message)` : (x, y) est le **coin en haut à gauche** du texte. `taille_texte(n)`, `police(nom)`.
- Pixels : `couleur_pixel(x, y)` rend `[rouge, vert, bleu, opacité]` (0 à 255 ; `[0, 0, 0, 0]` hors du canevas). `pixels(x, y, l, h)` rend les points d'un rectangle ligne après ligne, 4 valeurs par point (une liste de `l * h * 4` entiers ; le point (c, ligne) commence à l'indice `(ligne * l + c) * 4`) ; `pose_pixels(x, y, l, h, valeurs)` les redessine (même rangement, valeurs ramenées entre 0 et 255). Les noms de couleur ne donnent pas des valeurs « rondes » (`"rouge"` vaut `[229, 57, 53, 255]`) : pour tester une couleur, compare avec un point dessiné en `rgb(…)`. Reposer tout le canevas prend presque une seconde : à éviter dans `animer`.
- Couleurs : `rouge, vert, bleu, jaune, orange, violet, rose, marron, noir, blanc, gris, cyan, magenta, turquoise, beige, or, argent, bleu marine`, et les nuances avec `clair` ou `foncé` (invariables) : `rouge clair, rouge foncé, vert clair, vert foncé, bleu clair, bleu foncé, jaune clair, jaune foncé, orange clair, orange foncé, violet clair, violet foncé, rose clair, rose foncé, marron clair, marron foncé, gris clair, gris foncé`. Toute couleur CSS marche aussi (`"#ff8800"`). Un nom inconnu (`"vert pomme"`) ne fait rien : utilise `rgb(…)`.

### Tortue (part du centre, regarde vers la droite)
`avance(d)`, `recule(d)`, `gauche(angle)`, `droite(angle)`, `lève_crayon()`, `baisse_crayon()`, `va_à(x, y)`, `oriente(angle)` (0 = droite, 90 = bas), `origine()`, `montre_tortue()`, `cache_tortue()`, `position_x()`, `position_y()`, `position()` (la liste `[x, y]`), `cap()`. La tortue n'apparaît qu'à sa première commande ; dans un jeu, appelle `cache_tortue()`.

### Animation et événements
- `animer(f, délai)` appelle `f()` toutes les `délai` millisecondes (16 à 30 pour un jeu fluide). C'est **la seule façon** de faire une boucle de jeu.
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
  - `zone_édition(clef, x, y, lignes, f)` → texte sur plusieurs lignes, `f(clef, texte)` quand on la quitte ou avec Ctrl+Entrée.
  - `valeur_objet(clef)` lit la valeur de n'importe quel objet (texte, nombre, Vrai/Faux, chemin) ; `change_objet(clef, valeur)` la change sans appeler `f` ; `retire_objet(clef)` enlève un objet, `retire_objets()` les enlève tous (pour changer d'écran). Les fonctions sont données par leur nom, sans parenthèses.
- `arrête()` arrête les animations. L'élève a aussi un bouton « Arrêter » et un mode plein écran.
- Le clavier ne marche qu'après un clic dans le canevas (ou en plein écran) : dis-le dans les commentaires.

### Images et sons
`img = charge_image(adresse)`, `place_image(img, x, y)` ou `place_image(img, x, y, l, h)` ; `snd = charge_son(adresse)`, `joue_son(snd)`. `liste_sons()`, `liste_images()` et `liste_données()` rendent les noms des fichiers du projet (triés, à donner tels quels à `charge_son`, `charge_image`, `charge_données`) ; `liste_sons()` et `liste_images()` y ajoutent ceux des médias du site (`"exemples/médias/ding.wav"`, `"exemples/médias/piano/do_4.wav"`, `"exemples/médias/étoile.svg"`…). Charge les médias **une fois, au début** du programme, puis garde le numéro dans une variable. Écris le nom du son **en toutes lettres** dans `charge_son("…")` (pas une variable ni un calcul) : la Pythonerie décode alors ce son avant de lancer le programme, et il est prêt à jouer tout de suite. Un nom seul (`"chat.png"`, `"bravo.wav"`) désigne un fichier des répertoires images ou sons du projet ; un chemin (`exemples/médias/ding.wav`) un fichier du site ; `https://…` une adresse Internet : une image ou un son en ligne s'utilise directement, `charge_image("https://upload.wikimedia.org/…")`, même si le site ne permet pas de télécharger le fichier.

### Fichiers et données
- `don0`, `don1`… : le texte des onglets de données du projet (bouton « Données » de l'éditeur) : tous les programmes du projet, et ceux qu'ils importent, voient les mêmes. Un onglet vide ne crée pas de variable. À utiliser quand l'élève colle ses propres données.
- `range_données("don1", valeur)` : écrit la valeur (une liste ou un nombre est écrit comme `affiche` l'écrirait) dans l'onglet Don1, enregistré avec le projet. L'onglet doit exister, ou venir juste après le dernier (on le crée) ; sinon, c'est une erreur. Pendant l'exécution, la variable `don1` garde sa valeur du départ ; `prend_données("don1")` renvoie le texte actuel de l'onglet (y compris ce qu'un `range_données` vient d'y écrire, `""` s'il est vide ; un onglet inexistant est une erreur).
- `charge_données(nom)` : le texte d'un fichier du répertoire **données** du projet (par exemple `charge_données("capitales.csv")`) ; un fichier absent est une erreur. Ce n'est pas un fichier du site : l'élève (ou un projet des Matériels) doit l'avoir mis dans le projet.
- `charge_programme(nom)` : le code d'un programme du projet ; `sauve_programme(nom, code)` l'écrit ou le crée, sans l'ouvrir (un programme peut en écrire un autre, qu'un troisième importe) ; `vérifie_code(code)` rend `""` si le code se compile, sinon le message d'erreur, sans rien exécuter. Pas disponibles dans une application Web.
- `sauve_données(nom, valeur)` : écrit (ou remplace) le fichier `nom` dans le répertoire **données** du projet (`.txt`, `.csv`, `.tsv`, `.json` ou `.md` ; sans extension, `.txt`) ; une valeur qui n'est pas un texte est écrite comme `affiche` l'écrirait : pour du JSON, `sauve_données("pile.json", en_json(d))`, relu par `analyse_json(charge_données("pile.json"))`. Le fichier apparaît dans le projet et part avec lui (export, application Web). Dans une application Web, il ne vit que le temps de la visite.
- `lit_fichier()` (sans argument) : un fichier de l'ordinateur, choisi par l'élève dans une fenêtre (le programme repart du début une fois le fichier choisi) ; `lit_fichier("https://…")` : le texte d'une adresse Internet, si le site l'autorise.
- `écrit_fichier(nom, texte)` : enregistre le texte dans le dossier Téléchargements (`"scores"` devient `scores.txt`).
- `ouvre_page(adresse)` : ouvre une page `https://…` dans un nouvel onglet ; une autre adresse est une erreur. Le navigateur bloque une fenêtre ouverte sans geste de l'élève : appelle `ouvre_page` dans la fonction d'un bouton ou de `quand_clic` (ou au début du programme, juste après ▶ Exécuter), pas dans `animer`. Quand le programme est rejoué après une `demande()`, la page n'est pas rouverte.

### Médias disponibles sur le site
Chemins à donner tels quels à `charge_image` / `charge_son` :
- `exemples/médias/étoile.svg`
- sons : `exemples/médias/ding.wav`, `pop.wav`, `tir.wav` (laser), `explosion.wav`, `boum.wav` (gros choc), `pas_1.wav` à `pas_4.wav` (notes graves brèves)
- piano, trois octaves : `exemples/médias/piano/do_3.wav` … `si_5.wav`, avec `do_dièse_4.wav`, `ré_dièse_4.wav`, `fa_dièse_4.wav`, `sol_dièse_4.wav`, `la_dièse_4.wav` (octaves 3, 4 et 5)

## Projets

Les programmes de l'élève forment un **projet**, qui a un nom (« Sans Nom » au départ) et trois répertoires fixes : `images` (png, jpg, gif, svg, webp), `sons` (wav, mp3, ogg) et `données` (txt, csv, tsv, json, md), 5 Mo au plus par fichier.

- `importe "outils"`, seul sur sa ligne, ajoute au programme le code du programme « outils » du projet (fonctions, variables). `importe "jeux/outils"` désigne un programme d'un dossier ; le chemin est cherché depuis le dossier du programme qui importe, puis à la racine. Seuls les programmes du projet s'importent (pas de module Python), pas de `comme`, pas de `from … import`. Une fonction définie dans deux programmes importés est une erreur.
- Si ton programme a besoin de données, d'images ou de sons qui ne sont pas sur le site, dis à l'élève de les glisser dans le bon répertoire du projet, et désigne-les par leur seul nom.
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
    "Décollage": "# La fusée\nimporte \"outils/moteur\"\nfusée = charge_image(\"fusée.svg\")\nbip = charge_son(\"exemples/médias/ding.wav\")\naffiche(poussée(3))\n",
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
- Préfère les médias du site (`exemples/médias/…`, voir plus haut), désignés par leur chemin dans le programme : ils n'ont pas besoin d'être dans le projet.
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
    {"nom": "Accueil", "fond": "beige", "son": "exemples/médias/ding.wav", "éléments": [
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
  - `"image"` : large de **4 × taille**, la hauteur suit les proportions de l'image. `"image"` est le nom d'un fichier du répertoire `images` du projet (`"rosa.jpg"`), un média du site (`"exemples/médias/étoile.svg"`) ou une adresse `https://…`.
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
- Les sons : un son du projet (`"bravo.wav"`, répertoire `sons`) ou du site (`"exemples/médias/ding.wav"`, `"pop.wav"`… voir « Médias »).

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

1. **Pas d'expression conditionnelle** : `x = a si c sinon b` est refusé. Écris un `si` / `sinon`.
2. **Pas de `non` juste après une parenthèse ouvrante** : `x = (non (a == 2)) et b == 2` est refusé. Écris `non (a == 2) et b == 2`, qui marche, comme toutes les autres combinaisons de parenthèses, `et`, `ou` et `non`.
3. **Pas de boucle sans fin** (`tantque Vrai:` sans `sortir`) : la page ne réagit plus pendant qu'elle tourne, et la Pythonerie l'arrête au bout de 10 millions de tours, avec une erreur. Un `tantque` ne doit donc jamais dépasser 10 millions de tours. Pour tout ce qui bouge, utilise `animer`.
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

Les exemples du site montrent le style attendu ; lis-les avant d'écrire un programme du même genre. Ils sont dans `docs/exemples/` (adresse brute : `https://raw.githubusercontent.com/clauderouxster/Pythonerie/main/docs/exemples/<fichier>`), et la liste est dans `docs/exemples/index.json` ; dans la Pythonerie, un clic sur un exemple l'ouvre dans un projet à son nom, ses images et ses sons restant dans `exemples/médias/` :

`01_bonjour.pyf`, `02_conditions.pyf`, `03_boucles.pyf`, `04_fonctions.pyf`, `05_listes.pyf`, `06_dessin.pyf`, `07_tortue.pyf`, `08_animation.pyf` (balle qui rebondit), `09_interaction.pyf` (souris et clavier), `10_classes.pyf` (classes, essaie/sauf), `11_courbe.pyf` (courbe mathématique), `12_images_sons.pyf`, `13_dessin_souris.pyf` (`quand_glisse`), `14_piano.pyf`, `15_casse_briques.pyf`, `16_serpent.pyf`, `17_envahisseurs.pyf`, `18_tableur.pyf` (champs de saisie, flèches, totaux), `19_asteroides.pyf` (pilotage avec `touche_enfoncée`, astéroïdes qui se cassent), `20_atelier.pyf` (tous les objets du canevas).

Trois **projets** complets sont dans `docs/matériels/` : `quiz_des_capitales.zip` (importe, données, sons), `zaxxon.zip` (un jeu en perspective isométrique : trois programmes, dont `outils/projection`, des boîtes en relief avec `polygone_plein` ; un plan de niveau lu dans `données/forteresse.txt` ; des sons du projet) et `cartes.zip` (les piles de cartes à la HyperCard : voir « Des piles de cartes »).

Le mode d'emploi pour les enfants (`docs/guide.html`) contient un glossaire de tous les mots. Environ 180 instructions avancées de LispE portent aussi un nom français ; elles sont décrites dans `docs/basic/français.lisp` (une ligne `(link "nom" 'instruction) ; description` par instruction). Préfère les fonctions de ce guide, plus simples pour un enfant.

## Avant de rendre le programme, vérifie

- tous les blocs ouverts par `:` sont décalés de 4 espaces ;
- aucune des tournures de la liste « Pièges » ;
- `=:` partout où une fonction modifie une variable du programme ;
- les médias chargés existent dans la liste ci-dessus ;
- les touches et les couleurs ont leur nom français ;
- le programme marche sans clavier (souris ou toucher), si c'est un jeu.
