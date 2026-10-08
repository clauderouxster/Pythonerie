# 9. Interagir avec la souris et le clavier
# quand_clic(f)   : f(x, y) est appelée à chaque clic dans le canevas
# quand_touche(f) : f(touche) est appelée à chaque touche du clavier
# (clique d'abord dans le canevas, puis utilise les flèches)

px = 400
py = 300
taille = 40
couleur_carre = "bleu"

fonction dessine():
    fond("blanc")
    couleur("gris")
    taille_texte(16)
    texte(10, 10, "Flèches : déplacer   Espace : changer de couleur   Clic : déposer un point")
    couleur(couleur_carre)
    carre_plein(px - taille / 2, py - taille / 2, taille)

fonction touche(t):
    globale couleur_carre
    si t == "ArrowLeft":
        px -= 20
    sinonsi t == "ArrowRight":
        px += 20
    sinonsi t == "ArrowUp":
        py -= 20
    sinonsi t == "ArrowDown":
        py += 20
    sinonsi t == " ":
        couleur_carre = choisis(["rouge", "vert", "bleu", "violet", "orange"])
    dessine()

fonction clic(x, y):
    couleur("rouge")
    disque(x, y, 6)

cache_tortue()
dessine()
quand_touche(touche)
quand_clic(clic)
