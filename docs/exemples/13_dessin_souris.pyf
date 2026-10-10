# 13. Dessiner avec la souris
# quand_glisse(f) appelle f(x, y) quand on déplace la souris
# en gardant le bouton appuyé (ou le doigt posé sur une tablette).
# Touches : r, v, b, n pour la couleur, + et - pour la taille, e pour effacer.

taille = 8
couleur_crayon = "noir"

fonction consignes():
    fond("blanc")
    couleur("gris")
    taille_texte(14)
    texte(10, 10, "Dessine en gardant le bouton appuyé.   Couleur : r v b n   Taille : + -   Effacer : e")

# La dernière position de la souris : on la relie à la nouvelle par un trait,
# pour que le dessin reste continu même quand la souris va vite
dernier_x = 0
dernier_y = 0

fonction pose(x, y):
    dernier_x =: x
    dernier_y =: y
    couleur(couleur_crayon)
    disque(x, y, taille)

fonction glisse(x, y):
    couleur(couleur_crayon)
    épaisseur(2 * taille)
    ligne(dernier_x, dernier_y, x, y)
    dernier_x =: x
    dernier_y =: y

fonction touche(t):
    si t == "r":
        couleur_crayon =: "rouge"
    sinonsi t == "v":
        couleur_crayon =: "vert"
    sinonsi t == "b":
        couleur_crayon =: "bleu"
    sinonsi t == "n":
        couleur_crayon =: "noir"
    sinonsi t == "+":
        taille += 2
    sinonsi t == "-" et taille > 2:
        taille -= 2
    sinonsi t == "e":
        consignes()

consignes()
quand_clic(pose)          # un clic fait un point et note la position
quand_glisse(glisse)      # un glissé trace un trait depuis la dernière position
quand_touche(touche)
