(defun maintenant ()
   (setq (h m s ms) (heure))
   (return (p+ (* (p+ (* (p+ (* h 60) m) 60) s) 1000) ms))
)
(setq n 100000)
(setq ordinaire (mapcar (λ (i) (_% (* i 7919) 10007)) (irange 0 n 1)))
(setq typée (integers ordinaire))
(defun chronomètre (liste)
   (setq temps (list))
   (setq t (maintenant))
   (loop k 
      (irange 0 100 1)
      (setq trouvée (in_it liste -5))
   )
   (push temps (- (maintenant) t))
   (setq t (maintenant))
   (loop k 
      (irange 0 100 1)
      (setq total (somme liste))
   )
   (push temps (- (maintenant) t))
   (setq t (maintenant))
   (loop k 
      (irange 0 100 1)
      (setq morceau (extract liste 10 75000))
   )
   (push temps (- (maintenant) t))
   (setq t (maintenant))
   (loop k 
      (irange 0 100 1)
      (setq double (p+ liste liste))
   )
   (push temps (- (maintenant) t))
   (return temps)
)
(setq opérations (list "dans" "somme" "tranche" "liste + liste"))
(setq temps_ordinaire (chronomètre ordinaire))
(setq temps_typée (chronomètre typée))
(
   graphique
   "colonnes"
   (list temps_ordinaire temps_typée)
   opérations
   (dictionary
      "titre"
      "100 fois la même opération sur 100 000 valeurs"
      "séries"
      (list "liste ordinaire" "liste d'entiers")
      "axe_y"
      "millisecondes"
      "valeurs"
      true
   )
)
(println "opération : liste ordinaire, liste d'entiers (en millisecondes)")
(loop i 
   (irange 0 (size opérations) 1)
   (println
      (+
         (_texte (at opérations i))
         " : "
         (_texte (at temps_ordinaire i))
         ", "
         (_texte (at temps_typée i))
      )
   )
)
(setq notes (integers 12 15 9))
(push notes 18)
(println
   (_texte notes)
   (_texte (somme notes))
   (_texte (in_it notes 15))
   (_texte (trie notes))
   (_texte (extract notes 1))
)
(println (_texte (numbers 1 2.5)) (_texte (strings "b" "a")))
(push notes 2.7)
(push notes "abc")
(println "après ajoute(2.7) et ajoute(\"abc\") :" (_texte notes))
