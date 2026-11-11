(setq FRUITS (list "Pomme" "Banane" "Fraise" "Kiwi" "Orange"))
(setq votes (list 3 5 4 1 2))
(defun dessine ()
   (
      graphique
      "camembert"
      votes
      FRUITS
      (dictionary "titre" "Les parts des votes" "zone" (list 0 70 400 530))
   )
   (
      graphique
      "colonnes"
      votes
      FRUITS
      (dictionary "titre" "Le nombre de votes" "valeurs" true "zone" (list 400 70 400 530))
   )
)
(defun vote (clef nom)
   (loop i 
      (irange 0 (longueur FRUITS) 1)
      (if (= (at FRUITS i) clef)
         (+= (at votes i) 1)
      )
   )
   (dessine)
)
(defun recommence (clef nom)
   (loop i 
      (irange 0 (longueur votes) 1)
      (set@ votes i 0)
   )
   (dessine)
)
(taille_texte 16)
(loop i 
   (irange 0 (longueur FRUITS) 1)
   (bouton (at FRUITS i) (p+ 20 (* i 110)) 20 (at FRUITS i) vote)
)
(bouton "recommencer" 610 20 "Recommencer" recommence)
(dessine)
