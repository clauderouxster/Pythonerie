# La Pythonerie

Un espace pour apprendre à programmer **en français**, directement dans le navigateur.

👉 **[Ouvrir la Pythonerie](https://clauderouxster.github.io/Pythonerie/)**, sans rien installer.

La Pythonerie s'adresse aux enfants à partir de 7 ans, à leurs parents et à leurs enseignants. On y écrit des programmes dans un Python en français : `si`, `sinon`, `pour … dans`, `tantque`, `fonction`, `retourne`… Ce que l'on apprend ici sert ensuite directement en Python.

## L'écran

L'écran est découpé en trois zones :

1. **Mes programmes**, à gauche : les programmes de l'élève, que l'on peut ranger dans des répertoires, et un répertoire **Exemples** qui contient des programmes à essayer.
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
- **Dessiner** sur un canevas de 800 × 600, dont l'origine est en haut à gauche : `point`, `ligne`, `rectangle`, `carré`, `cercle`, `disque`, `ellipse`, `triangle`, `polygone` (avec leurs versions pleines), `fond`, `couleur`, `épaisseur`, `rgb(r, g, b)`, et `texte` avec `taille_texte` et `police`.
- **La tortue** : `avance`, `recule`, `gauche`, `droite`, `lève_crayon`, `baisse_crayon`, `va_à`, `oriente`, `origine`.
- **Animer et réagir** : `animer(fonction, délai)`, `quand_clic(f)`, `quand_souris(f)`, `quand_glisse(f)` (souris déplacée bouton appuyé, ou doigt sur une tablette), `quand_touche(f)`, `arrête()`.
- **Images et sons** : `img = charge_image(adresse)`, `place_image(img, x, y)`, `snd = charge_son(adresse)`, `joue_son(snd)`.
- **Pour aller plus loin** : environ 180 instructions supplémentaires portant des noms français (`mélange`, `pgcd`, `commence_par`, `loi_normale`…), décrites dans le glossaire du mode d'emploi.

Quatorze exemples, du premier « Bonjour » jusqu'à un piano de trois octaves, en passant par la tortue, une balle qui rebondit, une courbe mathématique et un petit logiciel de dessin, se trouvent dans le répertoire **Exemples**. Un clic sur un exemple en crée une copie que l'on peut modifier.

## Les programmes de l'élève

- En ligne, les programmes sont conservés dans le navigateur de l'élève.
- Par défaut, la Pythonerie est en mode **Utilisateur unique** : pas de connexion, l'utilisateur s'appelle « Unique » et le bouton **👤** est désactivé. Ce mode convient à un ordinateur personnel. Sur un ordinateur partagé, on décoche **Utilisateur unique** dans le menu ☰ : la Pythonerie passe en mode **plusieurs élèves**, et chacun doit taper son nom. Ce choix est gardé dans le navigateur.
- En mode plusieurs élèves, le bouton **👤** en haut de l'écran affiche le nom de l'élève (« inconnu » au départ). Il faut le taper pour exécuter du code. Il est oublié quand on ferme l'onglet, ce qui convient aux ordinateurs partagés. Un deuxième clic sur **👤** déconnecte l'élève : si ses programmes ont changé depuis sa dernière archive (ou s'il n'en a jamais créé), la Pythonerie lui propose d'en créer une. Ensuite, tout son espace est vidé : programmes, répertoires, sauvegarde temporaire et historique de la console.
- Pour partager un environnement, le menu ☰ propose de **créer une archive** : un fichier `nom_aaaa_mm_jj_hh_MM.json` qui contient tous les programmes et les répertoires, enregistré dans le dossier Téléchargements. **Charger une archive** remplace tous les programmes en cours par ceux de l'archive. En mode plusieurs élèves, si l'espace contenait déjà des programmes, l'élève est déconnecté (son nom sera redemandé à la prochaine exécution) ; si l'espace était vide, il reste connecté. S'il y avait des programmes, ils sont mis de côté, après confirmation : **Annuler le chargement** les fait revenir. Si l'espace était vide (ou ne contenait que le programme d'accueil), l'archive est chargée directement.
- On les range dans des répertoires et on les déplace en les faisant glisser. Au survol d'un programme, on peut le renommer, l'exporter dans un fichier `.py` ou le supprimer. Pour en supprimer plusieurs à la fois, on les choisit avec Cmd+clic ou Ctrl+clic (un par un) ou Maj+clic (une suite), puis on clique sur **Supprimer** dans le bandeau, ou on appuie sur la touche Suppr. Le menu ☰ permet aussi de copier un programme ou d'importer des fichiers `.py`.

## Utiliser la Pythonerie sur sa machine

Pour travailler sans connexion, ou pour une salle de classe, on peut lancer la Pythonerie sur son ordinateur. Il suffit de Python 3, sans aucune autre installation :

```bash
git clone https://github.com/clauderouxster/Pythonerie.git
cd Pythonerie
python3 serveur.py          # ouvre http://localhost:8000
```

Les programmes sont alors enregistrés sur le disque, dans le répertoire `programmes/`, un fichier `.py` par programme.

Options :
- `--port 8080` pour choisir un autre port ;
- `--hôte 0.0.0.0` pour que les élèves d'une salle de classe se connectent depuis leur poste ;
- `--sans-navigateur` pour ne pas ouvrir de navigateur au lancement.

## Comment ça marche

Le programme de l'élève est traduit en **LispE**, le langage qui est réellement exécuté, directement dans le navigateur. Rien n'est envoyé à un serveur. Le bouton **λ LispE**, au-dessus de l'éditeur, montre le code LispE produit, pour les curieux.

## Protection des données (RGPD)

La Pythonerie est parfaitement compatible avec le **RGPD** européen et avec ses équivalents canadiens, la **LPRPDE** (loi fédérale) et la **Loi 25** du Québec, pour une raison simple : tout s'exécute dans le navigateur. Une fois la page chargée, rien ne transite par le réseau.

- **Aucune donnée n'est envoyée** : les programmes, le nom de l'élève et l'historique de la console restent dans le navigateur de l'ordinateur. Aucun serveur ne les reçoit, aucun compte n'est créé.
- **Aucun pistage** : ni cookie, ni mesure d'audience, ni publicité, ni service tiers. L'éditeur et les polices de caractères sont fournis par le site lui-même, sans appel à un autre site (pas de Google Fonts, pas de CDN).
- **Le nom de l'élève** n'est qu'une étiquette : il sert à nommer les archives. Il est oublié à la fermeture de l'onglet, et la déconnexion efface tout l'espace de l'élève.
- **Les archives** sont des fichiers enregistrés sur l'ordinateur, dans le dossier Téléchargements. C'est l'élève ou l'enseignant qui décide de les transmettre.

Deux remarques pour les établissements :

- Comme pour toute page web, l'hébergeur du site (GitHub Pages) voit passer l'adresse de l'ordinateur au moment où la page est téléchargée. Pour l'éviter, on peut lancer la Pythonerie sur une machine de l'établissement (voir [Utiliser la Pythonerie sur sa machine](#utiliser-la-pythonerie-sur-sa-machine)) : les programmes sont alors enregistrés sur cette machine, et nulle part ailleurs.
- Un programme qui charge une image ou un son depuis une adresse `https://…` d'un autre site contacte ce site. Les exemples fournis n'utilisent que des fichiers de la Pythonerie.

## Limites connues

- Le programme s'exécute dans la page : une boucle sans fin (`tantque Vrai:` sans `sortir`) bloque l'onglet. Pour une animation, il faut utiliser `animer`.
- Les numéros de ligne des erreurs d'exécution renvoient au code LispE produit, et non au programme de l'élève.
- `Rien` s'affiche `[]`.
- Pour échanger deux valeurs, on écrit `a, b = b, a`, et non `[a, b] = [b, a]`.

## Licence

La Pythonerie est distribuée sous licence BSD 3 clauses : voir [LICENSE](LICENSE).
