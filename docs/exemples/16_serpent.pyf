# 16. Le serpent
# Les flèches (ou Z Q S D) dirigent le serpent. Mange les pommes pour grandir,
# mais ne touche ni les bords, ni ta propre queue !
# Sur une tablette : touche l'écran du côté où le serpent doit tourner.
# (Clique d'abord dans le canevas pour que le clavier fonctionne,
# ou passe en plein écran.)

# Le terrain : une grille de 20 cases sur 15, chaque case mesure 40 points
CASE = 40
COLONNES = 20
LIGNES = 15

croque = charge_son("exemples/médias/pop.wav")
perdu = charge_son("exemples/médias/ding.wav")

# Le serpent est une liste de cases [colonne, ligne] : sa tête est la dernière
serpent = [[3, 7], [4, 7], [5, 7]]
direction = [1, 0]        # vers la droite
prochaine = [1, 0]        # la direction choisie au clavier, prise au pas suivant
pomme = [12, 7]
score = 0
meilleur = 0
lenteur = 8               # le serpent avance toutes les "lenteur" images
compteur = 0
état = "attente"          # "attente", "jeu" ou "perdu"

fonction sur_le_serpent(x, y):
    pour morceau dans serpent:
        si morceau[0] == x et morceau[1] == y:
            retourne Vrai
    retourne Faux

# Une nouvelle pomme, sur une case libre
fonction place_pomme():
    x = aléatoire(0, COLONNES - 1)
    y = aléatoire(0, LIGNES - 1)
    tantque sur_le_serpent(x, y):
        x = aléatoire(0, COLONNES - 1)
        y = aléatoire(0, LIGNES - 1)
    pomme =: [x, y]

fonction recommence():
    serpent =: [[3, 7], [4, 7], [5, 7]]
    direction =: [1, 0]
    prochaine =: [1, 0]
    score =: 0
    lenteur =: 8
    état =: "jeu"
    place_pomme()

# On ne peut pas faire demi-tour d'un coup
fonction tourne(dx, dy):
    si état != "jeu":
        recommence()
    si dx != -direction[0] ou dy != -direction[1]:
        prochaine =: [dx, dy]

fonction clavier(t):
    si t == "gauche" ou t == "q":
        tourne(-1, 0)
    sinonsi t == "droite" ou t == "d":
        tourne(1, 0)
    sinonsi t == "haut" ou t == "z":
        tourne(0, -1)
    sinonsi t == "bas" ou t == "s":
        tourne(0, 1)
    sinonsi t == "espace" et état != "jeu":
        recommence()

# Un clic (ou un doigt) : le serpent tourne vers le côté touché
fonction clic(x, y):
    tête = serpent[-1]
    écart_x = x - (tête[0] * CASE + CASE / 2)
    écart_y = y - (tête[1] * CASE + CASE / 2)
    si absolu(écart_x) > absolu(écart_y):
        si écart_x > 0:
            tourne(1, 0)
        sinon:
            tourne(-1, 0)
    sinon:
        si écart_y > 0:
            tourne(0, 1)
        sinon:
            tourne(0, -1)

fonction avance():
    direction =: prochaine
    tête = serpent[-1]
    x = tête[0] + direction[0]
    y = tête[1] + direction[1]
    # Le bord, ou la queue : c'est perdu
    si x < 0 ou x >= COLONNES ou y < 0 ou y >= LIGNES ou sur_le_serpent(x, y):
        état =: "perdu"
        meilleur =: maximum(meilleur, score)
        joue_son(perdu)
        retourne Rien
    serpent.ajoute([x, y])
    si x == pomme[0] et y == pomme[1]:
        # Une pomme : le serpent grandit (on garde sa queue) et va un peu plus vite
        score += 1
        lenteur =: maximum(lenteur - 0.25, 3)
        joue_son(croque)
        place_pomme()
    sinon:
        # Sinon, il avance : la queue suit
        serpent =: serpent[1:]

fonction dessine():
    fond(rgb(30, 95, 30))
    # un damier léger, pour voir les cases
    couleur(rgb(40, 110, 40))
    pour ligne dans intervalle(LIGNES):
        pour colonne dans intervalle(COLONNES):
            si (ligne + colonne) % 2 == 0:
                carré_plein(colonne * CASE, ligne * CASE, CASE)
    # la pomme
    couleur("rouge")
    disque(pomme[0] * CASE + CASE / 2, pomme[1] * CASE + CASE / 2, CASE / 2 - 4)
    couleur("vert clair")
    ellipse_pleine(pomme[0] * CASE + CASE / 2 + 5, pomme[1] * CASE + 6, 7, 4)
    # le corps, puis la tête avec ses yeux
    pour morceau dans serpent:
        couleur("jaune")
        carré_plein(morceau[0] * CASE + 2, morceau[1] * CASE + 2, CASE - 4)
    tête = serpent[-1]
    cx = tête[0] * CASE + CASE / 2
    cy = tête[1] * CASE + CASE / 2
    couleur("orange")
    carré_plein(tête[0] * CASE + 2, tête[1] * CASE + 2, CASE - 4)
    couleur("noir")
    disque(cx + direction[0] * 8 - direction[1] * 8, cy + direction[1] * 8 - direction[0] * 8, 4)
    disque(cx + direction[0] * 8 + direction[1] * 8, cy + direction[1] * 8 + direction[0] * 8, 4)
    # le score
    couleur("blanc")
    taille_texte(18)
    texte(10, 20, f"Pommes : {score}")
    texte(largeur() - 170, 20, f"Meilleur : {meilleur}")
    taille_texte(26)
    si état == "attente":
        texte(150, 400, "Une flèche ou Espace pour commencer")
    sinonsi état == "perdu":
        # en français, 0 et 1 sont au singulier : « 0 pomme », « 1 pomme », « 2 pommes »
        mot = "pommes"
        si score <= 1:
            mot = "pomme"
        texte(200, 260, f"Perdu ! Tu as mangé {score} {mot}.")
        texte(210, 310, "Une flèche ou Espace : rejouer")

fonction image():
    si état == "jeu":
        compteur += 1
        si compteur >= lenteur:
            compteur =: 0
            avance()
    dessine()

cache_tortue()
quand_touche(clavier)
quand_clic(clic)
animer(image, 20)
