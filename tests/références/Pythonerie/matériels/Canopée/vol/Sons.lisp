(defun millisecondes ()
   (setq (h m s ms) (heure))
   (return (p+ (* (p+ (* (p+ (* h 60) m) 60) s) 1000) ms))
)
(defun teste_audio ()
   (setg sons_actifs true)
   (joue_son son_départ)
)
(setq sons_actifs true)
(setq bruitages (dictionary))
(setq derniers_sons (dictionary))
(defun initialise_audio ()
   (setg bruitages
      (dictionary
         "tir"
         son_tir
         "ennemi"
         son_ennemi
         "explosion"
         son_explosion
         "bombe"
         son_bombe
         "impact"
         son_impact
         "bonus"
         son_bonus
         "missile"
         son_missile
         "poussée"
         son_poussée
         "départ"
         son_départ
         "fin"
         son_fin
         "pause"
         son_pause
         "secours"
         son_secours
         "soin"
         son_soin
      )
   )
)
(defun bruit (nom)
   (if (¬ sons_actifs)
      (return ())
   )
   (setq (h m s ms) (heure))
   (setq maintenant (p+ (* (p+ (* (p+ (* h 60) m) 60) s) 1000) ms))
   (setq délai 140)
   (if (orvalue (= nom "missile") (= nom "poussée"))
      (setq délai 650)
   )
   (check (in_it derniers_sons nom)
      (setq écart (- maintenant (at derniers_sons nom)))
      (if (andvalue (>= écart 0) (< écart délai))
         (return ())
      )
   )
   (set@ derniers_sons nom maintenant)
   (joue_son (at bruitages nom))
)
