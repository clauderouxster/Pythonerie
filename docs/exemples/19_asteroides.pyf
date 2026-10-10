# 19. Astéroïdes
# Détruis les astéroïdes avant qu'ils ne percutent ton vaisseau : tu as 3 vies !
# Un gros astéroïde touché se casse en deux moyens, un moyen en deux petits.
#
# À la souris (ou au doigt) : le vaisseau se tourne vers le pointeur et
# avance vers lui quand il est loin. Clic : tirer.
# Au clavier : gauche / droite (ou Q / D) pour tourner, haut (ou Z) pour
# avancer, tant que la touche est tenue ; Espace pour tirer.
# (Clique d'abord dans le canevas pour que le clavier fonctionne,
# ou passe en plein écran.)

son_tir = charge_son("exemples/médias/tir.wav")
son_explosion = charge_son("exemples/médias/explosion.wav")
son_boum = charge_son("exemples/médias/boum.wav")
# le cœur qui bat de plus en plus vite : deux notes graves, l'une après l'autre
sons_battement = [charge_son("exemples/médias/pas_1.wav"), charge_son("exemples/médias/pas_3.wav")]

# la taille d'un astéroïde (1, 2 ou 3) donne son rayon et ses points
rayons = [0, 12, 22, 40]
points = [0, 100, 50, 20]

# Le vaisseau : sa position, sa vitesse, et la direction de son nez
vaisseau_x = largeur() / 2
vaisseau_y = hauteur() / 2
vit_x = 0.0
vit_y = 0.0
cap_x = 0.0           # le nez regarde vers le haut
cap_y = -1.0
flamme = 0            # images pendant lesquelles le réacteur brille
invincible = 0        # après un choc, le vaisseau clignote et ne craint rien

souris_x = 400.0
souris_y = 300.0
mode_souris = Faux

astéroïdes = []       # chaque astéroïde : [x, y, vx, vy, taille, angle, rotation, forme]
tirs = []             # chaque tir : [x, y, vx, vy, durée]
particules = []       # les éclats : [x, y, vx, vy, durée]

vies = 3
score = 0
vague = 1
tempo = 50
attente_battement = 0
note = 0
état = "attente"      # "attente", "jeu" ou "perdu"

# Ce qui sort d'un côté de l'écran revient de l'autre
fonction enveloppe(v, maxi):
    si v < 0:
        retourne v + maxi
    si v >= maxi:
        retourne v - maxi
    retourne v

# Un nouvel astéroïde, avec une forme bosselée tirée au hasard
fonction nouvel_astéroïde(x, y, taille):
    direction = aléatoire(0, 359)
    v = (4 - taille) * 0.6 + hasard() * 1.2 + vague * 0.1
    forme = [0.75 + hasard() * 0.35 pour i dans intervalle(10)]
    retourne [x, y, cosinus(direction) * v, sinus(direction) * v, taille, aléatoire(0, 359), hasard() * 2 - 1, forme]

# Une vague : de gros astéroïdes qui arrivent par les bords
fonction nouvelle_vague():
    astéroïdes =: []
    pour i dans intervalle(minimum(3 + vague, 10)):
        si hasard() < 0.5:
            astéroïdes.ajoute(nouvel_astéroïde(aléatoire(0, largeur()), 0, 3))
        sinon:
            astéroïdes.ajoute(nouvel_astéroïde(0, aléatoire(0, hauteur()), 3))
    tempo =: 50

fonction place_au_centre():
    vaisseau_x =: largeur() / 2
    vaisseau_y =: hauteur() / 2
    vit_x =: 0.0
    vit_y =: 0.0
    cap_x =: 0.0
    cap_y =: -1.0

fonction commence():
    vies =: 3
    score =: 0
    vague =: 1
    tirs =: []
    particules =: []
    place_au_centre()
    invincible =: 120
    nouvelle_vague()
    état =: "jeu"

# Tourner le nez du vaisseau d'un angle (en degrés, vers la droite)
fonction pivote(angle):
    c = cosinus(angle)
    s = sinus(angle)
    nx = cap_x * c - cap_y * s
    ny = cap_x * s + cap_y * c
    cap_x =: nx
    cap_y =: ny

fonction pousse(force):
    vit_x += cap_x * force
    vit_y += cap_y * force
    flamme =: 4

fonction feu():
    si état != "jeu":
        commence()
        retourne Rien
    si longueur(tirs) >= 4:
        retourne Rien
    tirs.ajoute([vaisseau_x + cap_x * 16, vaisseau_y + cap_y * 16, cap_x * 9 + vit_x, cap_y * 9 + vit_y, 45])
    joue_son(son_tir)

fonction éclats(x, y, n):
    pour i dans intervalle(n):
        d = aléatoire(0, 359)
        v = 1 + hasard() * 3
        particules.ajoute([x, y, cosinus(d) * v, sinus(d) * v, aléatoire(20, 40)])

# --- La souris et le clavier ---

fonction souris(x, y):
    souris_x =: x
    souris_y =: y
    mode_souris =: Vrai

fonction clic(x, y):
    feu()

# Espace tire ; une touche de pilotage repasse au clavier
fonction clavier(t):
    t = minuscules(t)
    si t == "espace":
        feu()
    sinonsi t dans ["gauche", "droite", "haut", "q", "d", "z"]:
        mode_souris =: Faux

# Au clavier : on tourne et on avance tant que les touches sont tenues
fonction pilote_clavier():
    si touche_enfoncée("gauche") ou touche_enfoncée("q"):
        pivote(-4)
    si touche_enfoncée("droite") ou touche_enfoncée("d"):
        pivote(4)
    si touche_enfoncée("haut") ou touche_enfoncée("z"):
        pousse(0.15)

# À la souris : le nez suit le pointeur, le vaisseau avance s'il est loin
fonction pilote_souris():
    dx = souris_x - vaisseau_x
    dy = souris_y - vaisseau_y
    d = racine(dx * dx + dy * dy)
    si d < 1:
        retourne Rien
    cap_x =: dx / d
    cap_y =: dy / d
    si d > 160:
        pousse(0.12)

# --- Le mouvement ---

fonction avance_vaisseau():
    vit_x =: vit_x * 0.99
    vit_y =: vit_y * 0.99
    v = racine(vit_x * vit_x + vit_y * vit_y)
    si v > 7:
        vit_x =: vit_x * 7 / v
        vit_y =: vit_y * 7 / v
    vaisseau_x =: enveloppe(vaisseau_x + vit_x, largeur())
    vaisseau_y =: enveloppe(vaisseau_y + vit_y, hauteur())

fonction bouge(a):
    x = enveloppe(a[0] + a[2], largeur())
    y = enveloppe(a[1] + a[3], hauteur())
    retourne [x, y, a[2], a[3], a[4], a[5] + a[6], a[6], a[7]]

fonction avance_tirs():
    tirs =: [[enveloppe(t[0] + t[2], largeur()), enveloppe(t[1] + t[3], hauteur()), t[2], t[3], t[4] - 1] pour t dans tirs si t[4] > 1]

fonction avance_particules():
    particules =: [[p[0] + p[2], p[1] + p[3], p[2] * 0.97, p[3] * 0.97, p[4] - 1] pour p dans particules si p[4] > 1]

# Un tir touche un astéroïde : il se casse en deux plus petits
fonction chocs():
    restants = []
    utilisés = []
    pour a dans astéroïdes:
        r = rayons[a[4]]
        touché = -1
        pour j dans intervalle(longueur(tirs)):
            si touché < 0 et j non dans utilisés:
                dx = tirs[j][0] - a[0]
                dy = tirs[j][1] - a[1]
                si dx * dx + dy * dy < r * r:
                    touché = j
        si touché >= 0:
            utilisés.ajoute(touché)
            score += points[a[4]]
            éclats(a[0], a[1], 8)
            joue_son(son_explosion)
            si a[4] > 1:
                restants.ajoute(nouvel_astéroïde(a[0], a[1], a[4] - 1))
                restants.ajoute(nouvel_astéroïde(a[0], a[1], a[4] - 1))
        sinon:
            restants.ajoute(a)
    astéroïdes =: restants
    tirs =: [tirs[j] pour j dans intervalle(longueur(tirs)) si j non dans utilisés]

fonction perd_une_vie():
    vies -= 1
    éclats(vaisseau_x, vaisseau_y, 20)
    joue_son(son_boum)
    si vies <= 0:
        état =: "perdu"
    sinon:
        place_au_centre()
        invincible =: 150

# Un astéroïde percute le vaisseau
fonction choc_vaisseau():
    si invincible > 0:
        retourne Rien
    pour a dans astéroïdes:
        dx = a[0] - vaisseau_x
        dy = a[1] - vaisseau_y
        r = rayons[a[4]] + 10
        si dx * dx + dy * dy < r * r:
            perd_une_vie()
            sortir

# Le battement s'accélère au fil de la vague
fonction battement_de_cœur():
    attente_battement -= 1
    si attente_battement > 0:
        retourne Rien
    joue_son(sons_battement[note % 2])
    note += 1
    tempo =: maximum(12, tempo - 1)
    attente_battement =: tempo

# --- Le dessin ---

fonction dessine_astéroïde(a):
    r = rayons[a[4]]
    pts = []
    pour i dans intervalle(10):
        angle = a[5] + i * 36
        pts.ajoute([a[0] + cosinus(angle) * r * a[7][i], a[1] + sinus(angle) * r * a[7][i]])
    polygone(pts)

fonction dessine_vaisseau():
    # après un choc, on ne le dessine qu'une image sur deux
    si invincible > 0 et (invincible // 6) % 2 == 0:
        retourne Rien
    px = -cap_y            # la direction perpendiculaire au nez
    py = cap_x
    arrière_x = vaisseau_x - cap_x * 10
    arrière_y = vaisseau_y - cap_y * 10
    couleur("blanc")
    épaisseur(2)
    triangle(vaisseau_x + cap_x * 16, vaisseau_y + cap_y * 16, arrière_x + px * 10, arrière_y + py * 10, arrière_x - px * 10, arrière_y - py * 10)
    si flamme > 0:
        longueur_flamme = 8 + aléatoire(0, 6)
        couleur("orange")
        triangle(arrière_x + px * 5, arrière_y + py * 5, arrière_x - px * 5, arrière_y - py * 5, arrière_x - cap_x * longueur_flamme, arrière_y - cap_y * longueur_flamme)

fonction dessine():
    fond("noir")
    couleur("gris clair")
    épaisseur(2)
    pour a dans astéroïdes:
        dessine_astéroïde(a)
    couleur("blanc")
    pour t dans tirs:
        disque(t[0], t[1], 2)
    couleur("orange")
    pour p dans particules:
        rectangle_plein(p[0] - 1, p[1] - 1, 2, 2)
    si état == "jeu":
        dessine_vaisseau()
    couleur("blanc")
    taille_texte(18)
    texte(10, 10, f"Score : {score}")
    texte(largeur() / 2 - 35, 10, f"Vague {vague}")
    texte(largeur() - 100, 10, f"Vies : {vies}")
    si état == "attente":
        taille_texte(48)
        texte(largeur() / 2 - 150, hauteur() / 2 - 80, "ASTÉROÏDES")
        taille_texte(22)
        texte(largeur() / 2 - 165, hauteur() / 2, "Clic ou Espace : commencer")
    sinonsi état == "perdu":
        taille_texte(30)
        couleur("rouge clair")
        texte(largeur() / 2 - 140, hauteur() / 2 - 60, "Vaisseau détruit !")
        couleur("blanc")
        taille_texte(22)
        texte(largeur() / 2 - 130, hauteur() / 2, f"Score : {score}, vague {vague}")
        texte(largeur() / 2 - 140, hauteur() / 2 + 40, "Clic ou Espace : rejouer")

# --- La boucle du jeu ---

fonction image():
    si état == "jeu":
        si mode_souris:
            pilote_souris()
        sinon:
            pilote_clavier()
        avance_vaisseau()
        avance_tirs()
        chocs()
        choc_vaisseau()
        battement_de_cœur()
        si longueur(astéroïdes) == 0:
            vague += 1
            nouvelle_vague()
        si invincible > 0:
            invincible -= 1
        si flamme > 0:
            flamme -= 1
    # les astéroïdes dérivent même avant la partie, comme sur une borne d'arcade
    astéroïdes =: [bouge(a) pour a dans astéroïdes]
    avance_particules()
    dessine()

cache_tortue()
nouvelle_vague()
quand_souris(souris)
quand_glisse(souris)      # sur une tablette : glisser le doigt
quand_clic(clic)
quand_touche(clavier)
animer(image, 16)
