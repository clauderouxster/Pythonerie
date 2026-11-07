(import "vol/Missiles_embarqués" ())
(defun modèle_vaisseau (ennemi)
   (setq g (groupe scène 0 0 0))
   (setq coque (if ennemi "#368cff" "#d4e7ee"))
   (setq accent (if ennemi "#c1edff" "#62e8ff"))
   (setq corps (cylindre g 0 0 0 0.58 2.0 coque))
   (oriente_3d corps 90 0 0)
   (sphère g 0 0 -1.0 0.58 coque)
   (sphère g 0 0 1.0 0.58 coque)
   (sphère g 0 0.42 -0.35 0.48 "#234d65")
   (sphère g 0 0.64 -0.49 0.23 "#88d8e9")
   (loop côté 
      (list -1 1)
      (loop j 
         (intervalle 4)
         (setq x (* côté (+ 0.5 (* j 0.32))))
         (setq z (+ 0.16 (* j 0.23)))
         (sphère g x -0.12 z (- 0.46 (* j 0.055)) coque)
      )
      (setq moteur (cylindre g (* côté 1.05) -0.05 0.9 0.29 1.3 "#3b5267"))
      (oriente_3d moteur 90 0 0)
      (sphère g (* côté 1.05) -0.05 0.25 0.29 coque)
      (setq tuyère (groupe g (* côté 1.05) -0.05 1.57))
      (oriente_3d tuyère 90 0 0)
      (anneau tuyère 0 0 0 0.16 0.3 "#a9bfc7")
      (setq feu (sphère g (* côté 1.05) -0.05 1.68 0.19 accent))
      (lumineux feu)
      (loop j 
         (intervalle 3)
         (setq flamme (sphère g (* côté 1.05) -0.05 (+ 1.8 (* j 0.19)) (- 0.15 (* j 0.035)) accent))
         (lumineux flamme)
      )
      (setq voyant (sphère g (* côté 1.53) -0.04 0.85 0.09 accent))
      (lumineux voyant)
      (setq canon (cylindre g (* côté 0.62) -0.26 -0.78 0.1 0.85 "#475d71"))
      (oriente_3d canon 90 0 0)
   )
   (check ennemi
      (loop côté 
         (list -1 1)
         (setq balise (sphère g (* côté 0.65) 0.1 -0.95 0.19 "#fffbd0"))
         (lumineux balise)
      )
      (oriente_3d g 0 180 0)
   )
   (return g)
)
(defun modèle_missile (parent)
   (setq g (groupe parent 0 0 0))
   (cylindre g 0 0 0 0.22 1.65 "#e0e6e4")
   (cône g 0 1.1 0 0.22 0.65 "#bd4d47")
   (cylindre g 0 0.47 0 0.235 0.18 "#d4a84e")
   (cylindre g 0 -0.68 0 0.25 0.25 "#394b59")
   (loop angle 
      (list 0 90 180 270)
      (setq aileron (groupe g 0 -0.48 0))
      (oriente_3d aileron 0 angle -18)
      (boîte aileron 0.27 0 0 0.42 0.6 0.07 "#526979")
   )
   (setq flamme (groupe g 0 -0.9 0))
   (loop j 
      (intervalle 5)
      (setq feu (sphère flamme 0 (* (sign j) 0.25) 0 (- 0.21 (* j 0.035)) "#ffb851"))
      (lumineux feu)
   )
   (cache_objet g)
   (return (list g flamme))
)
(defun réserve_menaces (n)
   (setq réserve (list))
   (loop i 
      (intervalle n)
      (setq objet (groupe scène 0 0 0))
      (setq bille (sphère objet 0 0 0 0.28 "#ff663d"))
      (lumineux bille)
      (setq (fusée flamme) (modèle_missile objet))
      (setq (petite_fusée petit_jet) (modèle_missile_embarqué objet))
      (cache_objet objet)
      (push
         réserve
         (dictionary
            "objet"
            objet
            "bille"
            bille
            "fusée"
            fusée
            "flamme"
            flamme
            "petite_fusée"
            petite_fusée
            "petit_jet"
            petit_jet
            "actif"
            false
            "x"
            0
            "y"
            0
            "z"
            0
            "vx"
            0
            "vy"
            0
            "vz"
            0
            "missile"
            false
            "aérien"
            false
            "âge"
            0
            "cap"
            0
         )
      )
   )
   (return réserve)
)
