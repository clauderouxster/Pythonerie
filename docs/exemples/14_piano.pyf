# 14. Un piano de trois octaves
# Clique sur les touches, ou fais glisser la souris dessus pour un glissando.
# Avec le clavier de l'ordinateur (octave du milieu) :
#   touches blanches : q s d f g h j k     touches noires : z e t y u

noms = ["do", "do♯", "ré", "ré♯", "mi", "fa", "fa♯", "sol", "sol♯", "la", "la♯", "si"]
fichiers = ["do", "do_dièse", "ré", "ré_dièse", "mi", "fa", "fa_dièse", "sol", "sol_dièse", "la", "la_dièse", "si"]
# les degrés des touches blanches dans une octave : do, ré, mi, fa, sol, la, si
blanches = [0, 2, 4, 5, 7, 9, 11]

nombre_de_notes = 36            # 3 octaves de 12 notes : de do3 à si5
haut = 200                      # le haut du clavier sur le canevas
hauteur_blanche = 330
hauteur_noire = 200
largeur_blanche = largeur() / 21    # 3 octaves × 7 touches blanches
largeur_noire = largeur_blanche * 0.6

# 1. On charge les 36 sons : sons[n] est le numéro du son de la note n
sons = []
pour n dans intervalle(nombre_de_notes):
    octave = n // 12 + 3
    sons.ajoute(charge_son(f"exemples/médias/piano/{fichiers[n % 12]}_{octave}.wav"))

# 2. On calcule la place de chaque touche : [note, x, largeur, noire ?]
touches = []
blanches_placées = 0
pour n dans intervalle(nombre_de_notes):
    si (n % 12) dans blanches:
        touches.ajoute([n, blanches_placées * largeur_blanche, largeur_blanche, Faux])
        blanches_placées += 1
    sinon:
        # une touche noire est à cheval entre deux touches blanches
        touches.ajoute([n, blanches_placées * largeur_blanche - largeur_noire / 2, largeur_noire, Vrai])

fonction nom_de_note(n):
    retourne noms[n % 12] + chaîne(n // 12 + 3)

# 3. On dessine le clavier ; la touche « appuyée » est en couleur (-1 : aucune)
fonction dessine_clavier(appuyée):
    fond("beige")
    couleur("marron")
    taille_texte(30)
    texte(20, 30, "🎹 Le piano de la Pythonerie")
    taille_texte(16)
    texte(20, 80, "Clique, glisse sur les touches ou joue avec q s d f g h j k (blanches) et z e t y u (noires)")
    # d'abord les touches blanches...
    pour t dans touches:
        si non t[3]:
            si t[0] == appuyée:
                couleur("jaune")
            sinon:
                couleur("blanc")
            rectangle_plein(t[1], haut, t[2], hauteur_blanche)
            couleur("gris foncé")
            épaisseur(1)
            rectangle(t[1], haut, t[2], hauteur_blanche)
            taille_texte(11)
            texte(t[1] + 5, haut + hauteur_blanche - 22, nom_de_note(t[0]))
    # ... puis les noires, par-dessus
    pour t dans touches:
        si t[3]:
            si t[0] == appuyée:
                couleur("orange")
            sinon:
                couleur("noir")
            rectangle_plein(t[1], haut, t[2], hauteur_noire)
    si appuyée >= 0:
        couleur("marron")
        taille_texte(40)
        texte(largeur() - 200, 120, nom_de_note(appuyée))

# 4. Quelle touche est sous la souris ? (les noires d'abord : elles sont au-dessus)
fonction touche_sous(x, y):
    si y < haut ou y > haut + hauteur_blanche:
        retourne -1
    si y <= haut + hauteur_noire:
        pour t dans touches:
            si t[3] et x >= t[1] et x < t[1] + t[2]:
                retourne t[0]
    pour t dans touches:
        si non t[3] et x >= t[1] et x < t[1] + t[2]:
            retourne t[0]
    retourne -1

fonction joue(n):
    joue_son(sons[n])
    dessine_clavier(n)

# 5. La souris : un clic joue une note, un glissé joue chaque nouvelle touche survolée
dernière_note = -1

fonction clic(x, y):
    n = touche_sous(x, y)
    si n >= 0:
        joue(n)
    dernière_note =: n

fonction glisse(x, y):
    n = touche_sous(x, y)
    si n >= 0 et n != dernière_note:
        joue(n)
    dernière_note =: n

# 6. Le clavier de l'ordinateur (disposition AZERTY) : l'octave du milieu, de do4 à do5
clavier = {"q": 12, "z": 13, "s": 14, "e": 15, "d": 16, "f": 17, "t": 18,
           "g": 19, "y": 20, "h": 21, "u": 22, "j": 23, "k": 24}

fonction touche(t):
    si t dans clavier:
        joue(clavier[t])

dessine_clavier(-1)
quand_clic(clic)
quand_glisse(glisse)
quand_touche(touche)
