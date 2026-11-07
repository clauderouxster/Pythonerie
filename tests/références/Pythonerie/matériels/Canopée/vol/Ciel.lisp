(loop rang 
   (intervalle 2)
   (loop j 
      (intervalle 13)
      (setq x (p+ -240 (* j 40) (* rang 13)))
      (setq h (p+ 22 (aléatoire 0 12)))
      (setq teinte (if (= rang 0) "#8da7aa" "#6d8c8a"))
      (setq relief_lointain
         (
            cône
            scène
            x
            (p+ (+ (/ (sign h) 2) 8) (* rang 2))
            (p+ -226 (* rang 24))
            (p+ 32 (aléatoire 0 10))
            h
            teinte
         )
      )
      (lumineux relief_lointain)
   )
)
(setq ciel (groupe scène 0 2.15 2.2))
(oriente_3d ciel 10.38 0 0)
(setq voûte (groupe ciel 0 -81.3 -248.9))
(oriente_3d voûte -20.56 0 0)
(loop bande 
   (intervalle 200)
   (setq hauteur_bande (p+ -170 (* bande 1.7)))
   (setq nuance (minimum 1 (maximum 0 (/ (- hauteur_bande 25) 110))))
   (setq rouge_ciel (entier (- 203 (* 167 nuance))))
   (setq vert_ciel (entier (- 232 (* 120 nuance))))
   (setq bleu_ciel (entier (- 249 (* 65 nuance))))
   (setq teinte_ciel (rgb rouge_ciel vert_ciel bleu_ciel))
   (setq ruban (boîte voûte 0 hauteur_bande 0 600 1.72 0.1 teinte_ciel))
   (lumineux ruban)
)
(setq soleil (sphère ciel -72 8 -145 7 "#ffdc55"))
(lumineux soleil)
(setq planètes (list))
(loop i 
   (intervalle 3)
   (setq g (groupe ciel (p+ 24 (* i 19)) (p+ 6 (* i 1.5)) -145))
   (setq globe (sphère g 0 0 0 (p+ 2.0 (* i 0.5)) (choisis (list "#79d5e4" "#e5a183" "#b3a0e4"))))
   (sphère g 0.5 0.8 1.2 1.1 "#dae9d1")
   (check (= i 1)
      (setq anneaux (groupe g 0 0 0))
      (anneau anneaux 0 0 0 3.3 4.7 "#e8ce96")
      (oriente_3d anneaux 25 0 15)
   )
   (setq lune (sphère ciel 0 0 0 0.6 "#dfdfdc"))
   (push
      planètes
      (dictionary "groupe" g "lune" lune "angle" (* i 120) "x" (p+ 24 (* i 19)) "y" (p+ 6 (* i 1.5)))
   )
)
(setq nuages (list))
(loop i 
   (intervalle 6)
   (setq x (p+ -95 (* i 36)))
   (setq y (p+ 5 (* (_% i 3) 3)))
   (setq z (- -125 (* (_% i 2) 12)))
   (setq g (groupe ciel x y z))
   (loop j 
      (intervalle 5)
      (setq rayon (if (orvalue (= j 0) (= j 4)) 2.2 3.1))
      (setq bosse (sphère g (* (- j 2) 3.1) (* (_% j 2) 1.2) 0 rayon "#ffffff"))
   )
   (push nuages (dictionary "groupe" g "x" x "y" y "z" z))
)
(defun anime_ciel (dt)
   (loop n nuages
      (+= (at n "x") (* dt 1.6))
      (if (> (at n "x") 115)
         (set@ n "x" -115)
      )
      (déplace (at n "groupe") (at n "x") (at n "y") (at n "z"))
   )
   (loop p planètes
      (+= (at p "angle") (* dt 24))
      (tourne (at p "groupe") 0 (* dt 18) (* dt 3))
      (setq x (p+ (at p "x") (* (cosinus (at p "angle")) 5)))
      (setq z (p+ -145 (* (sinus (at p "angle")) 5)))
      (déplace (at p "lune") x (p+ (at p "y") (* (sinus (at p "angle")) 1.2)) z)
   )
)
