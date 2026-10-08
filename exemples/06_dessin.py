# 6. Dessiner dans le canevas
# Le point (0, 0) est en haut à gauche ; x va vers la droite, y vers le bas.
# Survole le canevas avec la souris pour voir les coordonnées.

fond("bleu clair")

# Le soleil
couleur("jaune")
disque(680, 100, 60)

# L'herbe
couleur("vert")
rectangle_plein(0, 450, 800, 150)

# La maison
couleur("beige")
rectangle_plein(250, 280, 250, 200)
couleur("rouge")
triangle_plein(230, 280, 520, 280, 375, 160)

# La porte et les fenêtres
couleur("marron")
rectangle_plein(345, 380, 60, 100)
couleur("blanc")
carre_plein(275, 310, 50)
carre_plein(425, 310, 50)
couleur("noir")
epaisseur(3)
carre(275, 310, 50)
carre(425, 310, 50)

# Des fleurs, placées au hasard
pour i dans intervalle(15):
    x = aleatoire(20, 780)
    y = aleatoire(480, 580)
    couleur(choisis(["rouge", "jaune", "violet", "rose", "blanc"]))
    disque(x, y, 8)
    couleur("orange")
    disque(x, y, 3)

couleur("blanc")
taille_texte(36)
texte(30, 30, "Ma maison")
