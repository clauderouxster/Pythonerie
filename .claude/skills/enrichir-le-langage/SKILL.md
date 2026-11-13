---
name: enrichir-le-langage
description: Enrichir ou corriger le langage de The Atelier of the Apps et de la Pythonerie — nouvelle instruction ou fonction de bibliothèque, nouvelle tournure de la grammaire, correction du transpileur, service JavaScript du canevas, bibliothèque importée (libX) — avec l'architecture des deux sites, les règles de l'auteur, LispE (le langage cible : formes produites, primitives, pièges, WASM), les tests de non-régression (non_regression.py), et la documentation obligatoire (guides YAML/MD de l'IA et mode d'emploi guide.html dans les trois langues). À utiliser pour toute modification du langage ou de la bibliothèque de l'un ou l'autre projet, et pour corriger un bogue de traduction ou d'exécution.
---

# Enrichir ou corriger le langage de l'Atelier et de la Pythonerie

Cette compétence existe en deux versions, qui disent la même chose :
- en anglais, dans l'Atelier : `Atelier-of-the-Apps/.claude/skills/enrich-the-language/SKILL.md` ;
- en français, dans la Pythonerie : `Pythonerie/.claude/skills/enrichir-le-langage/SKILL.md`.

Quand tu modifies l'une, reporte le changement dans l'autre, traduit.

L'auteur des deux projets, Claude Roux, est aussi l'auteur de LispE. Les deux sites traduisent un langage proche de Python en **LispE**, puis l'exécutent dans le navigateur avec LispE compilé en WebAssembly. L'Atelier est la plate-forme en trois langues (français, anglais, coréen). La Pythonerie est sa sœur aînée, en français seulement.

## 0. Maintenir cette compétence en même temps que le code

**Cette compétence fait partie du code. Elle se maintient en parallèle des développements, dans le même commit que le changement qu'elle décrit.**

Mettre la compétence à jour dès qu'un travail change ce qu'elle dit :
- un nouveau fichier, ou un fichier qui change de rôle ;
- une étape nouvelle dans les recettes, ou une vérification nouvelle ;
- un piège de LispE ou du langage découvert, ou un nom réservé rencontré ;
- une règle ou une décision de l'auteur ;
- une forme désormais acceptée, ou désormais refusée.

**Si elle se trompe, on la corrige ; si elle a vieilli, on la met à jour.** Une compétence fausse est pire que pas de compétence, parce qu'on lui fait confiance.

Elle est écrite pour quelqu'un qui reprend le projet sans personne à qui demander : une autre équipe, un autre Claude Code, ou toi-même dans un an. Elle doit donc se suffire à elle-même. Elle peut renvoyer aux guides YAML et à la documentation de LispE, mais ne doit pas supposer un savoir qui n'est écrit nulle part.

**Les deux versions doivent rester au même niveau** : l'anglaise dans l'Atelier, la française dans la Pythonerie. Après chaque modification, reporter le changement dans l'autre, traduit, en gardant la même structure (sections numérotées, blocs de code, cases de la check-list). Quand les deux dépôts sont côte à côte, `python3 version.py` compare cette structure et affiche « ATTENTION : la compétence … n'a plus la même structure que sa version … » si elles ont divergé.

**Ordre de lecture recommandé :**
1. Cette compétence en entier.
2. Le guide YAML de l'IA de la langue concernée (section 1) : il décrit le langage tel que l'utilisateur le voit, la bibliothèque entière, les pièges et les messages d'erreur.
3. Les fichiers du répertoire `basic/` que tu vas toucher.

## 1. Les guides YAML : la description du système

Les guides de l'IA décrivent le langage *tel qu'il est* : syntaxe, toutes les fonctions de la bibliothèque par domaine, projets, pièges vérifiés, et messages d'erreur avec leur cause. **Avant d'ajouter ou de corriger quoi que ce soit, lis la section concernée.** Une fonction voisine existe peut-être déjà, un nom est peut-être déjà pris, ou un piège connu explique peut-être le bogue.

| Rôle | `POUR_CLAUDE.yaml` (fr) | `FOR_CLAUDE.yaml` (en) | `CLAUDE용_안내.yaml` (ko, clefs en anglais) |
|---|---|---|---|
| Nature, langue, dépôt | `atelier` | `atelier` | `atelier` |
| Ce que l'IA doit rendre | `rendre` | `hand_back` | `hand_back` |
| Syntaxe : blocs, mots-clefs, opérateurs, tuples, arguments nommés, listes, chaînes, variables (`=:`) | `syntaxe` | `syntax` | `syntax` |
| Bibliothèque, une sous-section par domaine | `bibliothèque:` → `console`, `nombres`, `listes_textes`, `canevas`, `tortue`, `temps_et_événements`, `objets_du_canevas`, `dessins_préparés`, `3d`, `images_sons`, `vidéos`, `données_fichiers`, `ia`, `mcp`, `noeuds`, `libworld`, `libsound`, `librobot` | `library:` → `console`, `numbers`, `lists_strings`, `canvas`, `turtle`, `time_and_events`, `canvas_widgets`, `prepared_drawings`, `3d`, `images_sounds`, `videos`, `data_files`, `ai`, `mcp`, `nodes`, `libworld`, `libsound`, `librobot` | comme l'anglais |
| Médias du site | `médias_du_site` | `site_media` | `site_media` |
| Projets, import, programme principal, zip, JSON | `projets` | `projects` | `projects` |
| Piles de cartes | `piles_de_cartes` | `card_stacks` | `card_stacks` |
| Outils de l'éditeur | `éditeur_outils_canevas` | `editor_canvas_tools` | `editor_canvas_tools` |
| **Pièges vérifiés** (noms réservés, None, nombres, `not` sur une liste…) | `pièges` | `pitfalls` | `pitfalls` |
| **Messages d'erreur exacts → cause → solution** | `bugs_fréquents` (`messages`, `symptômes_sans_message`, `démarche`) | `common_bugs` | `common_bugs` |
| Modèle de jeu, références, vérifications avant de rendre | `modèle_de_jeu`, `références`, `vérifier_avant_de_rendre` | `game_model`, `references`, `check_before_handing_back` | idem |

**Comment le harnais utilise ces guides.** L'IA de l'éditeur reçoit seulement le *début* du YAML, tout ce qui précède `bibliothèque:` / `library:`. Elle lit le reste section par section avec l'outil `get_info("titre")`. Le découpage suit l'indentation (`IA.découpeGuide` dans `docs/js/ia.js`) :
- une clef en colonne 0 est une section ;
- sous `bibliothèque:`, une clef décalée de deux espaces est une section.

Les règles d'écriture en découlent :
- le début doit rester **court**, parce que les petits modèles mettent des minutes à lire un long prompt ;
- une nouvelle fonction va dans la sous-section de son domaine ;
- un nouveau message d'erreur va dans `bugs_fréquents` / `common_bugs`, avec son texte exact.

**Les versions à lire, `POUR_CLAUDE.md`, `FOR_CLAUDE.md` et `CLAUDE용_안내.md`**, disent la même chose en prose et en tableaux, et se tiennent au même niveau que les YAML.

**Où modifier.** Les sources sont **à la racine** de l'Atelier. `python3 version.py` les recopie dans `docs/<Langue>/` et écrase ce qui y a été modifié : ne jamais éditer les copies de `docs/`.

**La Pythonerie** n'a **pas de YAML**. Elle a un seul `POUR_CLAUDE.md`, à la racine, avec les sections « Le langage », « La bibliothèque », « Projets », « Des piles de cartes », « Pièges (vérifiés) », « Modèle de jeu » et « Exemples complets à lire ».

**Le mode d'emploi** des élèves (`guide.html`) contient le glossaire « Tous les mots » : la liste de tout ce qui existe, avec un exemple pour chaque mot.

## 2. Architecture des deux sites

### Vue d'ensemble

| | **The Atelier of the Apps** | **La Pythonerie** |
|---|---|---|
| Dépôt | `Atelier-of-the-Apps/` (site dans `docs/`) | `Pythonerie/` (site dans `docs/`, GitHub Pages) |
| Serveur local | `python3 server.py --port 8123` | `python3 serveur.py --port 8124 --port-admin 8125` |
| Langues et extensions | French `.pyf`, English `.pye`, Korean `.pyk` (code en anglais, textes en coréen) | français `.pyf` |
| Langage | `docs/<Langue>/basic/` | `docs/basic/` |
| Aide et complétion de l'éditeur | `docs/<Langue>/mode-atelier.js` | `docs/js/mode-pythonerie.js` |
| Application (éditeur, projets, exécution) | `docs/js/atelier.js` | `docs/js/pythonerie.js` |
| Canevas, services `Pyt.*` | `docs/js/canevas.js`, **noms anglais** (`Pyt.write`, `Pyt.circle`) | `docs/js/canevas.js`, **noms français** (`Pyt.écris`) |
| Textes de l'interface | `docs/traductions.lisp`, lu par `js/langues.js` ; `T('…')` dans le JS | dans le JS |
| Exemples | `docs/French/exemples/`, `docs/English/examples/`, `docs/Korean/예제/`, chacun avec `index.json` | `docs/exemples/` + `index.json` |
| Matériels (projets en zip) | `docs/French/matériels/`, `docs/English/materials/`, `docs/Korean/학습자료/` | `docs/matériels/` |
| Médias communs | `docs/médias/{sounds,images,videos}/` (`fabrique_sons.py`, `fabrique_images.py`) | `docs/médias/{sounds,images}/` |
| Bibliothèques importées | `docs/lib/<nom>/` (`importe libX`) | aucune |
| WASM de LispE | `docs/lispe/` (`lispe.js`, `lispe.wasm`, `lispe_functions.js`) | `docs/lispe/` |
| Guides de l'IA | 3 YAML et 3 MD à la racine | `POUR_CLAUDE.md` à la racine |
| Mode d'emploi | `docs/<Langue>/guide.html` | `docs/guide.html` |
| Version | `python3 version.py` | `python3 version.py` |
| Non-régression | `python3 non_regression.py` | `python3 non_regression.py` |

### Le répertoire `basic/` (un par langue, et un dans la Pythonerie)

| Fichier | Rôle | Qui le modifie |
|---|---|---|
| `basic.grm` | la grammaire | l'auteur, ou avec son accord |
| `compiler.lisp` | lit `basic.grm` et écrit `basic.lisp` (`cd basic && lispe compiler.lisp`) | l'auteur |
| `basic.lisp` | l'analyseur généré | jamais à la main |
| `optimise.lisp` | lit `basic.lisp` et écrit `basic_opt.lisp`. Il fusionne les règles, ajoute un aiguillage sur le premier jeton, des **gardes écrites à la main** et une mémorisation, puis vérifie les arbres sur un corpus. Les quatre copies sont identiques. | ses gardes, avec soin |
| `basic_opt.lisp` | l'analyseur accéléré (environ 4,5 fois plus rapide) : **celui que les sites chargent** | jamais à la main |
| `transpiler.lisp` | l'arbre devient du LispE (`compile`, `compilepython`, `compileconsole`) | avec l'accord de l'auteur |
| `bibliothèque.lisp` | les fonctions du langage, écrites en LispE | librement, en respectant les règles |
| `français.lisp` / `english.lisp` | `(link "nom" 'instruction)` : d'autres noms pour les instructions LispE. Chargé après `transpiler.lisp`. Le coréen reprend `english.lisp`. | **l'auteur seulement** |
| `rules.lisp`, `local_test.lisp` | outils de l'auteur | l'auteur |

### Les fichiers JavaScript de l'Atelier (`docs/js/`)

- `atelier.js` : l'application. Programmes, projets, éditeur CodeMirror, compilation (`compile`), exécution, console, mode LispE (`passeEnLispE`), export.
- `canevas.js` : l'objet `Pyt`, appelé depuis LispE par `evaljsc`. Il gère le dessin, les widgets, le temps et les événements, les sons, les graphiques (`Pyt.chart`) et les attentes (`Pyt.attends`). **Tout nouveau service d'affichage va ici.**
- `scene3d.js` : la 3D avec three.js (`docs/vendor/three`). `Scène3D.avec(f)` sert aux bibliothèques importées.
- `arbres3d.js` : les arbres, partagés entre la 3D et libworld. Une copie identique existe dans la Pythonerie.
- `erreurs.js` : les messages d'erreur de LispE, traduits et simplifiés pour un élève. Il est partagé avec les applications exportées.
- `paquets.js` : assemble un projet (programmes, imports, onglets de la base) en un LispE prêt à lancer.
- `libs.js` : `importe libX`. Il détecte les imports, réserve les noms et précharge les bibliothèques.
- `langues.js` : lit `traductions.lisp`, fournit `T()` et traduit la page.
- `hangul.js` : les noms hangul, que le lecteur de LispE coupe.
- `ia.js`, `appels-outils.js`, `reglages-ia.js` : l'IA de l'éditeur (le harnais, les outils `get_info`, `read_data_tab`…). `ia.js` sert aussi les `appel_ia` des programmes (`IA.discute`) ; avec `outils_ia`, `discuteAvecOutils` envoie les outils du programme par les mêmes adaptateurs que le tchat (`anthropic-messages`, `openai-chat`, `openai-responses`) et rend les appels sans rien exécuter. Les noms des propriétés d'un outil restent sans accents : certains fournisseurs les refusent.
- `mcp.js`, `reglages-mcp.js` : les canaux MCP.
- `fichiers-projet.js` : les répertoires images, sons et données, rangés dans IndexedDB.
- `apps.js` : l'espace Applications.
- `zip.js` : lit et écrit les archives des projets.
- `mode-lispe.js` : la coloration des programmes `.lisp`.
- `docs/appli/appli.js` : le moteur des **applications Web exportées**, qui joue le rôle d'`atelier.js`. Un service ajouté à `canevas.js` y est disponible, mais une primitive qui passe par `Atelier.*` doit aussi exister dans `appli.js`.

La Pythonerie a moins de fichiers : `pythonerie.js` (l'équivalent d'`atelier.js`), `canevas.js`, `scene3d.js`, `arbres3d.js`, `erreurs.js`, `fichiers-projet.js`, `mode-pythonerie.js` et `zip.js`. Les deux `canevas.js` **n'ont pas de fichier commun**. Un moteur partagé, comme les graphiques ou les arbres, est collé dans les deux, et **doit rester synchrone**.

### Le circuit d'un programme

```
source (.pyf/.pye/.pyk)
  │  basic_opt.lisp : analyse → arbre
  │  transpiler.lisp : arbre → LispE
  │  atelier.js (compile) : ajoute (setq language "French") en tête
  ▼
interpréteur LispE (WASM), auquel on ajoute bibliothèque.lisp de la langue
  │  le programme appelle les fonctions de bibliothèque.lisp
  │  qui appellent le navigateur par (evaljsc (list "Pyt.service" arg1 arg2 …))
  ▼
canevas.js : Pyt.service(arg1, arg2, …)
  │  pour une attente (clic, réponse, fichier, réseau) :
  │  Pyt.attends → plus tard, rappel d'une fonction LispE
```

**Dans l'Atelier, le JS est neutre.** Les services portent des noms anglais, et l'interface entre LispE et JS ne contient ni français ni coréen. Les valeurs propres à une langue, comme les couleurs (`"rouge"`) et les touches, sont traduites par le JS avec le dictionnaire de la langue du programme (`traductions.lisp`, catégories `color`, `key`, `device`, `ui`). Ainsi, ajouter une langue revient à ajouter un répertoire et des lignes de dictionnaire.

### Les bibliothèques importées (Atelier)

`importe libX`, sans guillemets, charge `docs/lib/libX/`. Avec des guillemets, `importe "outils"` est l'import d'un programme du projet. Une bibliothèque contient :
- `libX.lisp` : écrit directement en LispE, sans passer par le transpileur ;
- `libX.js` : ses services `Pyt.*` ;
- `lib.json` : `lisp`, `js`, `files`, `vendor`, et la `description` en fr, en et ko. `files_if` (facultatif) associe un dossier de `files` à un mot : une application exportée n'emporte ce dossier que si son programme écrit ce mot entre guillemets. libworld s'en sert pour ses jeux de personnages lourds (`"models/characters-people/": "people"`).

Elle se déclare dans `docs/lib/index.json`. `docs/lib/libtest/` est le modèle minimal.

Pièges :
- `setq` au premier niveau d'une bibliothèque reste local : utiliser `setg` ;
- les rappels vers LispE passent par `Pyt.libraryCall`.

**Les calculs hors de la boucle d'image (workers).** JavaScript n'a qu'un fil : un long calcul dans un service `Pyt.*` fige l'image. Un calcul qui ne dessine pas peut tourner dans un Web Worker, sans rappel LispE : le worker reçoit le **nom d'une variable et son type**, et quand il a fini, le fil principal pose la valeur dans cette variable avec les primitives `callSetq…` de `lispe_functions.js`. Le programme relit la variable dans sa fonction d'animation.
- `Pyt.calcule(script, variable, type, données, transferts)` (`canevas.js`) lance le worker `script` (un par script) et lui envoie `{ variable, type, données }` ; le worker répond `postMessage({ variable, type, valeurs })`. Les workers sont arrêtés par `Pyt.réinitialise` et `Pyt.stoppeTout` : une réponse en retard n'atteint jamais l'exécution suivante.
- `Atelier.poseVariable(nom, type, valeur)` (`atelier.js`, et `appli.js` pour les applications exportées) appelle `callSetqInts`, `callSetqFloats`, `callSetqStrings`, `callSetqInt`, `callSetqFloat` ou `callSetqString` ; types : `integers`, `floats`, `strings`, `integer`, `float`, `string`. Seuls passent les nombres, les textes et leurs listes typées : une structure est mise à plat.
- `Pyt.écouteCalcul(variable, f)` : un module JavaScript reçoit la valeur à la place de LispE (le moteur du combat : `combat.js` demande à `perception.js` les lignes de vue sous le nom `combat.vus`).
- Une fonction de bibliothèque qui a une forme worker est un **double** nommé `…_asworker`, à côté de la fonction ordinaire, qui ne change pas : `w.find_path_asworker(de, vers, "chemin")` (worker `lib/libworld/chemins.js` ; sa recherche de chemin est une copie de celle de `libworld.js` : garder les deux semblables). La variable est donnée par son **nom, entre guillemets** : une macro de bibliothèque n'est pas connue quand le programme est compilé. La variable doit déjà exister (`chemin = Rien`).
- Une liste typée vide vaut `Rien` dans le langage : un double ne rend jamais une liste vide pour dire « rien » (`find_path_asworker` rend le départ seul).
- Un script de worker est listé dans `files` de `lib.json`, sinon une application exportée ne l'aura pas.
- `eval_setq_strings_lispe` (`lispe/wasm/mainwasm.cxx`) et `callSetqStrings` ont été ajoutés pour cela (2026-11-13) : chaque chaîne est envoyée comme sa longueur suivie de ses caractères.

Les bibliothèques existantes : `libworld` (mondes, maisons, personnages), `libsound` (son spatialisé), `librobot` (MuJoCo) et `libtest`.

**Les jeux de personnages de libworld** se déclarent dans `docs/lib/libworld/characters.json` : dossier, modèles, taille, hauteur de la voix, main (`hand`, ou `hands` par modèle), style (`"style": "toon"` : libworld ajoute l'ombrage et le trait du manga au chargement) et l'animation de chaque pose. **Le combat à la première personne** est `docs/lib/libworld/combat.js`, installé par `libworld.js` (`installeCombat`) avec ses propres outils : les habitants (`Habitants` : `marche`, `stoppe`, `joue`, `voit`, `poste`…), les crochets `Crochets` (la visite appelle `Crochets.visite()` pour les touches, le clic, la molette et chaque image ; la boucle des habitants appelle `Crochets.image`) et le chargeur de modèles. Un combattant est un personnage qui a `p.c` (camp, santé, armes, ordre) ; `pense(p)` exécute ses rares ordres toutes les 0,3 s. Le jeu `frontier` (soldats et guerriers de 1757) est fabriqué par `fabrique_soldats.py`, qui importe `fabrique_gens.py` : un costume d'époque est une copie d'une région du corps, gonflée, colorée face par face (`habit`), plus des maillages liés à un os (`pièce` : tricorne, crête, plumes) ; il ajoute les animations du combat (Run, Aim, Fire, Reload, Strike, Stab, Draw, Die, Crouch). `fabrique_frontiere.py` fabrique les armes (`models/weapons/`, pointées vers -Y dans Blender) et le décor de la frontière (`models/frontier/`, leur emprise dans `frontier.json` : une boîte tournée dans la grille des chemins, `o.boîte`). Le jeu lui-même, « Le fort », est dans `matériels_sources/the_fort/` de l'Atelier (un dossier par langue, quatre programmes) ; `python3 matériels_sources/assemble.py` construit les archives des Matériels et leur `index.json`. Les arbres `oak_tree`, `birch_tree`, `maple_tree`, `blossom_tree`, `pine_tree` et `bush` sont fabriqués par `fabrique_arbres.py` (un squelette de branches dont Skin fait du bois, une écorce cuite, des cartes de feuilles dessinées avec numpy, dont la couleur des sommets garde la souplesse). **Le vent** (`w.set_wind`) vit dans le module `Vent` de `libworld.js` : des uniformes partagés par les shaders des arbres et du pré (`Vent.plie`, une fois le modèle chargé), une poussée sur les ressorts des cheveux et des jupes (`Vent.poussée`), et `wind()` dans le lien vivant, dont librobot fait la traînée des objets (leur vitesse par rapport à l'air) et l'`opt.wind` des scènes qui règlent leur air (le drone). Les rochers et les pierres sont fabriqués aussi, par `fabrique_rochers.py` (Blender, tout procédural : une version fine cuit sa couleur, ses normales et son occlusion sur une version légère ; `rocks.json` donne les tailles) : les rochers sont du décor (`DÉCOR`, plusieurs variantes choisies d'après la place), les pierres des objets d'`objets.js` dessinés par un modèle (`modèles`), avec un ellipsoïde pour la physique (matière `stone`). **Une fonction de l'élève qui porte le nom d'une méthode d'une bibliothèque** (`def pick_up(…)`) est renommée `pick_up_user` partout par `renomme_réservés`, même dans `c.pick_up(o)` : le programme boucle sans fin (un appel terminal, donc pas de débordement de pile) et la page se fige ; c'est l'affaire du transpileur, signalée à l'auteur. Les jeux `people` et `manga` sont **fabriqués, pas téléchargés** : `fabrique_gens.py`, à la racine de l'Atelier, pilote Blender et son extension MPFB (MakeHuman) sans fenêtre : `/Applications/Blender.app/Contents/MacOS/Blender -b -P fabrique_gens.py -- [noms] [--manga] [--json]`. Il lui faut les paquets CC0 de MakeHuman installés dans la bibliothèque de MPFB (une copie est gardée dans `~/Downloads/makehuman_packs`, car le site de MakeHuman a annoncé la fin de ses services). Le catalogue (`GENS`), les descriptions en trois langues (`DESCRIPTIONS`, écrites dans `people.json`, lues par `c.appearance()`) et les animations (faites à la main, os par os) sont toutes dans ce script. `--json` ne réécrit que `people.json`. Les cheveux longs et les habits de `HABITS_SOUPLES` sont marqués `souple` (extras du glTF) ; libworld leur donne un ressort amorti (`SOUPLES`, `prépareSouplesse`, `bougeSouples` dans `libworld.js`) : un poids par sommet, ajouté après le squelette dans le shader. Après un changement, regarder le résultat dans three.js, jamais seulement dans Blender : les matériaux et les poses n'y sont pas les mêmes.

**Les bibliothèques se parlent par le format de scène, jamais directement** (`docs/lib/FORMAT_SCENE.md`) : libworld écrit la scène (`build_world`) et inscrit un lien vivant (`Pyt.sceneLink("libworld")` : `position`, `heading`, `state`, `version`) ; libsound et librobot la lisent sans connaître libworld. librobot (`new_robot(nom, scène, x, y, direction)`, `physique.js` : `xmlMonde`, `installeMonde`, `suisMonde`) change les murs en boîtes du groupe 3 (la collision seule), et les battants des portes et les personnages en **corps menés** (mocap), déplacés avant chaque pas : MuJoCo ne tient pas compte d'un changement de `contype`/`conaffinity` après la compilation ; le robot garde son repère, le monde y est ramené (`repèreMonde`), et il ne dessine que lui-même, dans un groupe ajouté à la scène de libworld (sans fond, lumière ni OrbitControls à lui). libworld offre `w.find_path` (`Habitants.cheminPour`) pour qu'un robot suive un chemin. Les objets de libworld sont des corps libres de MuJoCo (`entities[].physics`, tiré de `physiqueObjet` dans `libworld/objets.js` : forme, taille, masse réelle, matière) ; `suisObjets` décide qui mène chacun (posé : MuJoCo, qui le rend par `lien.place` ; porté, `objectState` "held" : libworld). Dans l'autre sens, librobot inscrit son propre lien vivant, `"librobot"` (`actif`, `obstacles`, `gère`, `kick`) : libworld marque l'emprise du robot sur sa grille et ses personnages s'en écartent. Le battant d'une porte ouverte se tient à angle droit du mur (`open_leaf` de la scène, `battantOuvert` dans libworld) : libworld l'ajoute à `plan.murs` (à partir de 30 cm du mur, pour ne pas rétrécir le passage), et librobot donne à chaque porte un second corps mené pour lui, rangé loin quand la porte est fermée, ou quand il s'ouvrirait sur le robot. `r.range_scan(n, portée)` (`P.balaye`) lance `mj_ray` depuis le corps racine du robot et saute ses propres géoms ; le numéro du géom touché revient dans un `mj.IntBuffer`, parce qu'un tableau de JavaScript passé en sortie est copié et reste à 0 ; ce qui est touché est nommé par `monde.étiquettes` ("wall.<id>", "door.<id>", "obstacle.<genre>"). Tests : `tests/librobot/test_librobot.mjs "monde"`.

## 3. Les règles de l'auteur

1. **Le cœur du langage d'abord.** `basic.grm`, `transpiler.lisp`, `compiler.lisp` et LispE (C++, WASM) appartiennent au cœur du langage. Avant d'y toucher :
   - décrire le changement en quelques lignes, avec un exemple d'entrée et de sortie ;
   - **attendre son accord** ;
   - faire une modification à la fois, annoncée.

   Il travaille souvent en parallèle sur ces fichiers et corrige parfois lui-même. L'interface (JS, exemples, documentation, bibliothèque) peut se faire directement.
2. **Un bogue de LispE se signale, il ne se corrige pas** (section 4.8).
3. **Les exemples existants sont intouchables.** On montre une nouveauté par de nouveaux exemples, numérotés à la suite et déclarés dans l'`index.json` du répertoire, sauf demande explicite de l'auteur.
4. **La terminologie de la Pythonerie est française, et on n'y touche pas.** On n'ajoute pas `pop`, `startswith` ou `keys` à son `français.lisp`. Elle écrit `ramène_élément`, `retire_élément`, `commence_par`, `clés@`. Dans l'Atelier aussi, les fichiers de `link` sont les choix de l'auteur : on n'en réécrit pas les noms.
5. **L'orthographe française est complète partout** : noms du langage, identifiants JS, Python et CSS, fichiers, textes, avec les accents (`bibliothèque.lisp`, `étatSauvegarde`, `btnExécuter`, `chaîne`). Pas de tolérance sans accents.
6. **Dans l'Atelier, le JS est neutre** (section 2). Un texte affiché par le JS passe par `T('… {0} …', x)`, avec ses traductions English et Korean dans `traductions.lisp`.
7. **Rien n'attend de façon synchrone.** Une fonction qui attend l'utilisateur, un fichier ou le réseau prend une fonction de rappel, `f(valeur)` ou `f(valeur, a)`, et passe par la file des attentes (`Pyt.attends` dans `canevas.js`, `_attend` / `_réponse_lue` dans `bibliothèque.lisp`). Jamais de `window.prompt`, de relance du programme ni de rejeu d'événement.
8. **Pas de `global`.** Dans une fonction, `x =: v` affecte la variable du programme (le transpileur produit `setg`), et `x += v` modifie la variable du programme si la fonction n'a pas de `x` local.
9. **Ce qui plante les IA se rend valable** quand c'est raisonnable, plutôt que d'allonger la liste des interdits. Ça a été fait pour le ternaire, `key=`, `reverse=`, `l.sort()`, `lambda x: …`, `(a, b)` et `print(sep=, end=)`. Une forme refusée doit donner un **message clair** dans la langue :
   - en anglais, il commence par `Error:` ;
   - en français, par `Erreur` ;
   - en coréen, par `Error:` : l'Atelier ne reconnaît pas les messages qui commencent par 오류.
10. **On commite seulement sur demande.**
11. **`python3 version.py` après chaque modification**, dans chaque projet touché. Il change les `?v=` qui forcent le rechargement des fichiers. Dans l'Atelier, il recopie aussi les guides de l'IA vers `docs/<Langue>/`, et il signale un `basic_opt.lisp` absent ou périmé.

## 4. LispE : ce qu'il faut savoir

### 4.1 Sources, documentation, binaires

- **Les sources** sont dans `/Users/clauderoux/Documents/GitHub/lispe/` (dépôt public `https://github.com/naver/lispe`). Le C++ est dans `src/` et `include/`, le WASM dans `wasm/` (`mainwasm.cxx`, `evaljs.cxx`). `wasm_update.sh` copie `lispe.wasm`, `lispe.js` et `lispe_functions.js` dans `PREDIBAG/lispe/`, `Pythonerie/docs/lispe/` et `Atelier-of-the-Apps/docs/lispe/`. **L'auteur recompile d'habitude LispE lui-même ; ne changer son C++ que s'il le demande.**
- **Recompiler LispE** (quand l'auteur demande une correction). `lispe/objs/`, `lispe/wasm/objs/`, `bin/lispe` et `wasm/lispe.wasm` peuvent appartenir à root (compilés avec `sudo`) : on compile alors dans le scratchpad. En natif : copier `objs/*.o`, recompiler le fichier changé avec les options de `Makefile` et `Makefile.in` (`clang++ -fPIC -std=c++17 -w -c -Ofast -DAPPLE -DPOSIXREGEX -x objective-c++ -DUNIX -Iinclude src/x.cxx`), faire l'édition de liens comme la règle `lispe` du `Makefile`, et tester avec ce binaire (`PATH=<rép>:$PATH python3 non_regression.py` le prend). En WASM : la même chose avec `em++` et les options de `wasm/Makefile` (`-std=c++11 -c -w -msimd128 -DAPPLE -DPOSIXREGEX -DUNIX -O3 … -DLISPE_WASM -I../include`), liée en `lispe.html` ; puis copier `lispe.wasm` et `lispe.js` vers les trois destinations de `wasm_update.sh`. Avant de distribuer : les exemples natifs de `lispe/examples` et les deux bancs avec le nouveau binaire, et le `banc.js` de l'Atelier (`.claude/skills/ajouter-une-langue/scripts/`) avec le nouveau WASM. Dire à l'auteur quels fichiers de root gardent l'ancienne version.
- **La documentation** est dans `lispe/documents/`, et sur le wiki `https://github.com/naver/lispe/wiki` (index des fonctions, description du langage). Fichiers utiles :
  - `language_help.md` : le formalisme ;
  - `functions.md` : la référence des fonctions ;
  - `lispe_vs_python.md` ;
  - `defpat.md` ;
  - `data.md` ;
  - `classes.md` (`class@`, `setqi`) ;
  - `strings.md` ;
  - `pattern.md`.
- **Le binaire natif** est `/usr/local/bin/lispe` : `lispe fichier.lisp arg1 arg2…`, avec les arguments dans `_args`, où `(@ _args 0)` est le nom du script. Il sert à tous les essais rapides. La variable `_version` donne la version.
- **Pour savoir si une primitive existe**, regarder `(atoms)`, chercher dans `functions.md`, ou essayer dans `lispe`. **Cherche toujours une primitive avant d'écrire du LispE maison** : l'auteur a déjà signalé `deaccentuate`, `andvalue`, `mapcar`, `tokenize_full`…

### 4.2 Le LispE produit par le transpileur

Ce programme anglais :

```python
score = 0
d = {"x": 1}
def add(n):
    score =: score + n
    return score
class Ball:
    def __init__(self, x):
        self.x = x
    def step(self, dx):
        self.x += dx
b = Ball(3)
b.step(2)
for i in range(3):
    if i == 1:
        continue
    else:
        add(i)
while score < 10:
    score += 1
try:
    v = int("z")
except:
    v = -1
s = f"score {score}"
squares = [x * x for x in range(4)]
print(s, d["x"], squares)
```

devient, à peu de chose près :

```lisp
(setq score 0)
(setq d (dictionary "x" 1))
(defun add (n) (setg score (p+ score n)) (return score))
(class@ Ball_ (init)
   (defun __init__ (x) (setqi x x))
   (defun step_ (dx) (+= x dx)))
(defun Ball (x) (Ball_ (__init__ x)))
(defpat step ([Ball_ r] dx) (r (step_ dx)))      ; une méthode = un defpat sur le type de l'objet
(setq b (Ball 3))
(step b 2)                                      ; a.f(x) devient (f a x)
(loop i (range 3) (if (= i 1) (continue) (add i)))
(while (< score 10) (+= score 1))
(maybe (setq v (int "z")) (setq v -1))          ; try/except
(setq s (+ "score " (_texte score)))
(setq squares (mapcar (λ (x) (* x x)) (range 4)))
(println (_texte s) (_texte (at d "x")) (_texte squares))
```

Ce qu'il faut en retenir :
- `+` de Python devient `p+` : il concatène les listes et les textes. Le `+` de LispE additionne élément par élément.
- `l[i]` devient `(at l i)`, et `l[a:b]` devient `(@@ l a b)`.
- Les variables globales s'affectent par `setg`.
- `print` devient `println`, avec chaque argument passé par `_texte`.
- Une méthode est un `defpat` sur le type. **Le nom d'une méthode est donc une fonction globale** : `def move(self…)` entre en conflit avec la fonction `move` de la bibliothèque (« Wrong number of arguments in call to move »).
- Les attributs d'un objet ne se lisent que dans ses méthodes : `b.x` hors de la classe est une erreur de syntaxe.
- **Un nom réservé** est renommé `nom_var` ou `nom_user`, ou refusé. La liste est dans la section `pièges` / `pitfalls` du YAML, point 13.

**Pour voir ce que produit le transpileur**, utiliser le banc :

```bash
printf '%s\t%s\n' "$PWD/prog.pye" "$PWD/prog.lisp" > liste.txt
lispe tests/banc.lisp traduis docs/English/basic/ basic_opt.lisp english.lisp liste.txt && cat prog.lisp
lispe tests/banc.lisp exécute docs/English/basic/ basic_opt.lisp english.lisp prog.pye   # traduit et exécute
# Atelier français : docs/French/basic/ … français.lisp ; coréen : docs/Korean/basic/ … english.lisp
# Pythonerie : lispe tests/banc.lisp exécute docs/basic/ basic_opt.lisp français.lisp prog.pyf
```

### 4.3 Écrire des fonctions de bibliothèque en LispE

- **Définir** : `(defun nom (a b) …)`.
  - Paramètre facultatif : `(defun f (a (b 10)) …)`. Avec `(b ())`, la valeur par défaut est la liste vide.
  - `(defun f (a $ reste))` **ne marche pas**.
  - Plusieurs arités, ou un choix selon le type : `defpat`, par exemple `(defpat f ((integer_ n)) …)` ou `(defpat f ([Ball_ r] x) …)`. Il faut au moins un argument par clause.
  - Les macros s'écrivent avec `defmacro`.
- **LispE refuse de redéfinir une fonction** (« Function 'x' already declared »). Avant de choisir un nom, vérifier qu'il n'est ni une primitive, ni un nom de la bibliothèque, ni un mot-clef. Noms déjà pris, vus en pratique :
  - `set`, `range`, `push`, `size`, `floor`, `take`, `drop`, `use`, `switch`, `throw`, `check`, `label`, `middle`, `command`, `bodies`, `copie` ;
  - `drop` (un mot-clef de LispE : le transpileur ne le renomme pas, l'erreur vient au chargement) ;
  - les mots-clefs français `attrape`, `sauf` et `essaie` (try) : une fonction nommée `essaie` donne une erreur de syntaxe qui pointe sur sa ligne `fonction` ;
  - en libworld, `camera`, `home` et `where`.

  Un paramètre facultatif qui porte le nom d'une fonction (comme `width`) se préfixe avec `_`.
- **Une fonction à effet rend `nil`**, comme `None`.
- **Appeler le navigateur** : `(evaljsc (list "Pyt.service" a b))`. Le code est compilé une fois et gardé en cache, les nombres passent en doubles, et une liste de nombres passe en `Float64Array`. `asyncjsc` sert à l'asynchrone. **Ne pas utiliser `evaljs`**, qui réévalue chaque argument : il faudrait passer les listes imbriquées en JSON. La réponse JSON se lit avec `json_parse`, qui n'accepte qu'une liste ou un dictionnaire : la réponse est donc emballée dans `{"value": …}`.
- **Les variables** : `setq` est local à la fonction, `setg` est global.
- **Les objets** se créent avec `class@` et `setqi`, et se lisent comme dans `classes.md`.

### 4.4 Primitives fréquentes

- Listes : `list`, `cons`, `consb`, `push`, `pop`, `popvalue` (rend l'élément), `insert`, `nconc`, `nconcn`.
- Accès : `@` / `at`, `@@` (tranche ; `(@@ s a)` va jusqu'à la fin), `size`, `reverse`, `sort` (prend un comparateur, par exemple `(sort '< l)`, ou une fonction utilisateur citée, et trie sur place).
- Parcours : `mapcar` (rend toujours des objets), `maplist` (peut typer : des `nil` deviennent des `0`), `filterlist`, et les fonctions à la Haskell (`map`, `filter`, `take`, `scanl`, `foldl`…), qui se fusionnent en une seule boucle.
- Contrôle : `loop`, `while`, `if`, `ife` (avec un bloc else), `cond`, `check`, `ncheck`, `block`, `maybe` (récupère une erreur), `catch`, `return`, `break`, `continue`.
- Dictionnaires : `dictionary`, `{"a":1}`, `keys@`, `values@`, `key@` (rend `nil` si la clé manque), `in`.
- Textes : `string`, `trim`, `split`, `join`, `left`, `right`, `replace`, `deaccentuate`, `startwith`, `endwith`, `digitp`, `alphap`.
- Nombres : `integer`, `number` (64 bits), `float` (**32 bits** : éviter), `radian`, `degree`, `atan2`.
- Lecture de code : `prettify` (réimprime du LispE), `(eval (+ "(quote " texte ")"))`, `tokenize`, `tokenize_full`.

### 4.5 Pièges de LispE

- **Les booléens** : `and`, `or` et `check` rendent un booléen, pas la valeur. Pour obtenir la valeur, utiliser `andvalue` et `orvalue`.
- **Les listes vides** : `not` appliqué à une liste agit élément par élément, donc on teste une liste vide avec `nullp`.
- **`(in dico x)` cherche parmi les VALEURS.** Pour les clés : `(in (keys@ d) x)` ou `(key@ d x)`.
- **`return` est un mot-clef.** Une fonction qui rend l'atome `return` l'exécute (« cannot evaluate this instruction: 'return' »). Pour réécrire un arbre de code, ne parcourir que les sous-listes (`check (consp e)`) et reconstruire avec `loop` et `push`, sans faire passer l'atome seul par une fonction.
- **Une primitive ne se passe pas comme valeur** (`size`) : l'envelopper, `(lambda (_x) (size _x))`.
- **`(sort l)` avec un seul argument échoue au chargement.** `<` ne compare pas des listes.
- **L'affichage** : `print` colle ses arguments, `println` les sépare par des espaces. Un fichier lancé par `lispe` affiche la valeur de sa dernière expression : finir par `(print "")` pour l'éviter.
- **Les chaînes** :
  - `fread` rend une chaîne d'octets ;
  - `eq` compare les identités et `=` les contenus, donc `(eq (@ texte 0) "(")` est faux ;
  - `(string (fread f))` convertit le texte.
- **Le tokenizer** :
  - toujours ajouter `"\n"` à un texte avant de le découper avec `tokenize` ;
  - `%)` est lu comme un seul jeton, donc il faut écrire `'(7 % )`.
- **Le modulo des réels** (corrigé le 2026-11-09, LispE natif et WASM) : `%` garde les décimales (`fmod`), `_%` (le `%` de l'Atelier) suit Python (`-29.5 % 90` vaut `60.5`) ; sur les entiers, rien ne change.
- **`range` donne au plus 100 000 valeurs** (« Exceeding range », natif et WASM). Depuis le 2026-11-11, le transpileur (`_vers_irange`, dans la règle `forin` et dans les compréhensions) traduit `pour i dans intervalle(…)` et `[… pour i dans intervalle(…)]` en `(irange début fin pas)`, un itérateur sans limite qui ne construit pas de liste ; seule une liste gardée (`l = intervalle(n)`, `len(intervalle(n))`) passe encore par `range`. `irange` refuse un pas nul (« increment cannot be 0 »). `erreurs.js` traduit « Exceeding range » en une phrase pour l'élève.
- **Listes typées** (`integers`, `numbers`, `strings` ; en français `liste_entiers`, `liste_nombres`, `liste_chaînes`) : 4 à 20 fois plus rapides que `list` pour `in`, `sum`, les tranches et `+`, et encore typées après `sort`, une tranche ou `+`. Elles convertissent ce qu'on y range, sans erreur (`2.7` devient `2`, un texte devient `0` dans une `integers`). Le transpileur produit `(list …)` pour tout littéral et `mapcar` rend une `list_` ; `range` et `split` rendent déjà des listes typées.
- **`sort`** (corrigé le 2026-11-10 dans `lists.cxx`, partition de Hoare avec l'élément du milieu comme pivot) : avant, une liste déjà triée, inversée ou faite de valeurs égales prenait un temps quadratique, et épuisait la pile en WASM dès 20 000 éléments.
- **`[x pour x dans l si c][0]`** n'est pas lu comme un indice : la grammaire affecte la compréhension et fait de `[0]` une instruction à part (`(list 0)`). Passer par une variable ou une boucle (signalé à l'auteur le 2026-11-11).
- **`continue`** (corrigé le 2026-11-11 dans `elements.cxx`, `eval.cxx`, `straight_eval.cxx`) : les boucles d'`irange` et de la liste infinie l'ignoraient, et les corps de `block`, `check`, `ncheck`, `ife`, `maybe`, `cond`, `elapse` et `lock` continuaient après lui : un `si c:` ou un `essaie:` contenant un `continue` suivi d'autres instructions ne les sautait pas. `maybe` ne s'arrêtait pas non plus sur `return`. Une nouvelle forme de boucle ou de bloc doit s'arrêter sur `l_return` et sur `l_continue`.
- **Les chaînes f entre triples guillemets** (`f"""…{x}…"""`) ne sont pas interpolées : construire le texte avec `+` et `chaîne(…)` (un manque du langage, à proposer à l'auteur).
- **Un vrai saut de ligne** dans une chaîne du LispE *produit* casse la traduction. Passer `nil` et laisser la bibliothèque mettre `"\n"` : c'est ce que fait `_affiche_nommé`.
- **Les fichiers chargés** : un `load` fait dans une fonction garde les `setq` du fichier dans cette fonction. Charger au premier niveau.

### 4.6 Le WASM n'est pas le natif

- Un `while` s'arrête après **10 millions de tours** (« too many iterations in a while ») ; le natif n'a pas cette limite.
- Chaque `print` arrive comme une ligne complète.
- `throw` ou `maybe` pendant la *compilation* peuvent corrompre l'état de l'interpréteur.
- La pile d'appels est écrite sur la sortie standard.
- Ce qui touche ces comportements se teste **dans le navigateur** (section 7).

### 4.7 Les noms des instructions (`link`)

`(link "longueur" 'size)` donne un autre nom à une instruction LispE. Les fichiers `français.lisp` et `english.lisp` en contiennent une centaine. Dans l'Atelier français, les noms de Python s'ajoutent après le nom lisible quand l'instruction de LispE se comporte comme en Python (`pop` donne `popvalue`, `startswith` donne `startwith`). Ces fichiers sont **ceux de l'auteur** : proposer, ne pas modifier.

### 4.8 Signaler un bogue de LispE

1. Réduire le problème à un **petit `.lisp` autonome**, sans la bibliothèque de l'Atelier.
2. Le lancer avec `/usr/local/bin/lispe`, et dans le WASM si le comportement en dépend.
3. Donner à l'auteur :
   - le fichier ;
   - le résultat **attendu** ;
   - le résultat **obtenu** ;
   - si possible, la piste dans `lispe/src`.
4. Contourner au besoin du côté de l'Atelier, **en le disant**, et ne jamais corriger LispE soi-même.
5. Vérifier dans le code ou la documentation avant d'affirmer que c'est un bogue. `return`, `eq`/`=` et `in` sur un dictionnaire sont des comportements voulus.

## 5. Recettes

### 5.1 Ajouter une fonction de bibliothèque (le cas le plus courant)

1. **Lire** la section du YAML du domaine concerné, dans les trois langues. Choisir les noms :
   - français ;
   - anglais, que le coréen reprend aussi ;
   - pour la Pythonerie si elle est concernée, en français et avec sa terminologie.

   Vérifier qu'aucun n'est déjà pris (section 4.3).
2. **L'écrire dans chaque `bibliothèque.lisp`** : Atelier French, English, Korean, et la Pythonerie si elle est concernée. En coréen, le nom est anglais et les messages sont en coréen.
3. **Un service JS** se met dans `canevas.js`, sous un nom anglais dans l'Atelier et français dans la Pythonerie. Un moteur commun s'ajoute aux deux `canevas.js`, et une primitive de l'application aussi dans `appli/appli.js`. Les textes passent par `T()`, avec leurs traductions dans `traductions.lisp`.
4. **Une attente** (clic, réponse, fichier, réseau) passe par une fonction de rappel et la file `Pyt.attends`.
5. **Pour l'éditeur**, ajouter dans `mode-atelier.js` de chaque langue (ou `mode-pythonerie.js`) une entrée `'nom': 'nom(args) — description'`.
6. **Écrire les programmes de test** (section 6), puis la **documentation** (section 8).

### 5.2 Une méthode

`a.f(x)` devient `(f a x)` : une méthode existe dès que la fonction existe. Un cas particulier se règle dans la règle `callmethod` du transpileur, comme `l.sort()` qui devient `_trie_sur_place`. Attention : le nom d'une méthode de classe de l'utilisateur est une fonction globale (section 4.2).

### 5.3 Une tournure de syntaxe : grammaire et transpileur (avec l'accord de l'auteur)

Le travail se fait **sur une copie** du répertoire `basic/` (dans le scratchpad), et on ne recopie que quand tout passe.

**Les quatre grammaires** sont celles de l'Atelier (French, English, Korean) et de la Pythonerie. Elles ont la même structure, avec les mots-clefs de la langue (`si`/`sinon` ou `if`/`else`). Un changement se fait dans les quatre, sauf décision contraire.

**La notation de `basic.grm` :**
- `!règle :=` : garde l'étiquette et retire la ponctuation (`%(`, `%,`) ;
- `^règle :=` ou `a^b` : choix ordonné, le premier qui réussit gagne, sans étiquette ;
- `|` : la plus longue lecture gagne ;
- `&règle :=` : l'étiquette seulement s'il y a plus d'un élément. Elle garde le LispE identique quand la forme nouvelle est absente, comme pour `!&ternaire`.
- `$mot` : un mot-clef ;
- `%x` : une ponctuation ;
- `[…]?`, `[…]*`, `[…]+` : facultatif, répété ;
- `;N` : un point de coupure, qui donne le message d'erreur N.

Exemples réels : `!pylambda := [$lambda^$λ] variables? %: compareorcompute`, `!tuple := %( ternaire %, ternaire [%, ternaire]* %)`, `call := [lambda^parenlambda^Word] %( arguments? %) …`.

**Les étapes :**
1. Modifier `basic.grm`, puis `cd basic && lispe compiler.lisp`. On obtient `basic.lisp`.
2. Dans `transpiler.lisp`, ajouter `(defpat parsing (['règle a b]) …)` qui rend le LispE. Une passe sur tout l'arbre se met dans les **trois** points d'entrée : `compile`, `compilepython` et `compileconsole`.
3. **Les gardes de `optimise.lisp`** (`walrus`, `tojoin`, `alapython`, `call`, `method`, `interval`, table `heuristiques` en tête du fichier) sont écrites à la main d'après le premier jeton de chaque règle. Si une règle gardée peut maintenant commencer autrement, il faut **mettre à jour la garde** dans les quatre copies. Sinon, `basic_opt.lisp` refuse ce que `basic.lisp` accepte : c'est arrivé avec `(lambda x: …)(5)`.
4. Lancer `lispe optimise.lisp <basic>/ <programmes…>` avec, comme corpus, les exemples et les programmes des matériels de la langue, **plus les programmes de test** de la forme nouvelle. Il écrit `basic_opt.lisp` après avoir vérifié que les arbres sont identiques. S'ils diffèrent, il garde une copie de `basic.lisp`, et la version refusée part dans `basic_opt.essai.lisp`. En zsh, passer la liste des programmes par Python ou par un fichier.
5. Lancer la **non-régression** (section 6) dans les deux projets.

## 6. Les tests de non-régression (obligatoires)

Chaque projet a, à sa racine :

```bash
python3 non_regression.py                 # toutes les langues
python3 non_regression.py French          # une langue (Atelier : English, French, Korean)
python3 non_regression.py --accepte       # enregistre les résultats actuels comme références
```

**Quand le lancer : après TOUTE modification de**
- `basic.grm`, `basic.lisp` ou `basic_opt.lisp` ;
- `transpiler.lisp` ;
- `bibliothèque.lisp` ;
- `optimise.lisp` ;
- un fichier de noms.

Il doit finir sur « OK » dans **l'Atelier ET la Pythonerie** avant d'annoncer que c'est fini. Il dure quelques secondes et sort avec le code 1 en cas de faute.

**Ce qu'il vérifie, chaque fois avec `basic.lisp` ET avec `basic_opt.lisp`** (les deux doivent donner la même chose) :
1. **Les programmes de test** de `tests/formes/<Langue>/` (`.pye`, `.pyf`, `.pyk`) sont traduits puis **exécutés** dans LispE. Ce qu'ils affichent doit être exactement le fichier `.attendu` du même nom. Un programme refusé affiche son message d'erreur, ce qui permet de tester aussi les refus. Programmes actuels : tri, `print`/`affiche` avec `sep=`/`end=`, lambdas, tuples, ternaire, règles gardées de l'optimiseur, et deux refus (argument nommé ailleurs, tuple sans parenthèses).
2. **Les traductions** des exemples, des programmes des matériels (lus dans les zip) et des programmes de test sont comparées au LispE de référence de `tests/références/<Langue>/`.

Le banc (`tests/banc.lisp`) remplace `evaljsc` par un simple `print`. **Rien ne passe par le navigateur** : le canevas, les sons et la 3D ne sont pas exécutés, d'où la section 7.

**Méthode pour toute nouveauté ou correction :**
1. **Écrire d'abord le programme de test** qui montre la forme nouvelle, ou qui reproduit le bogue :
   - Atelier : `tests/formes/English/NN_nom.pye` ;
   - la même chose en `.pyk` dans `tests/formes/Korean/` : mêmes programmes, mais `.attendu` différents, car les messages d'erreur sont en coréen ;
   - `tests/formes/French/NN_nom.pyf` ;
   - Pythonerie : `tests/formes/Pythonerie/NN_nom.pyf`, **avec sa terminologie française** (`ramène_élément`, pas `pop`).

   On y met les usages ordinaires, les cas limites et au moins un refus attendu. Une forme qui touche une règle gardée de l'optimiseur doit y figurer. Les noms de variables du test ne doivent pas être des noms réservés (`size`, `label`, `middle`…).
2. Faire la modification.
3. `python3 non_regression.py --accepte`, puis **RELIRE chaque `.attendu` créé ou remplacé**. Quand le programme est du Python pur (en anglais), comparer avec `python3 fichier.pye` : les écarts admis sont les guillemets (`"` au lieu de `'`) et les tuples, qui s'affichent comme des listes.
4. Relancer **sans** `--accepte` : il doit dire « OK », dans les deux projets.

**Lire une faute :**
- « **basic.lisp et basic_opt.lisp ne donnent pas la même…** » : une garde de `optimise.lisp` est à revoir, ou l'optimiseur n'a pas été relancé.
- « **la traduction a changé** » (avec un extrait de diff) : le LispE d'un exemple a bougé. Ce n'est pas forcément une faute, si le transpileur a changé exprès. On lit le diff, et on n'accepte qu'en sachant pourquoi chaque ligne a changé.
- « **résultat différent** » : le comportement a changé. On corrige le code, pas le `.attendu`, sauf si l'ancien résultat était faux, et on le dit.
- « **pas de référence / pas de résultat attendu** » : un nouvel exemple ou un nouveau test. Faire `--accepte`, puis relire.

**Ne jamais faire `--accepte` à l'aveugle** : un `.attendu` accepté sans le relire fige le bogue.

**librobot a ses propres tests** : `node tests/librobot/test_librobot.mjs [nom]`, avec la vraie physique (`physique.js` et MuJoCo en WebAssembly, dans Node). Ils rejouent les exemples de référence (33, 34, 39, 40, 41, 43, 45 à 51) et vérifient ce qu'annonce leur commentaire d'en-tête : des taux de réussite sur 10 tirages à graine fixe (`GRAINE0=100` pour d'autres tirages), la physique comparée à la théorie (plan incliné, chute libre avec et sans air, période du pendule, rebonds des matières), le lacet de `reach`, le bruit des capteurs. Les choix de réalisme de librobot sont expliqués dans les commentaires de `physique.js` (cône de frottement, traînée de l'air calculée par librobot, table des rebonds, amortissement du contact changé selon la vitesse, roulement des boîtes) : mesurer de nouveau dans Node avant d'en changer un. Les lancer après toute modification de librobot (`physique.js`, `librobot.js`, `librobot.lisp`, `robots.json`, `fabrique_robots.py`) ou de ces exemples, et mettre le test à jour quand un exemple change : ce sont les mêmes étapes, écrites en JS. `DIAG=1` montre les échecs, `ANCIEN=1` compare avec l'ancien exemple 41, `ANCIEN_FROTTEMENT=1` avec l'ancien cône de frottement de MuJoCo.

**Pour ajouter une langue** : ajouter l'entrée dans `LANGUES` en tête de `non_regression.py` (répertoire basic, fichier de noms, exemples, matériels, extension), traduire les programmes dans `tests/formes/<Langue>/`, puis appliquer la méthode ci-dessus. La compétence `ajouter-une-langue` le rappelle.

## 7. Essayer dans le navigateur

Le banc ne suffit pas pour ce qui touche le canevas, les sons, la 3D, l'interface, les attentes ou les limites du WASM.

1. Lancer le serveur du projet (section 2).
2. Lancer Chrome sans tête :
   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
       --remote-debugging-port=9333 --user-data-dir=<profil neuf> --no-first-run about:blank
   ```
   - Un **profil neuf** évite le cache et le stockage d'un essai précédent. Le site a un service worker : après avoir changé un fichier, lancer `python3 version.py` et relancer Chrome avec un profil neuf, sinon la page garde l'ancien fichier (un exemple « changé » sur le disque exécute encore son ancien code). Un Chrome qui a servi à beaucoup d'essais peut aussi arrêter sa boucle d'animation (`requestAnimationFrame`) : si une simulation reste au temps 0, le relancer.
   - Pour WebGL : `--use-angle=swiftshader --enable-unsafe-swiftshader`.
3. Utiliser les scripts de l'Atelier, dans `.claude/skills/ajouter-une-langue/scripts/` :
   - `cdp.js` charge un programme dans la page et rend la console, les erreurs et le LispE ;
   - `banc.js` passe tous les exemples avec le vrai `lispe.wasm` et un canevas simulé, et vérifie que chaque service appelé existe dans `canevas.js`.
4. **Les exemples du mode d'emploi** (`<pre data-essai>`) s'exécutent dans la page : les lancer avant de rendre.

## 8. La documentation (obligatoire)

**Chaque fois qu'une instruction nouvelle est ajoutée, ou que son comportement change, elle doit être décrite dans les guides YAML de l'IA ET dans le mode d'emploi (`guide.html`), dans les trois langues : français, anglais, coréen.** Une instruction absente de la documentation n'existe ni pour les élèves, ni pour les IA.

1. **Les guides de l'IA de l'Atelier**, à la racine (jamais dans `docs/`) :
   - `POUR_CLAUDE.yaml`, `FOR_CLAUDE.yaml`, `CLAUDE용_안내.yaml` :
     - mettre l'instruction dans la sous-section de son domaine (section 1) ;
     - ajouter son message d'erreur exact dans `bugs_fréquents` / `common_bugs` ;
     - ajouter un piège dans `pièges` / `pitfalls` s'il y en a un ;
     - garder court le début, qui est toujours envoyé.
   - `POUR_CLAUDE.md`, `FOR_CLAUDE.md`, `CLAUDE용_안내.md` : la même chose, dans la version à lire.
   - Vérifier les YAML : `ruby -ryaml -e "YAML.load_file('POUR_CLAUDE.yaml')"`, pour chacun des trois.
   - Après `python3 version.py`, vérifier par `grep` que `docs/<Langue>/` contient bien le changement.
2. **Le guide de l'IA de la Pythonerie** : `POUR_CLAUDE.md` à la racine, si elle est concernée. Il n'y a pas de YAML.
3. **Le mode d'emploi** : `docs/French/guide.html`, `docs/English/guide.html`, `docs/Korean/guide.html`, et `Pythonerie/docs/guide.html` si elle est concernée. Pour chacun :
   - la section du sujet, et son entrée dans le sommaire (`nav.sommaire`) ;
   - la ligne du glossaire, « Tous les mots » (`table.glossaire`). Dans l'Atelier, les instructions d'une bibliothèque importée (`libworld`, `libsound`, `librobot`) vont dans le tableau de sa section **et** dans son thème du glossaire (`g-libworld`, `g-libsound`, `g-librobot`), qui reprend ce tableau. Pour trouver ce qui manque au glossaire, comparer les noms de ses `<code>` aux `defun`/`defpat` publics de `bibliothèque.lisp` et de chaque `docs/lib/<nom>/<nom>.lisp` ;
   - au moins un exemple `<pre data-essai>` **exécuté dans le navigateur**, avec son vrai résultat.
4. **L'éditeur** :
   - `mode-atelier.js` de chaque langue (ou `mode-pythonerie.js`) ;
   - la fenêtre ❓ Aide de l'Atelier (`docs/index.html`, l'aide-mémoire de l'éditeur) : une ligne dans sa section, et son sommaire. Ses textes sont en français et se traduisent par `traductions.lisp` (la clé est l'`innerHTML` de chaque cellule, blancs réduits ; le sommaire entier est une seule clé). Vérifier en anglais et en coréen qu'aucun mot français ne reste.
5. **Le reste :**
   - `docs/English/GLOSSARY.md` (correspondance du français vers l'anglais) ;
   - les textes d'interface dans `traductions.lisp` ;
   - un nouvel exemple numéroté à la suite pour une nouveauté importante, sans retoucher les anciens ;
   - les README (`README.md`, `README.fr.md`) pour une bibliothèque ou un grand ensemble.

## 9. Check-list finale

- [ ] Les sections concernées du YAML lues, et aucun nom en conflit.
- [ ] L'accord de l'auteur si le cœur du langage a bougé (grammaire, transpileur, LispE, fichiers de `link`).
- [ ] Les quatre `basic/` traités (Atelier fr, en, ko et Pythonerie), ou la décision de n'en changer qu'une partie, dite à l'auteur.
- [ ] `basic.lisp` régénéré et `optimise.lisp` relancé (gardes revues) dans chaque `basic/` touché.
- [ ] Les programmes de test écrits dans `tests/formes/` (English, Korean, French, Pythonerie), et chaque `.attendu` relu.
- [ ] `python3 non_regression.py` sur « OK » dans **l'Atelier et la Pythonerie**.
- [ ] Si librobot ou ses exemples ont bougé : `node tests/librobot/test_librobot.mjs` passe, et le test suit les exemples.
- [ ] Un essai dans le navigateur pour ce qui touche le canevas, les sons, la 3D, l'interface ou le WASM.
- [ ] Les guides de l'IA : les 3 YAML et les 3 MD à la racine de l'Atelier (YAML valides), le `POUR_CLAUDE.md` de la Pythonerie.
- [ ] Le mode d'emploi : les 3 `guide.html` (et celui de la Pythonerie), avec section, sommaire, glossaire et exemple exécuté.
- [ ] `mode-atelier.js` / `mode-pythonerie.js`, `traductions.lisp`, `GLOSSARY.md`.
- [ ] `python3 version.py` dans chaque projet touché.
- [ ] Les bogues de LispE rencontrés, signalés avec leur mini-programme.
- [ ] **Cette compétence mise à jour** si le travail a changé ce qu'elle décrit, et le changement reporté, traduit, dans la version de l'autre dépôt (aucun « ATTENTION » de `version.py`).
- [ ] Rien de commité sans demande.
