(setq GENRES
   (list
      "colonnes"
      "barres"
      "colonnes_empilées"
      "barres_empilées"
      "courbes"
      "aires"
      "aires_empilées"
      "camembert"
      "anneau"
      "nuage"
      "bulles"
      "radar"
      "répartition"
      "boîte"
      "cascade"
      "entonnoir"
      "mosaïque"
   )
)
(setq ZONE (list 0 60 800 540))
(setq mois (list "Janv." "Févr." "Mars" "Avril" "Mai" "Juin"))
(setq ventes (list 120 135 160 150 190 210))
(setq achats (list 80 95 90 120 110 140))
(setq notes (list 12 15 8 9 14 17 11 10 13 12 16 18 7 11 12 14 9 13 15 10))
(defun montre (genre)
   (setq o (dictionary "zone" ZONE "séries" (list "Ventes" "Achats")))
   (if (= genre "colonnes")
      (block
         (set@ o "titre" "Ventes et achats du semestre")
         (set@ o "axe_y" "euros")
         (graphique genre (list ventes achats) mois o)
      )
      (if (= genre "barres")
         (block
            (set@ o "titre" "Ventes du semestre")
            (set@ o "valeurs" true)
            (graphique genre ventes mois o)
         )
         (if (orvalue (= genre "colonnes_empilées") (= genre "aires_empilées"))
            (block (set@ o "titre" "Ventes et achats, empilés") (graphique genre (list ventes achats) mois o))
            (if (= genre "barres_empilées")
               (block
                  (set@ o "titre" "Part des ventes et des achats, chaque mois")
                  (set@ o "pourcentage" true)
                  (graphique genre (list ventes achats) mois o)
               )
               (if (= genre "courbes")
                  (block (set@ o "titre" "Ventes et achats") (graphique genre (list ventes achats) mois o))
                  (if (= genre "aires")
                     (block (set@ o "titre" "Ventes du semestre") (graphique genre ventes mois o))
                     (if (orvalue (= genre "camembert") (= genre "anneau"))
                        (block
                           (set@ o "titre" "Les animaux de la classe")
                           (graphique genre (list 9 6 4 3 2) (list "Chats" "Chiens" "Lapins" "Poissons" "Oiseaux") o)
                        )
                        (if (= genre "nuage")
                           (block
                              (set@ o "titre" "Taille et poids")
                              (set@ o "axe_x" "taille (cm)")
                              (set@ o "axe_y" "poids (kg)")
                              (set@ o "tendance" true)
                              (
                                 graphique
                                 genre
                                 (list
                                    (list 150 45)
                                    (list 160 52)
                                    (list 165 60)
                                    (list 170 63)
                                    (list 175 70)
                                    (list 180 72)
                                    (list 185 80)
                                    (list 158 50)
                                    (list 172 68)
                                 )
                                 o
                              )
                           )
                           (if (= genre "bulles")
                              (block
                                 (set@ o "titre" "Pays : habitants (millions), surface et villes")
                                 (set@ o "axe_x" "nombre de grandes villes")
                                 (set@ o "axe_y" "surface (milliers de km²)")
                                 (
                                    graphique
                                    genre
                                    (list (list 10 550 68) (list 8 500 48) (list 9 300 59) (list 12 357 84) (list 3 41 9))
                                    o
                                 )
                              )
                              (if (= genre "radar")
                                 (block
                                    (set@ o "titre" "Le héros et le dragon")
                                    (set@ o "séries" (list "Héros" "Dragon"))
                                    (
                                       graphique
                                       genre
                                       (list (list 8 6 9 4 7) (list 5 9 6 8 6))
                                       (list "Vitesse" "Force" "Agilité" "Magie" "Défense")
                                       o
                                    )
                                 )
                                 (if (= genre "répartition")
                                    (block
                                       (set@ o "titre" "Répartition des notes de la classe")
                                       (set@ o "axe_x" "note sur 20")
                                       (graphique genre notes o)
                                    )
                                    (if (= genre "boîte")
                                       (block
                                          (set@ o "titre" "Les notes de trois classes")
                                          (
                                             graphique
                                             genre
                                             (list notes (list 5 8 9 10 11 12 20) (list 14 15 15 16 17 18 19))
                                             (list "Classe A" "Classe B" "Classe C")
                                             o
                                          )
                                       )
                                       (if (= genre "cascade")
                                          (block
                                             (set@ o "titre" "L'argent de poche du mois")
                                             (
                                                graphique
                                                genre
                                                (list 50 -12 20 -8 -15)
                                                (list "Départ" "Cinéma" "Anniversaire" "Bonbons" "Livre")
                                                o
                                             )
                                          )
                                          (if (= genre "entonnoir")
                                             (block
                                                (set@ o "titre" "Du visiteur au client")
                                                (graphique genre (list 1000 600 350 120) (list "Visiteurs" "Inscrits" "Actifs" "Clients") o)
                                             )
                                             (check (= genre "mosaïque")
                                                (set@ o "titre" "Les langues parlées dans l'école")
                                                (
                                                   graphique
                                                   genre
                                                   (list 40 25 15 10 6 4)
                                                   (list "Français" "Arabe" "Espagnol" "Portugais" "Anglais" "Coréen")
                                                   o
                                                )
                                             )
                                          )
                                       )
                                    )
                                 )
                              )
                           )
                        )
                     )
                  )
               )
            )
         )
      )
   )
)
(defun choisi (clef genre)
   (montre genre)
)
(fond "blanc")
(taille_texte 18)
(texte 20 20 "Genre :")
(liste_déroulante "genre" 100 16 GENRES choisi)
(montre "colonnes")
