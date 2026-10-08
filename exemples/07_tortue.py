# 7. La tortue
# La tortue part du centre, tournée vers la droite.
# avance(d), recule(d), gauche(angle), droite(angle)

fonction polygone_regulier(cotes, longueur):
    pour i dans intervalle(cotes):
        avance(longueur)
        gauche(360 / cotes)

epaisseur(2)
couleurs = ["rouge", "orange", "jaune", "vert", "bleu", "violet"]

# Une rosace : un hexagone que l'on fait tourner
pour i dans intervalle(36):
    couleur(couleurs[i % 6])
    polygone_regulier(6, 60)
    droite(10)

# Une étoile, plus loin
leve_crayon()
va_a(110, 120)
baisse_crayon()
couleur("or")
epaisseur(4)
pour i dans intervalle(5):
    avance(120)
    droite(144)

# Une spirale
leve_crayon()
va_a(650, 480)
baisse_crayon()
couleur("bleu marine")
epaisseur(1)
pour i dans intervalle(60):
    avance(i * 1.5)
    gauche(59)
