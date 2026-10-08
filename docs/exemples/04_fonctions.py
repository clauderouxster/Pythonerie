# 4. Les fonctions
# Une fonction regroupe des instructions et peut renvoyer un résultat.

fonction aire_rectangle(largeur, hauteur):
    retourne largeur * hauteur

affiche("Aire :", aire_rectangle(5, 3))

# Une fonction peut s'appeler elle-même : c'est la récursivité
fonction factorielle(n):
    si n <= 1:
        retourne 1
    retourne n * factorielle(n - 1)

pour i dans intervalle(1, 8):
    affiche(i, "! =", factorielle(i))

# def est un synonyme de fonction
def fibonacci(n):
    a = 0
    b = 1
    pour i dans intervalle(n):
        a, b = b, a + b
    retourne a

affiche("Les 15 premiers nombres de Fibonacci :")
affiche([fibonacci(i) pour i dans intervalle(15)])

# Une fonction qui porte le nom d'une fonction de la bibliothèque la remplace
fonction somme(liste):
    total = 0
    pour x dans liste:
        total += x
    retourne total

affiche("Ma somme :", somme([4, 8, 15, 16, 23, 42]))
