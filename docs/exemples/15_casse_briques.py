# 15. Casse-briques
# La souris (ou les flèches du clavier) déplace la raquette.
# Clic ou Espace : lancer la balle. Casse toutes les briques sans laisser
# tomber la balle : tu as 3 vies ! (Clique d'abord dans le canevas pour
# que le clavier fonctionne.)

# Le mur de briques : 5 rangées de 10 briques
COLONNES = 10
RANGÉES = 5
LARGEUR_BRIQUE = 75
HAUTEUR_BRIQUE = 24
ÉCART = 4
HAUT_DU_MUR = 60
COULEURS = ["rouge", "orange", "jaune", "vert", "bleu"]

ding = charge_son("exemples/médias/ding.wav")
pop = charge_son("exemples/médias/pop.wav")

raquette_l = 110
raquette_h = 14
raquette_x = 345
raquette_y = 560
rayon = 9

# briques[i] vaut Vrai tant que la brique numéro i n'est pas cassée
briques = [Vrai pour i dans intervalle(COLONNES * RANGÉES)]
restantes = COLONNES * RANGÉES
balle_x = 400.0
balle_y = 540.0
vx = 0.0
vy = 0.0
vitesse = 6.0
vies = 3
score = 0
état = "attente"      # "attente", "jeu", "perdu" ou "gagné"

# La position d'une brique se calcule à partir de son numéro
fonction brique_x(i):
    retourne 5 + (i % COLONNES) * (LARGEUR_BRIQUE + ÉCART)

fonction brique_y(i):
    retourne HAUT_DU_MUR + (i // COLONNES) * (HAUTEUR_BRIQUE + ÉCART)

# La balle attend, posée sur la raquette
fonction pose_balle():
    balle_x =: raquette_x + raquette_l / 2
    balle_y =: raquette_y - rayon - 1

fonction recommence():
    pour i dans intervalle(longueur(briques)):
        briques[i] = Vrai
    restantes =: COLONNES * RANGÉES
    vies =: 3
    score =: 0
    vitesse =: 6.0
    état =: "attente"
    pose_balle()

fonction lance():
    si état == "attente":
        vx =: choisis([-3.0, 3.0])
        vy =: -vitesse
        état =: "jeu"
    sinonsi état == "perdu" ou état == "gagné":
        recommence()

# La raquette ne sort pas du canevas
fonction place_raquette(centre):
    raquette_x =: minimum(maximum(centre - raquette_l / 2, 0.0), largeur() - raquette_l)
    si état == "attente":
        pose_balle()

fonction souris(x, y):
    place_raquette(x)

fonction clic(x, y):
    lance()

fonction clavier(t):
    si t == "ArrowLeft":
        place_raquette(raquette_x + raquette_l / 2 - 40)
    sinonsi t == "ArrowRight":
        place_raquette(raquette_x + raquette_l / 2 + 40)
    sinonsi t == " ":
        lance()

# Une brique touchée disparaît, et la balle rebondit
fonction casse_brique():
    pour i dans intervalle(longueur(briques)):
        si briques[i]:
            x = brique_x(i)
            y = brique_y(i)
            dedans_x = balle_x + rayon > x et balle_x - rayon < x + LARGEUR_BRIQUE
            dedans_y = balle_y + rayon > y et balle_y - rayon < y + HAUTEUR_BRIQUE
            si dedans_x et dedans_y:
                briques[i] = Faux
                restantes -= 1
                # les rangées du haut rapportent plus de points
                score += 10 * (RANGÉES - i // COLONNES)
                # touchée par le côté : la balle repart de côté, sinon vers le haut ou le bas
                si balle_x < x ou balle_x > x + LARGEUR_BRIQUE:
                    vx =: -vx
                sinon:
                    vy =: -vy
                # la balle va un peu plus vite à chaque brique
                vitesse =: minimum(vitesse + 0.08, 11.0)
                joue_son(ding)
                si restantes == 0:
                    état =: "gagné"
                sortir

fonction avance_balle():
    balle_x += vx
    balle_y += vy
    # Les murs de gauche, de droite et du haut
    si balle_x < rayon:
        balle_x =: rayon
        vx =: absolu(vx)
    sinonsi balle_x > largeur() - rayon:
        balle_x =: largeur() - rayon
        vx =: -absolu(vx)
    si balle_y < rayon:
        balle_y =: rayon
        vy =: absolu(vy)
    # La raquette : plus la balle la touche loin du centre, plus elle part de côté
    sur_raquette = balle_x > raquette_x - rayon et balle_x < raquette_x + raquette_l + rayon
    à_hauteur = balle_y + rayon >= raquette_y et balle_y < raquette_y + raquette_h
    si vy > 0 et sur_raquette et à_hauteur:
        décalage = (balle_x - (raquette_x + raquette_l / 2)) / (raquette_l / 2)
        décalage = minimum(maximum(décalage, -0.85), 0.85)
        vx =: décalage * vitesse
        vy =: -racine(vitesse * vitesse - vx * vx)
        balle_y =: raquette_y - rayon
        joue_son(pop)
    casse_brique()
    # La balle est tombée
    si balle_y > hauteur() + rayon:
        vies -= 1
        si vies == 0:
            état =: "perdu"
        sinon:
            état =: "attente"
            pose_balle()

fonction dessine():
    fond("bleu marine")
    pour i dans intervalle(longueur(briques)):
        si briques[i]:
            couleur(COULEURS[i // COLONNES])
            rectangle_plein(brique_x(i), brique_y(i), LARGEUR_BRIQUE, HAUTEUR_BRIQUE)
    couleur("blanc")
    rectangle_plein(raquette_x, raquette_y, raquette_l, raquette_h)
    couleur("jaune")
    disque(balle_x, balle_y, rayon)
    couleur("blanc")
    taille_texte(18)
    texte(10, 20, f"Score : {score}")
    texte(largeur() - 100, 20, f"Vies : {vies}")
    taille_texte(26)
    si état == "attente":
        texte(215, 380, "Clic ou Espace : lancer la balle")
    sinonsi état == "perdu":
        texte(240, 340, f"Perdu ! Score : {score}")
        texte(255, 390, "Clic ou Espace : rejouer")
    sinonsi état == "gagné":
        couleur("jaune")
        texte(195, 340, f"Bravo, tout est cassé ! Score : {score}")
        texte(255, 390, "Clic ou Espace : rejouer")

fonction image():
    si état == "jeu":
        avance_balle()
    dessine()

cache_tortue()
pose_balle()
quand_souris(souris)
quand_glisse(souris)      # sur une tablette : glisser le doigt
quand_clic(clic)
quand_touche(clavier)
animer(image, 16)
