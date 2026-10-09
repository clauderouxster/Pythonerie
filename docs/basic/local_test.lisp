;Date: 09/10/2026
;Author: Claude Roux
;Description: Test


(load (+ _current "basic.lisp")) 
(load (+ _current "transpiler.lisp"))


(setq code `

a = """ ceci
est un test
"""
`)
 

(setq pythonmode true)
(println . prettify  . abstract_tree code)
(prettify . compilepython code) ; -> (setq a (* (/ 8 2) 4)) (setq a (+ 8 (* 2 9) 5)) (setq a (+ 8 (* a 2)))


(setq a `ceci est 
un test`)

(setq l (list a))




