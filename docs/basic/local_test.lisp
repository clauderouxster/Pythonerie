;Date: 09/10/2026
;Author: Claude Roux
;Description: Test


(load (+ _current "basic.lisp")) 
(load (+ _current "transpiler.lisp"))


(setq code `
si a < 20:
    affiche("Oui")
`)


(setq pythonmode true)
(setq ic (injecte_labels code))
(println ic)
(println (prettify . abstract_tree ic))
;(prettify . compilepython code) ; -> (setq a (* (/ 8 2) 4)) (setq a (+ 8 (* 2 9) 5)) (setq a (+ 8 (* a 2)))

