# La Pythonerie

Un espace pour apprendre à programmer **en français**, directement dans le navigateur.

👉 **[Ouvrir la Pythonerie](https://clauderouxster.github.io/Pythonerie/)**, sans rien installer.

La Pythonerie s'adresse aux enfants à partir de 7 ans, à leurs parents et à leurs enseignants. On y écrit des programmes dans un Python en français : `si`, `sinon`, `pour … dans`, `tantque`, `fonction`, `retourne`… Ce que l'on apprend ici sert ensuite directement en Python.

🤖 **Pour Claude ou une autre IA** : le fichier [POUR_CLAUDE.md](POUR_CLAUDE.md) décrit le langage, la bibliothèque et les pièges à éviter, pour écrire des programmes qui fonctionnent dans la Pythonerie. Il suffit de donner à l'IA l'adresse de ce dépôt.

## L'écran

L'écran est découpé en trois zones :

1. **Le projet**, à gauche : son nom, les répertoires images, sons et données, les programmes de l'élève, que l'on peut ranger dans des répertoires, un répertoire **Matériels**, où l'enseignant dépose le matériel de cours (voir plus bas), et un répertoire **Exemples** qui contient des programmes à essayer.
2. **L'éditeur**, au milieu : on y écrit son programme, avec la coloration des mots, l'indentation automatique et des propositions pendant la frappe. En dessous, la **console** affiche les messages du programme, et la ligne **`>>>`** exécute tout de suite ce que l'on y tape.
3. **Le canevas**, à droite : une feuille de dessin où le programme peut dessiner, écrire, faire avancer une tortue, animer des formes, afficher des images, jouer des sons et réagir à la souris et au clavier. Le bouton **⛶ Plein écran** l'agrandit à tout l'écran, pour un jeu par exemple : une petite barre propose alors **■ Arrêter** (le programme) et **✕ Quitter le plein écran** ; la touche Échap ramène aussi à l'affichage normal.

Le bouton **📖 Mode d'emploi** ouvre un guide écrit pour les enfants, avec des exemples à copier, de petits défis et un glossaire de tous les mots du langage. Le bouton **❓ Aide** en donne un résumé.

## Le langage en bref

```python
# Les blocs se repèrent au décalage (4 espaces) ;
# la ligne qui ouvre un bloc se termine par « : »
fonction carré(x):
    retourne x * x

pour i dans intervalle(1, 6):
    si i % 2 == 0:
        affiche(i, "est pair, son carré vaut", carré(i))
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

| Python | La Pythonerie |
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
| `match / case` | `selon (x): / cas "a": …` |
| `print` | `affiche` (avec retour à la ligne), `écris` (sans) |
| `input` | `demande` (ou `lire`, `input`), `demande_nombre` |
| `", ".join(l)` | `", ".joindre(l)` |
| modifier une variable du programme dans une fonction | `x =: …` |

Quelques règles à connaître :

- Les mots du langage s'écrivent avec leur orthographe française : `épaisseur`, `carré`, `aléatoire`, `va_à`, `lève_crayon`, ainsi que les couleurs `"gris foncé"` et `"bleu clair"`.
- Les calculs donnent les mêmes résultats qu'en Python : `7 / 2` vaut `3.5`, `7 // 2` vaut `3`, `[1, 2] + [3]` vaut `[1, 2, 3]`.
- Dans une fonction, `x = …` crée une variable locale et `x =: …` modifie la variable du programme. `x += …` modifie aussi la variable du programme quand la fonction n'a pas sa propre variable `x`, ce qui simplifie les animations.
- Un élève peut appeler ses propres fonctions et variables comme il le veut, même `somme` ou `max`.

## Ce que l'on peut faire

- **Écrire et demander** : `affiche`, `écris`, `demande("Ton nom ?")`, `demande_nombre(...)`. Comme `input()` en Python, la question s'écrit dans la console et la ligne sous la console attend la réponse (Entrée pour répondre, Échap pour arrêter le programme) : aucune fenêtre ne bloque la page, si bien que les sons jouent et que la console s'affiche au fur et à mesure. Pour cela, le programme s'arrête à chaque question sans réponse, puis repart du début une fois la réponse donnée : les réponses déjà données sont rendues dans l'ordre, la partie déjà jouée est rejouée sans ses sons, et le hasard d'`aléatoire`, `hasard` et `choisis` refait les mêmes tirages, de sorte que les questions ne changent pas. Pendant une animation ou un clic, où l'on ne peut pas repartir du début, `demande` ouvre la fenêtre du navigateur.
- **Calculer** : `aléatoire(1, 6)`, `arrondi`, `racine`, `somme`, `maximum`, `minimum`, `intervalle`…
- **Listes et textes** : `ajoute`, `longueur`, `trie`, `inverse`, `choisis`, `majuscules`, `découpe`, `remplace`, les listes en compréhension, les dictionnaires.
- **Dessiner** sur un canevas de 800 × 600 (ou de la taille choisie avec `canevas(largeur, hauteur)` ; `largeur()` et `hauteur()` donnent la taille actuelle), dont l'origine est en haut à gauche : `point`, `ligne`, `rectangle`, `carré`, `cercle`, `disque`, `ellipse`, `triangle`, `polygone` (avec leurs versions pleines), `fond`, `couleur` (avec des noms français, et leurs nuances `"rouge foncé"`, `"bleu clair"`…), `épaisseur`, `rgb(r, g, b)`, et `texte` avec `taille_texte` et `police`.
- **La tortue** : `avance`, `recule`, `gauche`, `droite`, `lève_crayon`, `baisse_crayon`, `va_à`, `oriente`, `origine`.
- **Des objets dans le canevas** : `bouton(clef, x, y, texte, f)`, `case_à_cocher(clef, x, y, texte, f)`, `bouton_radio(clef, groupe, x, y, texte, f)`, `glissière(clef, x, y, mini, maxi, valeur, f)`, `liste_déroulante(clef, x, y, éléments, f)`, `liste_hiérarchique(clef, x, y, lignes, arbre, f)` et `zone_édition(clef, x, y, lignes, f)`, en plus du champ `saisie`. Chacun appelle `f` quand on s'en sert, toujours avec deux valeurs (`f(clef, texte)` pour un bouton, `f(clef, valeur)` pour les autres, `f(groupe, clef)` pour un bouton radio), prend la police et la taille du texte du moment, et suit l'agrandissement du canevas ; `valeur_objet(clef)` lit sa valeur et `change_objet(clef, valeur)` la change.
- **Animer et réagir** : `animer(fonction, délai)`, `quand_clic(f)`, `quand_souris(f)`, `quand_glisse(f)` (souris déplacée bouton appuyé, ou doigt sur une tablette), `saisie(clef, x, y, f)` (un champ de saisie posé dans le canevas ; Entrée, ou un clic dans un autre champ, appelle `f(clef, valeur)`, la valeur étant un texte, que `nombre(valeur)` convertit en nombre à virgule, avec une virgule ou un point ; `active_saisie(clef)` donne la main à un champ, `saisie_active()` dit lequel l'a, `largeur_saisie(l)` règle la largeur des champs suivants, qui prennent aussi la police et la taille du texte du moment), `touche_enfoncée(nom)` (Vrai tant que la touche est tenue : la bonne façon de déplacer un objet en douceur, dans la fonction d'`animer`), `quand_relâche(f)` (au relâchement d'une touche), `quand_touche(f)` (la fonction reçoit le nom français de la touche : `"gauche"`, `"droite"`, `"haut"`, `"bas"`, `"espace"`, `"entrée"`, `"échap"`…, ou la lettre, comme `"a"`), `arrête()`.
- **Images et sons** : `img = charge_image(nom)`, `place_image(img, x, y)`, `snd = charge_son(nom)`, `joue_son(snd)`. Un simple nom (`"chat.png"`, `"miaou.wav"`) désigne un fichier des répertoires **images** ou **sons** du projet ; une adresse avec un `/` désigne un fichier du site (`exemples/médias/ding.wav`), et une adresse complète, un autre site (`https://…`).
- **Le projet** : `importe "outils"` (ou `importe "jeux/outils"`) rend disponibles les fonctions et les variables d'un autre programme du projet (voir plus bas).
- **Fichiers** : `texte = charge_données(nom)` lit un fichier du répertoire **données** du projet (`charge_données("capitales.csv")`). `texte = lit_fichier()`, sans argument, lit un fichier de l'ordinateur, y compris depuis la version en ligne. Un navigateur ne peut lire que les fichiers que l'utilisateur choisit lui-même : quand le programme arrive à `lit_fichier()`, une fenêtre de sélection s'ouvre, puis le programme repart depuis le début avec le contenu du fichier. Avec plusieurs `lit_fichier()`, les fichiers sont demandés l'un après l'autre et rendus dans l'ordre des appels. Ils sont redemandés à chaque exécution, pour toujours lire leur dernière version. Le contenu reste dans le navigateur, rien n'est envoyé. Avec un argument, `lit_fichier("https://…")` lit le texte d'une adresse Internet, si le site l'autorise ; l'adresse doit commencer par `https://`. `écrit_fichier(nom, texte)` enregistre le texte dans le dossier Téléchargements, ce qui fonctionne sur tous les ordinateurs et toutes les tablettes.
- **Les données du projet** : le bouton **▦ Données**, au-dessus de l'éditeur, remplace le programme par des onglets **Don0**, **Don1**, **Don2**… que l'on ajoute avec **＋** et que l'on retire avec **−** (l'onglet **Don0** est toujours là : **−** le vide seulement) ; **↶** annule les retraits, les vidages et les remplacements par un fichier. Le bouton devient alors **✎ Code**, pour revenir au programme. On y tape ou colle des données, ou on y charge un fichier de l'ordinateur (**📂 Charger un fichier…**). À l'exécution, chaque onglet non vide est ajouté au début du programme sous la forme `don0 = """…"""`, ou `'''…'''` si les données contiennent `"""` ; dans les rares cas où aucune des deux ne convient (les données contiennent `"""` et `'''`, finissent par un guillemet, contiennent un accent grave…), sous la forme `don0 = de_base64("…")`, qui transporte n'importe quel texte sans le modifier : le programme s'en sert par la variable `don0`, `don1`… Un onglet vide ne crée pas de variable. Un programme peut aussi écrire dans un onglet avec `range_données("don1", valeur)` (une liste ou un nombre y est écrit comme `affiche` l'écrirait) ; il peut créer l'onglet qui vient juste après le dernier (`don3` après `don0` à `don2`), mais pas plus loin. `prend_données("don1")` renvoie le texte actuel d'un onglet, y compris ce qu'un `range_données` vient d'y écrire. Les onglets appartiennent au **projet**, pas à un programme : tous les programmes du projet, et ceux qu'ils importent, voient les mêmes `don0`, `don1`… Ils sont enregistrés dans le navigateur avec le projet, et rangés dans le projet exporté (`onglets/don0.txt`, `onglets/don1.txt`…).
- **Pour aller plus loin** : environ 180 instructions supplémentaires portant des noms français (`mélange`, `pgcd`, `commence_par`, `loi_normale`…), décrites dans le glossaire du mode d'emploi.

Vingt exemples, du premier « Bonjour » jusqu'à un piano de trois octaves, quatre jeux (un casse-briques, le serpent, les envahisseurs de l'espace et astéroïdes), un mini tableur et un atelier de formes qui réunit tous les objets du canevas, en passant par la tortue, une balle qui rebondit, une courbe mathématique et un petit logiciel de dessin, se trouvent dans le répertoire **Exemples**. Un clic sur un exemple en crée une copie que l'on peut modifier ; si cette copie existe déjà (un programme du même nom, dans n'importe quel répertoire), elle est simplement ouverte, sans doublon. Pour repartir de l'exemple d'origine, on renomme ou on supprime sa copie.

## Le projet de l'élève

Les programmes de l'élève forment un **projet**. Ce peut être une collection de programmes indépendants, ou un ensemble de programmes qui se servent les uns des autres.

- **Le nom du projet** est affiché en haut de la liste des programmes : « Sans Nom » au départ, en gris. Un clic dessus, ou **Renommer le projet** dans le menu ☰, le change, y compris pour un projet chargé depuis Matériels. **Nouveau projet** (menu ☰) demande un nom et commence un projet vide ; le projet en cours est mis de côté (après confirmation s'il n'était pas vide), et **Annuler le chargement du projet** le fait revenir.

- **Les programmes** se rangent dans des répertoires et se déplacent en les faisant glisser. Au survol d'un programme, on peut le renommer, l'exporter dans un fichier `.pyf` (pour « Python francisé » : l'extension évite de confondre un programme de la Pythonerie avec un programme Python) ou le supprimer. Pour en supprimer plusieurs à la fois, on les choisit avec Cmd+clic ou Ctrl+clic (un par un) ou Maj+clic (une suite), puis on clique sur **Supprimer** dans le bandeau, ou on appuie sur la touche Suppr. Le menu ☰ permet aussi de copier un programme ou d'importer des fichiers (un programme `.pyf`, ou `.py` s'il a été écrit ailleurs).
- **`importe "outils"`**, sur une ligne à part, rend disponibles dans un programme les fonctions et les variables du programme « outils » du projet. Le chemin peut désigner un sous-répertoire : `importe "jeux/outils"`. Le programme est cherché à partir du répertoire du programme qui importe, puis à la racine du projet. Un programme importé plusieurs fois ne l'est qu'une fois, des programmes qui s'importent en boucle donnent une erreur, et une erreur dans un programme importé est signalée avec son nom (« ligne 2 de « outils » »).
- **Trois répertoires fixes**, en haut de l'arbre, reçoivent les fichiers du projet : **images** (png, jpg, gif, svg, webp), **sons** (wav, mp3, ogg) et **données** (txt, csv, tsv, json, md). On y fait glisser des fichiers depuis l'ordinateur, ou on utilise le bouton **＋** du répertoire ; un fichier glissé ailleurs dans l'arbre va dans le répertoire qui lui correspond. Un clic sur un fichier montre l'image, joue le son ou affiche le début des données. Dans le code, on désigne un fichier par son seul nom : `charge_image("chat.png")`, `charge_son("miaou.wav")`, `charge_données("notes.csv")`. Un fichier fait au plus 5 Mo.
- **Où tout est rangé** : les programmes dans le `localStorage` du navigateur, les fichiers du projet dans **IndexedDB**, une autre réserve du navigateur, qui accepte des fichiers bien plus gros. Rien ne quitte l'ordinateur, que la Pythonerie soit ouverte en ligne ou depuis `serveur.py`.
- **Exporter le projet** (menu ☰) crée un fichier `nom_du_projet_aaaa_mm_jj_hh_MM.zip` en mode Utilisateur unique, `nom_du_projet_élève_aaaa_mm_jj_hh_MM.zip` en mode plusieurs élèves (les espaces deviennent des `_`) ; un projet « Sans Nom » reçoit d'abord un nom, que l'on demande à l'élève. Le fichier, enregistré dans le dossier Téléchargements, contient tout le projet, sous forme de fichiers ordinaires que l'on peut ouvrir en décompressant l'archive :

  ```text
  projet.json                 {"format": "projet-pythonerie", "version": 3, "nom": "Mon jardin", "élève": "Léa", "créé": "…"}
  programmes/Quiz.pyf         les programmes, dans leurs répertoires
  programmes/jeux/outils.pyf
  onglets/don0.txt            les onglets de données (bouton ▦ Données)
  images/  sons/  données/    les fichiers du projet
  ```

  Les images et les sons gardent leur format : un projet zippé est bien plus léger qu'un fichier texte qui les recoderait.
- **Un projet en JSON** : un projet peut aussi être écrit d'un seul bloc de texte, en JSON. C'est la forme que Claude (ou une autre IA) sait produire dans une conversation : l'élève le colle avec **📋 Coller un projet (JSON)…** (menu ☰), ou le charge depuis un fichier `.json` ; un enseignant peut le déposer dans Matériels. Les programmes, les onglets, les données et les images SVG y sont écrits en texte ; une autre image ou un son est donné en base64, ou par une adresse `https://` que la Pythonerie télécharge au chargement, si le site le permet. Le format est décrit dans [POUR_CLAUDE.md](POUR_CLAUDE.md). L'export, lui, se fait toujours en `.zip`. Avec `serveur.py`, une copie est aussi conservée sur le serveur, pour l'enseignant (voir plus bas).
- **Charger un projet** remplace tout le projet en cours par celui du fichier `.zip` ou `.json` (on peut aussi le faire glisser dans la liste des programmes). Une archive dont tout le contenu est dans un dossier (un dossier compressé par le Finder ou l'Explorateur) est acceptée ; les fichiers qui ne vont dans aucun répertoire du projet sont laissés de côté, et la console les nomme. Si le projet en cours n'était pas vide, il est mis de côté, après confirmation : **Annuler le chargement du projet** le fait revenir ; en mode plusieurs élèves, l'élève est aussi déconnecté (son nom sera redemandé à la prochaine exécution). Si le projet en cours était vide, le projet est chargé directement.
- Par défaut, la Pythonerie est en mode **Utilisateur unique** : pas de connexion, l'utilisateur s'appelle « Unique » et le bouton **👤** est désactivé. Ce mode convient à un ordinateur personnel. Sur un ordinateur partagé, on décoche **Utilisateur unique** dans le menu ☰ : la Pythonerie passe en mode **plusieurs élèves**, et chacun doit taper son nom. Ce choix est gardé dans le navigateur. Un établissement peut aussi imposer le mode plusieurs élèves à tout le monde, dans le fichier `config.json` (voir plus bas).
- En mode plusieurs élèves, le bouton **👤** en haut de l'écran affiche le nom de l'élève (« inconnu » au départ). Il faut le taper pour exécuter du code. Il est oublié quand on ferme l'onglet, ce qui convient aux ordinateurs partagés. Un deuxième clic sur **👤** déconnecte l'élève : si son projet a changé depuis son dernier export (ou s'il ne l'a jamais exporté), la Pythonerie lui propose de l'exporter. Ensuite, tout son espace est vidé : programmes, répertoires, onglets de données, fichiers du projet, sauvegarde temporaire et historique de la console.

## Pour les enseignants : le répertoire Matériels

Le répertoire `docs/matériels/` reçoit le matériel de cours destiné aux élèves. Il apparaît dans la colonne de gauche, sous le nom **Matériels**, au-dessus des **Exemples**, dès qu'il contient au moins un fichier décrit dans son `index.json`.

- **Des projets** (`.zip`, ou `.json` pour un projet écrit en JSON, par exemple par Claude) : un projet exporté depuis la Pythonerie (menu ☰, **Exporter le projet**), avec ses programmes, ses onglets de données et les fichiers de ses répertoires images, sons et données. On peut aussi en préparer un à la main : un dossier qui contient `projet.json` (`{"format": "projet-pythonerie", "version": 3, "nom": "Mon projet"}`), `programmes/*.pyf` et au besoin `onglets/`, `images/`, `sons/`, `données/`, que l'on compresse en `.zip`. Un clic de l'élève le charge dans son espace, avec son nom (que l'élève peut changer), à la place de son projet en cours (qu'il peut récupérer avec **Annuler le chargement du projet**) : c'est la façon de lui donner un point de départ complet, plutôt que des fichiers épars. Le répertoire contient un exemple, `quiz_des_capitales.zip` : deux programmes (« Quiz » importe « outils »), un fichier de données et deux sons.
- **Des programmes** (`.pyf`) : comme pour un exemple, un clic de l'élève en crée une copie qu'il peut modifier, ou ouvre sa copie s'il l'a déjà.

Après avoir ajouté, remplacé ou retiré des fichiers, l'enseignant lance le script `inventaire.py`, placé dans le répertoire :

```bash
cd docs/matériels
python3 inventaire.py            # demande un titre et une explication pour chaque nouveau fichier
python3 inventaire.py --revoir   # permet aussi de changer les explications existantes
```

Le script parcourt le répertoire et ses sous-répertoires, demande une explication pour chaque projet ou programme qu'il ne connaît pas encore, retire de la liste les fichiers qui ont disparu, et écrit `index.json`. Les autres fichiers sont ignorés : des données, des images ou des sons se placent dans un projet. Le matériel est servi par le site lui-même, en ligne comme avec `serveur.py`.

## Utiliser la Pythonerie sur sa machine

Pour travailler sans connexion, ou pour une salle de classe, on peut lancer la Pythonerie sur son ordinateur. Il suffit de Python 3, sans aucune autre installation :

```bash
git clone https://github.com/clauderouxster/Pythonerie.git
cd Pythonerie
python3 serveur.py          # ouvre http://localhost:8000
```

Le serveur ne fait que deux choses :

- il **fournit les fichiers** de la Pythonerie aux navigateurs ;
- il **garde une copie des projets** : chaque fois qu'un élève exporte son projet, celui-ci est téléchargé sur son poste, comme d'habitude, et une copie est enregistrée dans le répertoire `projets/` du serveur. L'enseignant dispose ainsi des projets de tous ses élèves en un même lieu.

Les projets en cours, eux, restent dans le navigateur de chaque élève, et le serveur n'exécute **aucun** programme : la traduction et l'exécution se passent toujours dans le navigateur, exactement comme avec la version en ligne.

Les projets du serveur ne peuvent être ni remplacés ni supprimés depuis la Pythonerie : deux projets du même nom sont gardés tous les deux (`Mon_jardin_Léa_2026_10_08_14_30.zip`, puis `Mon_jardin_Léa_2026_10_08_14_30_2.zip`), et la liste des projets n'est jamais montrée aux élèves. Un projet peut peser jusqu'à 100 Mo. Seul l'enseignant décide de ce qu'il en fait, directement dans le répertoire.

Options :
- `--port 8080` pour choisir un autre port ;
- `--hôte 0.0.0.0` pour que les élèves d'une salle de classe se connectent depuis leur poste ;
- `--projets /un/répertoire` pour ranger les projets ailleurs que dans `projets/` ;
- `--sans-navigateur` pour ne pas ouvrir de navigateur au lancement.

Le fichier `docs/config.json` contient les réglages de l'installation :

```json
{
    "multi_utilisateur": false
}
```

Avec `"multi_utilisateur": true`, la Pythonerie démarre en mode plusieurs élèves pour tout le monde : chaque élève doit taper son nom, et la case **Utilisateur unique** du menu ☰ est désactivée, si bien qu'on ne peut pas revenir au mode Utilisateur unique. De plus, chaque nouvelle session (nouvel onglet, navigateur relancé) commence avec un espace vide, même si l'élève précédent est parti sans se déconnecter ; un simple rechargement de la page garde le travail en cours. Les élèves doivent donc exporter leur projet avant de partir.

## Comment ça marche

Le programme de l'élève est traduit en **LispE**, le langage qui est réellement exécuté, directement dans le navigateur. Rien n'est envoyé à un serveur pour être exécuté, y compris quand on utilise `serveur.py`, qui ne reçoit que les copies des projets exportés. Le bouton **λ LispE**, au-dessus de l'éditeur, montre le code LispE produit, pour les curieux.

## Protection des données (RGPD)

La Pythonerie est parfaitement compatible avec le **RGPD** européen et avec ses équivalents canadiens, la **LPRPDE** (loi fédérale) et la **Loi 25** du Québec, pour une raison simple : tout s'exécute dans le navigateur. Une fois la page chargée, rien ne transite par le réseau.

- **Aucune donnée n'est envoyée** : les programmes, les images, les sons et les données du projet, le nom de l'élève et l'historique de la console restent dans le navigateur de l'ordinateur. Aucun serveur ne les reçoit, aucun compte n'est créé.
- **Aucun pistage** : ni cookie, ni mesure d'audience, ni publicité, ni service tiers. L'éditeur et les polices de caractères sont fournis par le site lui-même, sans appel à un autre site (pas de Google Fonts, pas de CDN).
- **Le nom de l'élève** n'est qu'une étiquette : il sert à nommer les projets exportés. Il est oublié à la fermeture de l'onglet, et la déconnexion efface tout l'espace de l'élève. Chaque établissement peut d'ailleurs donner à ses élèves un identifiant propre, plutôt que leur vrai nom : c'est plus discret, et cela évite de confondre deux élèves qui portent le même nom.
- **Les projets exportés** sont des fichiers enregistrés sur l'ordinateur, dans le dossier Téléchargements. En ligne, ils ne sont envoyés nulle part : c'est l'élève ou l'enseignant qui décide de les transmettre.
- **Les photos** : une photo d'un élève, placée dans le répertoire images d'un projet, est une donnée personnelle. Elle reste dans le navigateur comme le reste du projet, mais elle part avec le projet quand on l'exporte : à garder en tête avant de partager un projet.

Deux remarques pour les établissements :

- Comme pour toute page web, l'hébergeur du site (GitHub Pages) voit passer l'adresse de l'ordinateur au moment où la page est téléchargée. Pour l'éviter, on peut lancer la Pythonerie sur une machine de l'établissement (voir [Utiliser la Pythonerie sur sa machine](#utiliser-la-pythonerie-sur-sa-machine)) : la seule donnée qui passe alors par le réseau, celui de l'établissement, est la copie des projets exportés que reçoit cette machine, pour l'enseignant.
- Un programme qui charge une image, un son ou un fichier depuis une adresse `https://…` d'un autre site contacte ce site. Les exemples fournis n'utilisent que des fichiers de la Pythonerie.

## Limites connues

- Le programme s'exécute dans la page : une boucle sans fin (`tantque Vrai:` sans `sortir`) bloque l'onglet. Pour une animation, il faut utiliser `animer`.
- Les numéros de ligne des erreurs d'exécution renvoient au code LispE produit, et non au programme de l'élève.
- `Rien` s'affiche `[]`.
- Pour échanger deux valeurs, on écrit `a, b = b, a`, et non `[a, b] = [b, a]`.

## Licence

La Pythonerie est distribuée sous licence BSD 3 clauses : voir [LICENSE](LICENSE).
