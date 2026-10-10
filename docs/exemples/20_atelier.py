# 20. L'atelier de formes
# Le panneau de gauche réunit tous les objets qu'on peut poser dans le canevas :
# un champ de saisie, une liste déroulante, une glissière, une liste hiérarchique,
# des cases à cocher, des boutons radio, des boutons et une zone d'édition.
# Choisis une forme, une taille et une couleur, puis clique dans le dessin.

canevas(1000, 640)
cache_tortue()

PANNEAU = 260         # la largeur du panneau de commandes
FORMES = ["disque", "carré", "triangle", "étoile"]
COULEURS = [["Chaudes", ["rouge", "rouge clair", "orange", "jaune", "rose"]],
            ["Froides", ["bleu", "bleu clair", "bleu marine", "vert", "turquoise", "violet"]],
            ["Neutres", ["noir", "gris", "gris clair", "marron", "blanc"]]]

# Ce que l'on a choisi dans le panneau
forme_actuelle = "disque"
couleur_actuelle = "rouge"
taille_actuelle = 30
mode = "poser"        # un clic dans le dessin pose ou efface une forme
contour = Faux
grille = Faux
titre = ""
légende = ""
dessin = []           # chaque forme posée : [x, y, forme, couleur, taille]

# --- Le dessin ---

fonction trace(f, x, y, c, t, plein):
    couleur(c)
    si f == "disque":
        si plein:
            disque(x, y, t)
        sinon:
            cercle(x, y, t)
    sinonsi f == "carré":
        si plein:
            carré_plein(x - t, y - t, 2 * t)
        sinon:
            carré(x - t, y - t, 2 * t)
    sinonsi f == "triangle":
        si plein:
            triangle_plein(x, y - t, x - t, y + t, x + t, y + t)
        sinon:
            triangle(x, y - t, x - t, y + t, x + t, y + t)
    sinon:
        # une étoile à cinq branches : dix points, un sur deux plus près du centre
        points = []
        pour i dans intervalle(10):
            r = t
            si i % 2 == 1:
                r = t / 2
            angle = i * 36 - 90
            points.ajoute([x + r * cosinus(angle), y + r * sinus(angle)])
        si plein:
            polygone_plein(points)
        sinon:
            polygone(points)

fonction dessine():
    # le panneau, avec le nom de chaque réglage
    fond("blanc")
    couleur("gris clair")
    rectangle_plein(0, 0, PANNEAU, hauteur())
    couleur("noir")
    taille_texte(15)
    texte(12, 10, "Titre du dessin")
    texte(12, 66, "Forme")
    texte(12, 120, f"Taille : {taille_actuelle}")
    texte(12, 170, f"Couleur : {couleur_actuelle}")
    texte(12, 392, "Un clic dans le dessin :")
    texte(12, 550, "Légende")
    # la feuille de dessin, à droite
    si grille:
        couleur("gris clair")
        épaisseur(1)
        pour gx dans intervalle(PANNEAU + 20, largeur(), 40):
            ligne(gx, 0, gx, hauteur())
        pour gy dans intervalle(0, hauteur(), 40):
            ligne(PANNEAU, gy, largeur(), gy)
    pour f dans dessin:
        trace(f[2], f[0], f[1], f[3], f[4], Vrai)
        si contour:
            épaisseur(2)
            trace(f[2], f[0], f[1], "noir", f[4], Faux)
    couleur("bleu marine")
    taille_texte(28)
    texte(PANNEAU + 20, 14, titre)
    taille_texte(18)
    texte(PANNEAU + 20, hauteur() - 80, légende)
    taille_texte(15)
    couleur("gris")
    texte(largeur() - 130, hauteur() - 24, f"{longueur(dessin)} formes")

# --- Ce que font les objets du panneau ---

fonction titre_changé(clef, valeur):
    titre =: valeur
    dessine()

fonction forme_choisie(clef, valeur):
    forme_actuelle =: valeur

fonction taille_changée(clef, valeur):
    taille_actuelle =: valeur
    dessine()

# chemin vaut ["Chaudes"] pour un groupe, ["Chaudes", "orange"] pour une couleur
fonction couleur_choisie(clef, chemin):
    si longueur(chemin) == 2:
        couleur_actuelle =: chemin[1]
        dessine()

fonction option(clef, cochée):
    si clef == "contour":
        contour =: cochée
    sinon:
        grille =: cochée
    dessine()

fonction mode_choisi(groupe, clef):
    mode =: clef

fonction légende_changée(clef, valeur):
    légende =: valeur
    dessine()

# toutes les couleurs de la liste hiérarchique, à plat
fonction toutes_les_couleurs():
    liste = []
    pour groupe dans COULEURS:
        pour c dans groupe[1]:
            liste.ajoute(c)
    retourne liste

fonction action(clef, texte):
    si clef == "hasard":
        # valeur_objet lit la glissière : les formes au hasard ne dépassent pas la taille choisie
        plus_grande = valeur_objet("taille")
        pour i dans intervalle(10):
            x = aléatoire(PANNEAU + 40, largeur() - 40)
            y = aléatoire(60, hauteur() - 100)
            dessin.ajoute([x, y, choisis(FORMES), choisis(toutes_les_couleurs()), aléatoire(10, plus_grande)])
    sinonsi clef == "annuler":
        si longueur(dessin) > 0:
            dessin =: dessin[0:longueur(dessin) - 1]
    sinonsi clef == "vider":
        dessin =: []
    sinonsi clef == "recommencer":
        recommence()
    dessine()

# change_objet remet chaque objet du panneau dans son état de départ
fonction recommence():
    dessin =: []
    titre =: ""
    légende =: ""
    forme_actuelle =: "disque"
    couleur_actuelle =: "rouge"
    taille_actuelle =: 30
    contour =: Faux
    grille =: Faux
    mode =: "poser"
    change_objet("titre", "")
    change_objet("forme", "disque")
    change_objet("taille", 30)
    change_objet("couleurs", ["Chaudes", "rouge"])
    change_objet("contour", Faux)
    change_objet("grille", Faux)
    change_objet("poser", Vrai)
    change_objet("légende", "")

# Un clic dans le dessin pose une forme, ou efface la plus proche
fonction clic(x, y):
    si x < PANNEAU:
        retourne Rien
    si mode == "poser":
        dessin.ajoute([x, y, forme_actuelle, couleur_actuelle, taille_actuelle])
    sinon:
        plus_proche = -1
        distance = 100000
        pour i dans intervalle(longueur(dessin)):
            f = dessin[i]
            d = (f[0] - x) * (f[0] - x) + (f[1] - y) * (f[1] - y)
            si d < distance et d < f[4] * f[4]:
                distance = d
                plus_proche = i
        si plus_proche >= 0:
            dessin =: [dessin[i] pour i dans intervalle(longueur(dessin)) si i != plus_proche]
    dessine()

# --- On pose les objets du panneau ---
# ils prennent la police et la taille du texte du moment

taille_texte(15)
largeur_saisie(PANNEAU - 24)
saisie("titre", 12, 28, titre_changé)
liste_déroulante("forme", 12, 84, FORMES, forme_choisie)
glissière("taille", 12, 140, 10, 80, 30, taille_changée)
liste_hiérarchique("couleurs", 12, 190, 6, COULEURS, couleur_choisie)
case_à_cocher("contour", 12, 334, "Contour noir", option)
case_à_cocher("grille", 12, 360, "Afficher la grille", option)
bouton_radio("poser", "clic", 12, 412, "pose une forme", mode_choisi)
bouton_radio("effacer", "clic", 12, 436, "efface une forme", mode_choisi)
bouton("hasard", 12, 470, "Au hasard", action)
bouton("annuler", 130, 470, "Annuler", action)
bouton("vider", 12, 508, "Tout effacer", action)
bouton("recommencer", 130, 508, "Recommencer", action)
zone_édition("légende", 12, 568, 2, légende_changée)

recommence()
dessine()
quand_clic(clic)
