# La Pythonerie

Un espace pour apprendre à programmer **en français**, directement dans le navigateur.

👉 **[Ouvrir la Pythonerie](https://clauderouxster.github.io/Pythonerie/)**, sans rien installer.

La Pythonerie s'adresse aux enfants à partir de 7 ans, à leurs parents et à leurs enseignants. On y écrit des programmes dans un Python en français : `si`, `sinon`, `pour … dans`, `tantque`, `fonction`, `retourne`… Ce que l'on apprend ici sert ensuite directement en Python.

## L'écran

L'écran est découpé en trois zones :

1. **Mes programmes**, à gauche : les programmes de l'élève, que l'on peut ranger dans des répertoires, un répertoire **Matériels**, où l'enseignant dépose le matériel de cours (voir plus bas), et un répertoire **Exemples** qui contient des programmes à essayer.
2. **L'éditeur**, au milieu : on y écrit son programme, avec la coloration des mots, l'indentation automatique et des propositions pendant la frappe. En dessous, la **console** affiche les messages du programme, et la ligne **`>>>`** exécute tout de suite ce que l'on y tape.
3. **Le canevas**, à droite : une feuille de dessin où le programme peut dessiner, écrire, faire avancer une tortue, animer des formes, afficher des images, jouer des sons et réagir à la souris et au clavier.

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

- **Écrire et demander** : `affiche`, `écris`, `demande("Ton nom ?")`, `demande_nombre(...)`.
- **Calculer** : `aléatoire(1, 6)`, `arrondi`, `racine`, `somme`, `maximum`, `minimum`, `intervalle`…
- **Listes et textes** : `ajoute`, `longueur`, `trie`, `inverse`, `choisis`, `majuscules`, `découpe`, `remplace`, les listes en compréhension, les dictionnaires.
- **Dessiner** sur un canevas de 800 × 600 (ou de la taille choisie avec `canevas(largeur, hauteur)` ; `largeur()` et `hauteur()` donnent la taille actuelle), dont l'origine est en haut à gauche : `point`, `ligne`, `rectangle`, `carré`, `cercle`, `disque`, `ellipse`, `triangle`, `polygone` (avec leurs versions pleines), `fond`, `couleur`, `épaisseur`, `rgb(r, g, b)`, et `texte` avec `taille_texte` et `police`.
- **La tortue** : `avance`, `recule`, `gauche`, `droite`, `lève_crayon`, `baisse_crayon`, `va_à`, `oriente`, `origine`.
- **Animer et réagir** : `animer(fonction, délai)`, `quand_clic(f)`, `quand_souris(f)`, `quand_glisse(f)` (souris déplacée bouton appuyé, ou doigt sur une tablette), `quand_touche(f)`, `arrête()`.
- **Images et sons** : `img = charge_image(adresse)`, `place_image(img, x, y)`, `snd = charge_son(adresse)`, `joue_son(snd)`.
- **Fichiers** : `texte = charge_données(nom)` lit un fichier du répertoire **Matériels**, déposé par l'enseignant (voir plus bas). `texte = lit_fichier()`, sans argument, lit un fichier de l'ordinateur, y compris depuis la version en ligne. Un navigateur ne peut lire que les fichiers que l'utilisateur choisit lui-même : quand le programme arrive à `lit_fichier()`, une fenêtre de sélection s'ouvre, puis le programme repart depuis le début avec le contenu du fichier. Avec plusieurs `lit_fichier()`, les fichiers sont demandés l'un après l'autre et rendus dans l'ordre des appels. Ils sont redemandés à chaque exécution, pour toujours lire leur dernière version. Le contenu reste dans le navigateur, rien n'est envoyé. Avec un argument, `lit_fichier("https://…")` lit le texte d'une adresse Internet, si le site l'autorise ; l'adresse doit commencer par `https://`. `écrit_fichier(nom, texte)` enregistre le texte dans le dossier Téléchargements, ce qui fonctionne sur tous les ordinateurs et toutes les tablettes.
- **Les données du programme** : le bouton **▦ Données**, au-dessus de l'éditeur, remplace le programme par des onglets **Don0**, **Don1**, **Don2**… que l'on peut ajouter ou retirer ; le bouton devient alors **✎ Code**, pour revenir au programme. On y tape ou colle des données, ou on y charge un fichier de l'ordinateur (**📂 Charger un fichier…**). À l'exécution, chaque onglet non vide est ajouté au début du programme sous la forme `don0 = """…"""`, ou `'''…'''` si les données contiennent `"""` ; dans les rares cas où aucune des deux ne convient (les données contiennent `"""` et `'''`, finissent par un guillemet, contiennent un accent grave…), sous la forme `don0 = de_base64("…")`, qui transporte n'importe quel texte sans le modifier : le programme s'en sert par la variable `don0`, `don1`… Un onglet vide ne crée pas de variable. Les données sont enregistrées avec le programme, à la fin du fichier, dans une section de commentaires qui indique le nombre d'onglets et de lignes ; elles le suivent donc dans l'export `.py`, les archives et le répertoire Matériels, et retrouvent leurs onglets à la relecture :

  ```text
  #=== Données de la Pythonerie : 2 onglets ===
  #=== don0 : 2 lignes ===
  #|pays,capitale
  #|France,Paris
  #=== don1 : 0 ligne ===
  #=== Fin des données ===
  ```
- **Pour aller plus loin** : environ 180 instructions supplémentaires portant des noms français (`mélange`, `pgcd`, `commence_par`, `loi_normale`…), décrites dans le glossaire du mode d'emploi.

Quatorze exemples, du premier « Bonjour » jusqu'à un piano de trois octaves, en passant par la tortue, une balle qui rebondit, une courbe mathématique et un petit logiciel de dessin, se trouvent dans le répertoire **Exemples**. Un clic sur un exemple en crée une copie que l'on peut modifier.

## Les programmes de l'élève

- Les programmes sont conservés dans le navigateur de l'élève, que la Pythonerie soit ouverte en ligne ou depuis `serveur.py`.
- Par défaut, la Pythonerie est en mode **Utilisateur unique** : pas de connexion, l'utilisateur s'appelle « Unique » et le bouton **👤** est désactivé. Ce mode convient à un ordinateur personnel. Sur un ordinateur partagé, on décoche **Utilisateur unique** dans le menu ☰ : la Pythonerie passe en mode **plusieurs élèves**, et chacun doit taper son nom. Ce choix est gardé dans le navigateur. Un établissement peut aussi imposer le mode plusieurs élèves à tout le monde, dans le fichier `config.json` (voir plus bas).
- En mode plusieurs élèves, le bouton **👤** en haut de l'écran affiche le nom de l'élève (« inconnu » au départ). Il faut le taper pour exécuter du code. Il est oublié quand on ferme l'onglet, ce qui convient aux ordinateurs partagés. Un deuxième clic sur **👤** déconnecte l'élève : si ses programmes ont changé depuis sa dernière archive (ou s'il n'en a jamais créé), la Pythonerie lui propose d'en créer une. Ensuite, tout son espace est vidé : programmes, répertoires, sauvegarde temporaire et historique de la console.
- Pour partager un environnement, le menu ☰ propose de **créer une archive** : un fichier `nom_aaaa_mm_jj_hh_MM.json` qui contient tous les programmes et les répertoires, enregistré dans le dossier Téléchargements. Avec `serveur.py`, une copie est aussi conservée sur le serveur, pour l'enseignant (voir plus bas). **Charger une archive** remplace tous les programmes en cours par ceux de l'archive. En mode plusieurs élèves, si l'espace contenait déjà des programmes, l'élève est déconnecté (son nom sera redemandé à la prochaine exécution) ; si l'espace était vide, il reste connecté. S'il y avait des programmes, ils sont mis de côté, après confirmation : **Annuler le chargement** les fait revenir. Si l'espace était vide (ou ne contenait que le programme d'accueil), l'archive est chargée directement.
- On les range dans des répertoires et on les déplace en les faisant glisser. Au survol d'un programme, on peut le renommer, l'exporter dans un fichier `.py` ou le supprimer. Pour en supprimer plusieurs à la fois, on les choisit avec Cmd+clic ou Ctrl+clic (un par un) ou Maj+clic (une suite), puis on clique sur **Supprimer** dans le bandeau, ou on appuie sur la touche Suppr. Le menu ☰ permet aussi de copier un programme ou d'importer des fichiers `.py`.

## Pour les enseignants : le répertoire Matériels

Le répertoire `docs/matériels/` reçoit le matériel de cours destiné aux élèves. Il apparaît dans la colonne de gauche, sous le nom **Matériels**, au-dessus des **Exemples**, dès qu'il contient au moins un fichier décrit dans son `index.json`.

- **Des programmes** (`.py`) : comme pour un exemple, un clic de l'élève en crée une copie qu'il peut modifier. Un programme exporté avec ses onglets de données (bouton **▦ Données**) les garde : l'élève les retrouve dans ses onglets.
- **Des données** (textes, listes, fichiers `.csv`…) : un programme les lit avec `charge_données("capitales.csv")`, qui renvoie tout le texte du fichier. Un clic de l'élève sur un fichier de données affiche son explication et la ligne à écrire pour le lire. Le répertoire contient un petit exemple, `capitales.csv`, que l'on peut supprimer.

Après avoir ajouté, remplacé ou retiré des fichiers, l'enseignant lance le script `inventaire.py`, placé dans le répertoire :

```bash
cd docs/matériels
python3 inventaire.py            # demande un titre et une explication pour chaque nouveau fichier
python3 inventaire.py --revoir   # permet aussi de changer les explications existantes
```

Le script parcourt le répertoire et ses sous-répertoires, demande une explication pour chaque fichier qu'il ne connaît pas encore, retire de la liste les fichiers qui ont disparu, et écrit `index.json`. Le matériel est servi par le site lui-même, en ligne comme avec `serveur.py` : `charge_données` ne lit que ce répertoire, et jamais un autre site.

## Utiliser la Pythonerie sur sa machine

Pour travailler sans connexion, ou pour une salle de classe, on peut lancer la Pythonerie sur son ordinateur. Il suffit de Python 3, sans aucune autre installation :

```bash
git clone https://github.com/clauderouxster/Pythonerie.git
cd Pythonerie
python3 serveur.py          # ouvre http://localhost:8000
```

Le serveur ne fait que deux choses :

- il **fournit les fichiers** de la Pythonerie aux navigateurs ;
- il **garde une copie des archives** : chaque fois qu'un élève crée une archive, elle est téléchargée sur son poste, comme d'habitude, et une copie est enregistrée dans le répertoire `archives/` du serveur. L'enseignant dispose ainsi des archives de tous ses élèves en un même lieu.

Les programmes, eux, restent dans le navigateur de chaque élève, et le serveur n'exécute **aucun** programme : la traduction et l'exécution se passent toujours dans le navigateur, exactement comme avec la version en ligne.

Les archives du serveur ne peuvent être ni remplacées ni supprimées depuis la Pythonerie : deux archives du même nom sont gardées toutes les deux (`Léa_2026_10_08_14_30.json`, puis `Léa_2026_10_08_14_30_2.json`), et la liste des archives n'est jamais montrée aux élèves. Seul l'enseignant décide de ce qu'il en fait, directement dans le répertoire.

Options :
- `--port 8080` pour choisir un autre port ;
- `--hôte 0.0.0.0` pour que les élèves d'une salle de classe se connectent depuis leur poste ;
- `--archives /un/répertoire` pour ranger les archives ailleurs que dans `archives/` ;
- `--sans-navigateur` pour ne pas ouvrir de navigateur au lancement.

Le fichier `docs/config.json` contient les réglages de l'installation :

```json
{
    "multi_utilisateur": false
}
```

Avec `"multi_utilisateur": true`, la Pythonerie démarre en mode plusieurs élèves pour tout le monde : chaque élève doit taper son nom, et la case **Utilisateur unique** du menu ☰ est désactivée, si bien qu'on ne peut pas revenir au mode Utilisateur unique. De plus, chaque nouvelle session (nouvel onglet, navigateur relancé) commence avec un espace vide, même si l'élève précédent est parti sans se déconnecter ; un simple rechargement de la page garde le travail en cours. Les élèves doivent donc créer une archive avant de partir.

## Comment ça marche

Le programme de l'élève est traduit en **LispE**, le langage qui est réellement exécuté, directement dans le navigateur. Rien n'est envoyé à un serveur pour être exécuté, y compris quand on utilise `serveur.py`, qui ne reçoit que les copies des archives. Le bouton **λ LispE**, au-dessus de l'éditeur, montre le code LispE produit, pour les curieux.

## Protection des données (RGPD)

La Pythonerie est parfaitement compatible avec le **RGPD** européen et avec ses équivalents canadiens, la **LPRPDE** (loi fédérale) et la **Loi 25** du Québec, pour une raison simple : tout s'exécute dans le navigateur. Une fois la page chargée, rien ne transite par le réseau.

- **Aucune donnée n'est envoyée** : les programmes, le nom de l'élève et l'historique de la console restent dans le navigateur de l'ordinateur. Aucun serveur ne les reçoit, aucun compte n'est créé.
- **Aucun pistage** : ni cookie, ni mesure d'audience, ni publicité, ni service tiers. L'éditeur et les polices de caractères sont fournis par le site lui-même, sans appel à un autre site (pas de Google Fonts, pas de CDN).
- **Le nom de l'élève** n'est qu'une étiquette : il sert à nommer les archives. Il est oublié à la fermeture de l'onglet, et la déconnexion efface tout l'espace de l'élève. Chaque établissement peut d'ailleurs donner à ses élèves un identifiant propre, plutôt que leur vrai nom : c'est plus discret, et cela évite de confondre deux élèves qui portent le même nom.
- **Les archives** sont des fichiers enregistrés sur l'ordinateur, dans le dossier Téléchargements. En ligne, elles ne sont envoyées nulle part : c'est l'élève ou l'enseignant qui décide de les transmettre.

Deux remarques pour les établissements :

- Comme pour toute page web, l'hébergeur du site (GitHub Pages) voit passer l'adresse de l'ordinateur au moment où la page est téléchargée. Pour l'éviter, on peut lancer la Pythonerie sur une machine de l'établissement (voir [Utiliser la Pythonerie sur sa machine](#utiliser-la-pythonerie-sur-sa-machine)) : la seule donnée qui passe alors par le réseau, celui de l'établissement, est la copie des archives que reçoit cette machine, pour l'enseignant.
- Un programme qui charge une image, un son ou un fichier depuis une adresse `https://…` d'un autre site contacte ce site. Les exemples fournis n'utilisent que des fichiers de la Pythonerie.

## Limites connues

- Le programme s'exécute dans la page : une boucle sans fin (`tantque Vrai:` sans `sortir`) bloque l'onglet. Pour une animation, il faut utiliser `animer`.
- Les numéros de ligne des erreurs d'exécution renvoient au code LispE produit, et non au programme de l'élève.
- `Rien` s'affiche `[]`.
- Pour échanger deux valeurs, on écrit `a, b = b, a`, et non `[a, b] = [b, a]`.

## Licence

La Pythonerie est distribuée sous licence BSD 3 clauses : voir [LICENSE](LICENSE).
