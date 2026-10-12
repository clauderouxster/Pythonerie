;Date: 09/10/2026
;Author: Claude Roux
;Description: Test


(load (+ _current "basic.lisp")) 
(load (+ _current "transpiler.lisp"))


(setq code `
pour f dans dessin:
    trace(f[2], f[0], f[1], f[3], f[4], Vrai)

selon(a):
    cas "ab":
           affiche("Test")
           affiche("Truc")
    cas "bc":
           affiche("Test")
    défaut:
           affiche("Yooo")
	     affiche("Fin")
 
`)
 

(setq pythonmode true)
(setq ic (injecte_labels code))
(println ic)
;(println (prettify . abstract_tree ic))
(prettify . compilepython code) ; -> (setq a (* (/ 8 2) 4)) (setq a (+ 8 (* 2 9) 5)) (setq a (+ 8 (* a 2)))





(setq a 23)

(switch
   a
   (1 (block (println "Test") (println "Truc")))
   (23 (println "Test"))
   (true (block (println "Yooo") (println "Fin")))
)

