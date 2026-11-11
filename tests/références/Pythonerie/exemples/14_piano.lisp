(setq noms (list "do" "do♯" "ré" "ré♯" "mi" "fa" "fa♯" "sol" "sol♯" "la" "la♯" "si"))
(setq fichiers
   (list "C" "C_sharp" "D" "D_sharp" "E" "F" "F_sharp" "G" "G_sharp" "A" "A_sharp" "B")
)
(setq blanches (list 0 2 4 5 7 9 11))
(setq nombre_de_notes 36)
(setq haut 200)
(setq hauteur_blanche 330)
(setq hauteur_noire 200)
(setq largeur_blanche (/ (largeur) 21))
(setq largeur_noire (* largeur_blanche 0.6))
(setq sons (list))
(loop n 
   (irange 0 nombre_de_notes 1)
   (setq octave (+ (_/ n 12) 3))
   (push
      sons
      (
         charge_son
         (+ "médias/sounds/piano/" (_texte (at fichiers (_% n 12))) "_" (_texte octave) ".wav")
      )
   )
)
(setq touches (list))
(setq blanches_placées 0)
(loop n 
   (irange 0 nombre_de_notes 1)
   (if (in_it blanches (_% n 12))
      (block
         (push touches (list n (* blanches_placées largeur_blanche) largeur_blanche false))
         (+= blanches_placées 1)
      )
      (push
         touches
         (list n (- (* blanches_placées largeur_blanche) (/ largeur_noire 2)) largeur_noire true)
      )
   )
)
(defun nom_de_note (n)
   (return (p+ (at noms (_% n 12)) (chaîne (+ (_/ n 12) 3))))
)
(defun dessine_clavier (appuyée)
   (fond "beige")
   (couleur "marron")
   (taille_texte 30)
   (texte 20 30 "🎹 Le piano de la Pythonerie")
   (taille_texte 16)
   (
      texte
      20
      80
      "Clique, glisse sur les touches ou joue avec q s d f g h j k (blanches) et z e t y u (noires)"
   )
   (loop t touches
      (check (¬ (at t 3))
         (if (= (at t 0) appuyée)
            (couleur "jaune")
            (couleur "blanc")
         )
         (rectangle_plein (at t 1) haut (at t 2) hauteur_blanche)
         (couleur "gris foncé")
         (épaisseur 1)
         (rectangle (at t 1) haut (at t 2) hauteur_blanche)
         (taille_texte 11)
         (texte (+ (at t 1) 5) (- (p+ haut hauteur_blanche) 22) (nom_de_note (at t 0)))
      )
   )
   (loop t touches
      (check (at t 3)
         (if (= (at t 0) appuyée)
            (couleur "orange")
            (couleur "noir")
         )
         (rectangle_plein (at t 1) haut (at t 2) hauteur_noire)
      )
   )
   (check (>= appuyée 0)
      (couleur "marron")
      (taille_texte 40)
      (texte (- (largeur) 200) 120 (nom_de_note appuyée))
   )
)
(defun touche_sous (x y)
   (if (orvalue (< y haut) (> y (p+ haut hauteur_blanche)))
      (return -1)
   )
   (if (<= y (p+ haut hauteur_noire))
      (loop t touches
         (if (andvalue (andvalue (at t 3) (>= x (at t 1))) (< x (p+ (at t 1) (at t 2))))
            (return (at t 0))
         )
      )
   )
   (loop t touches
      (if (andvalue (andvalue (¬ (at t 3)) (>= x (at t 1))) (< x (p+ (at t 1) (at t 2))))
         (return (at t 0))
      )
   )
   (return -1)
)
(defun joue (n)
   (joue_son (at sons n))
   (dessine_clavier n)
)
(setq dernière_note -1)
(defun clic (x y)
   (setq n (touche_sous x y))
   (if (>= n 0)
      (joue n)
   )
   (setg dernière_note n)
)
(defun glisse (x y)
   (setq n (touche_sous x y))
   (if (andvalue (>= n 0) (!= n dernière_note))
      (joue n)
   )
   (setg dernière_note n)
)
(setq clavier
   (dictionary
      "q"
      12
      "z"
      13
      "s"
      14
      "e"
      15
      "d"
      16
      "f"
      17
      "t"
      18
      "g"
      19
      "y"
      20
      "h"
      21
      "u"
      22
      "j"
      23
      "k"
      24
   )
)
(defun touche (t)
   (if (in_it clavier t)
      (joue (at clavier t))
   )
)
(dessine_clavier -1)
(quand_clic clic)
(quand_glisse glisse)
(quand_touche touche)
