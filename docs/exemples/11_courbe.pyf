# 11. Dessiner une courbe mathématique
# Change la fonction courbe(x) et l'intervalle de x, puis exécute.

# La fonction à dessiner : elle reçoit x et renvoie y
fonction courbe(x):
    retourne x * x / 4 - 2

# L'intervalle des x
début = -5
fin = 5

titre = "y = x² / 4 - 2"
largeur_canevas = largeur()
hauteur_canevas = hauteur()
marge = 50
nombre_de_points = 400

# 1. On calcule les points de la courbe
xs = []
ys = []
pas = (fin - début) / nombre_de_points
pour i dans intervalle(nombre_de_points + 1):
    x = début + i * pas
    xs.ajoute(x)
    ys.ajoute(courbe(x))

# 2. On cherche les valeurs extrêmes de y
y_min = minimum(ys)
y_max = maximum(ys)
# l'axe des x (la droite y = 0) reste toujours visible
si y_min > 0:
    y_min = 0
si y_max < 0:
    y_max = 0
si y_min == y_max:
    y_min -= 1
    y_max += 1

# 3. On passe des coordonnées mathématiques aux points du canevas
fonction écran_x(x):
    retourne marge + (x - début) * (largeur_canevas - 2 * marge) / (fin - début)

fonction écran_y(y):
    # sur le canevas, y va vers le bas : on retourne la courbe
    retourne hauteur_canevas - marge - (y - y_min) * (hauteur_canevas - 2 * marge) / (y_max - y_min)

# 4. Les axes
fond("blanc")
couleur("gris foncé")
épaisseur(2)
axe_x = écran_y(0)
# l'axe des y passe par x = 0, ou par le bord gauche si 0 n'est pas dans l'intervalle
si début <= 0 et fin >= 0:
    axe_y = écran_x(0)
sinon:
    axe_y = écran_x(début)
ligne(marge, axe_x, largeur_canevas - marge, axe_x)
ligne(axe_y, marge, axe_y, hauteur_canevas - marge)
taille_texte(16)
texte(largeur_canevas - marge + 8, axe_x - 8, "x")
texte(axe_y - 5, marge - 24, "y")

# 5. Les graduations, avec leurs valeurs
# Un pas « rond » (1, 2 ou 5 fois une puissance de 10) pour environ 10 graduations
fonction joli_pas(étendue):
    brut = étendue / 10
    p = 1
    tantque p * 10 <= brut:
        p = p * 10
    tantque p > brut:
        p = p / 10
    si brut / p >= 5:
        retourne 5 * p
    sinonsi brut / p >= 2:
        retourne 2 * p
    retourne p

# La première graduation : le premier multiple du pas qui n'est pas avant le début
fonction première_graduation(début_axe, pas_axe):
    g = plancher(début_axe / pas_axe) * pas_axe
    si g < début_axe:
        g += pas_axe
    retourne g

épaisseur(1)
taille_texte(12)
pas_x = joli_pas(fin - début)
x = première_graduation(début, pas_x)
tantque x <= fin + pas_x / 1000:
    px = écran_x(x)
    ligne(px, axe_x - 4, px, axe_x + 4)
    texte(px - 10, axe_x + 8, chaîne(arrondi(x, 2)))
    x += pas_x
pas_y = joli_pas(y_max - y_min)
y = première_graduation(y_min, pas_y)
tantque y <= y_max + pas_y / 1000:
    py = écran_y(y)
    ligne(axe_y - 4, py, axe_y + 4, py)
    # le 0 est déjà écrit sur l'axe des x
    si arrondi(y, 6) != 0:
        texte(axe_y - 42, py - 6, chaîne(arrondi(y, 2)))
    y += pas_y

# 6. La courbe : on relie chaque point au suivant
couleur("bleu")
épaisseur(3)
pour i dans intervalle(nombre_de_points):
    ligne(écran_x(xs[i]), écran_y(ys[i]), écran_x(xs[i + 1]), écran_y(ys[i + 1]))

couleur("bleu")
taille_texte(20)
texte(marge + 10, 12, titre)

affiche("Courbe dessinée de x =", début, "à x =", fin)
affiche("y va de", arrondi(minimum(ys), 2), "à", arrondi(maximum(ys), 2))
