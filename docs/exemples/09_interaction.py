# 9. Interagir avec la souris et le clavier
# quand_clic(f)   : f(x, y) est appelée à chaque clic dans le canevas
# quand_touche(f) : f(touche) est appelée à chaque touche du clavier
# (clique d'abord dans le canevas, puis utilise les flèches)

px = 400
py = 300
taille = 40
couleur_carré = "bleu"

fonction dessine():
    fond("blanc")
    couleur("gris")
    taille_texte(16)
    texte(10, 10, "Flèches : déplacer   Espace : changer de couleur   Clic : déposer un point")
    couleur(couleur_carré)
    carré_plein(px - taille / 2, py - taille / 2, taille)

fonction touche(t):
    si t == "gauche":
        px -= 20
    sinonsi t == "droite":
        px += 20
    sinonsi t == "haut":
        py -= 20
    sinonsi t == "bas":
        py += 20
    sinonsi t == "espace":
        # =: modifie la variable du programme (et non une variable de la fonction)
        couleur_carré =: choisis(["rouge", "vert", "bleu", "violet", "orange"])
    dessine()

fonction clic(x, y):
    couleur("rouge")
    disque(x, y, 6)

cache_tortue()
dessine()
quand_touche(touche)
quand_clic(clic)
