# 7. La tortue
# La tortue part du centre, tournée vers la droite.
# avance(d), recule(d), gauche(angle), droite(angle)

fonction polygone_régulier(côtés, longueur):
    pour i dans intervalle(côtés):
        avance(longueur)
        gauche(360 / côtés)

épaisseur(2)
couleurs = ["rouge", "orange", "jaune", "vert", "bleu", "violet"]

# Une rosace : un hexagone que l'on fait tourner
pour i dans intervalle(36):
    couleur(couleurs[i % 6])
    polygone_régulier(6, 60)
    droite(10)

# Une étoile, plus loin
lève_crayon()
va_à(110, 120)
baisse_crayon()
couleur("or")
épaisseur(4)
pour i dans intervalle(5):
    avance(120)
    droite(144)

# Une spirale
lève_crayon()
va_à(650, 480)
baisse_crayon()
couleur("bleu marine")
épaisseur(1)
pour i dans intervalle(60):
    avance(i * 1.5)
    gauche(59)
