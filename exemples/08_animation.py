# 8. Une balle qui rebondit
# animer(fonction, délai) appelle la fonction toutes les "délai" millisecondes.
# Clique sur « Arrêter » pour stopper l'animation.

x = 100
y = 100
dx = 6
dy = 4.5
rayon = 25

fonction image():
    # Une variable modifiée avec += dans une fonction est la variable globale
    x += dx
    y += dy
    # On rebondit sur les bords
    si x < rayon ou x > largeur() - rayon:
        dx *= -1
    si y < rayon ou y > hauteur() - rayon:
        dy *= -1
    fond("gris foncé")
    couleur("orange")
    disque(x, y, rayon)
    couleur("blanc")
    taille_texte(18)
    texte(10, 10, f"x = {arrondi(x)}   y = {arrondi(y)}")

cache_tortue()
animer(image, 20)
