# 12. Des images et des sons
# charge_image et charge_son renvoient un numéro : on le garde dans une variable,
# puis on le donne à place_image et à joue_son.

étoile = charge_image("exemples/médias/étoile.svg")
ding = charge_son("exemples/médias/ding.wav")
pop = charge_son("exemples/médias/pop.wav")

fond("bleu marine")
couleur("blanc")
taille_texte(22)
texte(20, 20, "Clique dans le ciel pour allumer des étoiles !")

# Une grande étoile au milieu : largeur et hauteur de 160 points
place_image(étoile, 320, 220, 160, 160)

nombre = 0

fonction clic(x, y):
    # l'image fait 60 points : on la centre sur le clic
    place_image(étoile, x - 30, y - 30, 60, 60)
    nombre += 1
    si nombre % 5 == 0:
        joue_son(ding)
        affiche(nombre, "étoiles !")
    sinon:
        joue_son(pop)

quand_clic(clic)
