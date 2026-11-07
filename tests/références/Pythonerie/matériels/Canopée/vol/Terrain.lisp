(import "vol/Relief" ())
(import "vol/Quartiers" ())
(boîte scène 0 -1.1 -500 1800 0.6 1200 "#244c3b")
(setq terrains (list))
(setq numéro_secteur 0)
(setq noms_régions
   (list "FORÊT D'ÉMERAUDE" "LACS D'AZUR" "CULTURES DORÉES" "VILLAGES" "DÉFILÉ DES FALAISES")
)
(loop i 
   (intervalle 9)
   (setq racine_sol (groupe scène 0 0 (- 24 (* i 24))))
   (setq sol (boîte racine_sol 0 -0.8 0 320 1 24 "#244c3b"))
   (loop colonne 
      (intervalle 14)
      (setq terre (boîte racine_sol (p+ -156 (* colonne 24)) -0.32 0 24 0.08 24 "#42664a"))
      (texture terre texture_minérale)
      (colore terre "#52704c")
   )
   (loop côté 
      (list -1 1)
      (loop j 
         (intervalle 16)
         (setq x_lointain (* côté (aléatoire 34 150)))
         (setq essence_lointaine (choisis (list "sapin" "chêne" "bouleau")))
         (arbre racine_sol x_lointain -0.3 (aléatoire -11 11) essence_lointaine (aléatoire 3 6))
      )
   )
   (dessine_collines racine_sol (* i 37))
   (setq variantes (list))
   (setq forêt (groupe racine_sol 0 0 0))
   (loop j 
      (intervalle 18)
      (setq x (aléatoire -29 29))
      (setq z (aléatoire -11 11))
      (setq h (/ (aléatoire 20 45) 10))
      (setq essence (choisis (list "sapin" "chêne" "bouleau" "érable")))
      (arbre forêt x -0.3 z essence h)
   )
   (push variantes forêt)
   (setq lac (dessine_lac racine_sol (* i 37)))
   (push variantes lac)
   (setq champs (dessine_champs racine_sol (* i 37)))
   (push variantes champs)
   (setq (quartier bâtiments) (dessine_quartier racine_sol (* i 37)))
   (push variantes quartier)
   (setq (canyon parois) (dessine_falaises racine_sol (* i 37)))
   (push variantes canyon)
   (loop g variantes
      (cache_objet g)
   )
   (montre_objet forêt)
   (push
      terrains
      (dictionary
         "groupe"
         racine_sol
         "sol"
         sol
         "variantes"
         variantes
         "z"
         (- 24 (* i 24))
         "genre"
         0
         "parois"
         parois
         "bâtiments"
         bâtiments
      )
   )
)
(setq silos (list))
(loop i 
   (intervalle 7)
   (setq g (groupe scène 0 0 0))
   (cylindre g 0 0.3 0 1.5 0.6 "#777f7a")
   (cylindre g 0 0.9 0 0.9 1.2 "#34474b")
   (anneau g 0 1.55 0 0.5 0.95 "#edb94c")
   (cône g 0 1.6 0 0.35 0.8 "#f07d46")
   (push
      silos
      (dictionary "objet" g "x" (choisis (list -11 11)) "z" (- -20 (* i 27)) "tir" (* (hasard) 3))
   )
)
(defun avance_terrain (dt)
   (loop t terrains
      (+= (at t "z") (* vitesse dt))
      (check (> (at t "z") 42)
         (-= (at t "z") 216)
         (+= numéro_secteur 1)
         (setq genre (_% (_/ numéro_secteur 4) 5))
         (cache_objet . at t "variantes" (at t "genre"))
         (set@ t "genre" genre)
         (montre_objet . at t "variantes" genre)
      )
      (déplace (at t "groupe") 0 0 (at t "z"))
      (if (< (absolu (- (at t "z") pz)) 12)
         (setg région (at t "genre"))
      )
      (if (andvalue (= (at t "genre") 4) (< (absolu (- (at t "z") pz)) 18))
         (collision_falaises (at t "parois") (at t "z"))
      )
      (if (andvalue (= (at t "genre") 3) (< (absolu (- (at t "z") pz)) 18))
         (collision_falaises (at t "bâtiments") (at t "z"))
      )
   )
   (loop s silos
      (+= (at s "z") (* vitesse dt))
      (check (> (at s "z") 35)
         (set@ s "z" (- -160 (aléatoire 0 70)))
         (set@ s "x" (* (choisis (list -1 1)) (aléatoire 9 20)))
         (set@ s "tir" (* (hasard) 3))
      )
      (déplace (at s "objet") (at s "x") 0 (at s "z"))
      (-= (at s "tir") dt)
      (check (andvalue (<= (at s "tir") 0) (< -85 (at s "z") (- pz 35)))
         (lance menaces (at s "x") 1.8 (at s "z") true)
         (set@ s "tir" (+ 2.5 (* (hasard) 2)))
      )
   )
)
