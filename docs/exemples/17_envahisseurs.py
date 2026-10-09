# 17. Les envahisseurs de l'espace
# La souris (ou les flèches) déplace ton vaisseau, un clic (ou Espace) tire.
# Détruis les envahisseurs avant qu'ils n'arrivent en bas, et évite leurs bombes :
# tu as 3 vies ! À chaque vague détruite, la suivante va plus vite.
# (Clique d'abord dans le canevas pour que le clavier fonctionne,
# ou passe en plein écran.)

# La flotte : 5 rangées de 10 envahisseurs
COLONNES = 10
RANGÉES = 5
PAS_X = 56            # distance entre deux envahisseurs
PAS_Y = 44
LARGEUR_ENV = 36
HAUTEUR_ENV = 24
COULEURS = ["magenta", "violet clair", "bleu clair", "turquoise", "vert clair"]

son_tir = charge_son("exemples/médias/tir.wav")
son_explosion = charge_son("exemples/médias/explosion.wav")
son_boum = charge_son("exemples/médias/boum.wav")
# la marche des envahisseurs : quatre notes graves, jouées l'une après l'autre
pas_de_marche = [charge_son(f"exemples/médias/pas_{i}.wav") pour i dans intervalle(1, 5)]

# Le vaisseau
vaisseau_x = 400
VAISSEAU_Y = 550

# vivants[i] vaut Vrai tant que l'envahisseur numéro i n'est pas détruit
vivants = []
flotte_x = 100        # le coin en haut à gauche de la flotte
flotte_y = 70
sens = 1              # 1 : vers la droite, -1 : vers la gauche
attente = 0           # images avant le prochain pas de la flotte
pas_joué = 0          # le numéro de la note de marche
tir_actif = Faux
tir_x = 0
tir_y = 0
bombes = []           # chaque bombe est [x, y]
étoiles = [[aléatoire(0, 800), aléatoire(0, 600)] pour i dans intervalle(60)]
explosions = []       # [x, y, durée] : le petit éclat d'un envahisseur touché
vies = 3
score = 0
vague = 1
clignote = 0          # le vaisseau clignote après avoir été touché
état = "attente"      # "attente", "jeu" ou "perdu"

fonction env_x(i):
    retourne flotte_x + (i % COLONNES) * PAS_X

fonction env_y(i):
    retourne flotte_y + (i // COLONNES) * PAS_Y

fonction restants():
    retourne longueur([v pour v dans vivants si v])

# Une nouvelle vague : plus elle est loin, plus la flotte part bas
fonction nouvelle_vague():
    vivants =: [Vrai pour i dans intervalle(COLONNES * RANGÉES)]
    flotte_x =: 100
    flotte_y =: 70 + minimum(vague - 1, 4) * 15
    sens =: 1
    bombes =: []
    tir_actif =: Faux

fonction recommence():
    vies =: 3
    score =: 0
    vague =: 1
    nouvelle_vague()
    état =: "jeu"

fonction tire():
    si état != "jeu":
        recommence()
    sinonsi non tir_actif:
        tir_actif =: Vrai
        tir_x =: vaisseau_x
        tir_y =: VAISSEAU_Y - 20
        joue_son(son_tir)

fonction place_vaisseau(x):
    vaisseau_x =: minimum(maximum(x, 30), largeur() - 30)

fonction souris(x, y):
    place_vaisseau(x)

fonction clic(x, y):
    place_vaisseau(x)
    tire()

fonction clavier(t):
    si t == "gauche":
        place_vaisseau(vaisseau_x - 25)
    sinonsi t == "droite":
        place_vaisseau(vaisseau_x + 25)
    sinonsi t == "espace" ou t == "haut":
        tire()

# La flotte avance par petits pas ; moins il reste d'envahisseurs, plus elle va vite
fonction avance_flotte():
    attente -= 1
    si attente > 0:
        retourne Rien
    attente =: maximum(2, restants() // 2 + 4 - vague)
    joue_son(pas_de_marche[pas_joué % 4])
    pas_joué += 1
    # Le bord le plus à gauche et le plus à droite des envahisseurs encore là
    gauche = largeur()
    droite = 0
    pour i dans intervalle(longueur(vivants)):
        si vivants[i]:
            gauche = minimum(gauche, env_x(i))
            droite = maximum(droite, env_x(i) + LARGEUR_ENV)
    au_bord_droit = sens == 1 et droite + 12 > largeur()
    au_bord_gauche = sens == -1 et gauche - 12 < 0
    si au_bord_droit ou au_bord_gauche:
        # au bord : la flotte descend et repart dans l'autre sens
        flotte_y += 20
        sens =: -sens
    sinon:
        flotte_x += 12 * sens

# De temps en temps, un envahisseur lâche une bombe
fonction lâche_bombes():
    si aléatoire(1, 100) <= 2 + vague et longueur(bombes) < 3 + vague:
        i = aléatoire(0, longueur(vivants) - 1)
        si vivants[i]:
            bombes.ajoute([env_x(i) + LARGEUR_ENV / 2, env_y(i) + HAUTEUR_ENV])

fonction avance_tir():
    si non tir_actif:
        retourne Rien
    tir_y -= 12
    si tir_y < 0:
        tir_actif =: Faux
        retourne Rien
    pour i dans intervalle(longueur(vivants)):
        si vivants[i]:
            x = env_x(i)
            y = env_y(i)
            si tir_x > x et tir_x < x + LARGEUR_ENV et tir_y > y et tir_y < y + HAUTEUR_ENV:
                vivants[i] = Faux
                tir_actif =: Faux
                # les rangées du haut rapportent plus de points
                score += 10 * (RANGÉES - i // COLONNES)
                explosions.ajoute([x + LARGEUR_ENV / 2, y + HAUTEUR_ENV / 2, 8])
                joue_son(son_explosion)
                sortir

fonction avance_bombes():
    bombes =: [[b[0], b[1] + 5 + vague] pour b dans bombes si b[1] < hauteur()]
    si clignote > 0:
        retourne Rien
    # on cherche d'abord si une bombe touche le vaisseau ; touché() vide la liste
    # des bombes, ce qu'on ne fait pas pendant qu'on la parcourt
    atteint = Faux
    pour b dans bombes:
        si absolu(b[0] - vaisseau_x) < 24 et absolu(b[1] - VAISSEAU_Y) < 12:
            atteint = Vrai
            sortir
    si atteint:
        touché()

fonction touché():
    vies -= 1
    bombes =: []
    clignote =: 60
    joue_son(son_boum)
    si vies == 0:
        état =: "perdu"

fonction vérifie_vague():
    si restants() == 0:
        vague += 1
        score += 100
        nouvelle_vague()
        retourne Rien
    # Les envahisseurs arrivent à la hauteur du vaisseau : c'est perdu
    pour i dans intervalle(longueur(vivants)):
        si vivants[i] et env_y(i) + HAUTEUR_ENV > VAISSEAU_Y - 20:
            vies =: 0
            état =: "perdu"
            joue_son(son_boum)
            sortir

# Un envahisseur : un corps, deux yeux, et des pattes qui bougent à chaque pas
fonction dessine_envahisseur(x, y, c):
    couleur(c)
    rectangle_plein(x + 6, y, LARGEUR_ENV - 12, 6)
    rectangle_plein(x, y + 6, LARGEUR_ENV, 10)
    couleur("noir")
    carré_plein(x + 8, y + 8, 5)
    carré_plein(x + LARGEUR_ENV - 13, y + 8, 5)
    couleur(c)
    si pas_joué % 2 == 0:
        rectangle_plein(x + 2, y + 16, 5, 8)
        rectangle_plein(x + LARGEUR_ENV - 7, y + 16, 5, 8)
    sinon:
        rectangle_plein(x + 8, y + 16, 5, 8)
        rectangle_plein(x + LARGEUR_ENV - 13, y + 16, 5, 8)

fonction dessine_vaisseau():
    # après un choc, le vaisseau clignote : on ne le dessine qu'une image sur deux
    si clignote > 0 et (clignote // 5) % 2 == 0:
        retourne Rien
    couleur("vert clair")
    rectangle_plein(vaisseau_x - 24, VAISSEAU_Y, 48, 12)
    rectangle_plein(vaisseau_x - 4, VAISSEAU_Y - 10, 8, 10)

fonction dessine():
    fond("noir")
    couleur("gris")
    pour é dans étoiles:
        point(é[0], é[1])
    pour i dans intervalle(longueur(vivants)):
        si vivants[i]:
            dessine_envahisseur(env_x(i), env_y(i), COULEURS[i // COLONNES])
    # les éclats des envahisseurs touchés
    couleur("orange")
    pour e dans explosions:
        cercle(e[0], e[1], 22 - e[2] * 2)
    dessine_vaisseau()
    si tir_actif:
        couleur("blanc")
        rectangle_plein(tir_x - 2, tir_y, 4, 14)
    couleur("rouge clair")
    pour b dans bombes:
        rectangle_plein(b[0] - 2, b[1], 4, 10)
    # le sol, le score, les vies
    couleur("vert clair")
    ligne(0, 575, largeur(), 575)
    couleur("blanc")
    taille_texte(18)
    texte(10, 20, f"Score : {score}")
    texte(340, 20, f"Vague {vague}")
    texte(largeur() - 100, 20, f"Vies : {vies}")
    taille_texte(26)
    si état == "attente":
        texte(165, 330, "Clic ou Espace : défendre la Terre !")
    sinonsi état == "perdu":
        couleur("rouge clair")
        texte(240, 300, f"La Terre est envahie !")
        couleur("blanc")
        texte(270, 345, f"Score : {score}, vague {vague}")
        texte(255, 390, "Clic ou Espace : rejouer")

fonction image():
    si état == "jeu":
        avance_flotte()
        lâche_bombes()
        avance_tir()
        avance_bombes()
        vérifie_vague()
        si clignote > 0:
            clignote -= 1
    # les éclats s'effacent peu à peu
    explosions =: [[e[0], e[1], e[2] - 1] pour e dans explosions si e[2] > 1]
    dessine()

cache_tortue()
nouvelle_vague()
quand_souris(souris)
quand_glisse(souris)      # sur une tablette : glisser le doigt
quand_clic(clic)
quand_touche(clavier)
animer(image, 20)
