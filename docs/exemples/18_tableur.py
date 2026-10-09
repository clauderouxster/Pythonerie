# 18. Un mini tableur
# Tape un nombre dans une case, puis Entrée : le total de la colonne se met à jour.
# Les flèches passent d'une case à l'autre, Entrée descend d'une case.
# « 2,5 » et « 2.5 » marchent tous les deux ; une case vide compte pour 0.

LETTRES = ["A", "B", "C", "D", "E"]
LIGNES = 8
LARGEUR_CASE = 120
HAUTEUR_CASE = 36
GAUCHE = 100          # le bord gauche de la colonne A
HAUT = 70             # le haut de la rangée 1

valeurs = {}          # "B3" -> le nombre tapé dans la case B3

# Le nom d'une case : colonne 1, rangée 2 -> "B3"
fonction nom_case(colonne, rangée):
    retourne LETTRES[colonne] + chaîne(rangée + 1)

fonction case_x(colonne):
    retourne GAUCHE + colonne * LARGEUR_CASE

fonction case_y(rangée):
    retourne HAUT + rangée * HAUTEUR_CASE

# Le numéro de colonne et de rangée d'une case : "B3" -> [1, 2]
fonction position(clef):
    rangée = entier(clef[1:]) - 1
    pour i dans intervalle(longueur(LETTRES)):
        si LETTRES[i] == clef[0]:
            retourne [i, rangée]
    retourne [0, rangée]

fonction total(colonne):
    s = 0.0
    pour rangée dans intervalle(LIGNES):
        clef = nom_case(colonne, rangée)
        si clef dans valeurs:
            s = s + valeurs[clef]
    retourne s

fonction dessine():
    fond("blanc")
    # les titres des colonnes (A, B, C...) et des lignes (1, 2, 3...)
    couleur("gris clair")
    rectangle_plein(GAUCHE, HAUT - 30, LARGEUR_CASE * longueur(LETTRES), 26)
    rectangle_plein(GAUCHE - 50, HAUT, 44, HAUTEUR_CASE * LIGNES)
    couleur("noir")
    taille_texte(18)
    pour c dans intervalle(longueur(LETTRES)):
        texte(case_x(c) + LARGEUR_CASE / 2 - 6, HAUT - 27, LETTRES[c])
    pour l dans intervalle(LIGNES):
        texte(GAUCHE - 36, case_y(l) + 8, chaîne(l + 1))
    # la rangée des totaux, sous le tableau
    y = case_y(LIGNES) + 12
    couleur("bleu foncé")
    épaisseur(2)
    ligne(GAUCHE, y - 6, GAUCHE + LARGEUR_CASE * longueur(LETTRES), y - 6)
    texte(GAUCHE - 92, y, "Total")
    tout = 0.0
    pour c dans intervalle(longueur(LETTRES)):
        t = total(c)
        tout = tout + t
        texte(case_x(c) + 8, y, chaîne(arrondi(t, 2)))
    taille_texte(22)
    texte(GAUCHE, y + 50, f"Total de tout le tableau : {arrondi(tout, 2)}")

# Une case a changé (Entrée, ou on est passé à une autre case)
fonction case_changée(clef, valeur):
    valeurs[clef] = nombre(valeur)
    dessine()

# Les flèches et Entrée : on passe à la case voisine
fonction touche(t):
    clef = saisie_active()
    si clef == "":
        retourne Rien
    p = position(clef)
    colonne = p[0]
    rangée = p[1]
    vers_le_bas = t == "bas" ou t == "entrée"
    si t == "gauche" et colonne > 0:
        colonne -= 1
    sinonsi t == "droite" et colonne < longueur(LETTRES) - 1:
        colonne += 1
    sinonsi t == "haut" et rangée > 0:
        rangée -= 1
    sinonsi vers_le_bas et rangée < LIGNES - 1:
        rangée += 1
    active_saisie(nom_case(colonne, rangée))

# On crée une case par colonne et par rangée
cache_tortue()
# les cases prennent la police et la taille du texte du moment
taille_texte(18)
largeur_saisie(LARGEUR_CASE - 6)
pour rangée dans intervalle(LIGNES):
    pour colonne dans intervalle(longueur(LETTRES)):
        saisie(nom_case(colonne, rangée), case_x(colonne) + 3, case_y(rangée) + 4, case_changée)
quand_touche(touche)
dessine()
active_saisie("A1")
