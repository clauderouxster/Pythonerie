# 3. Les boucles : pour et tantque

# pour ... dans : répéter pour chaque valeur
affiche("Table de 7 :")
pour i dans intervalle(1, 11):
    affiche(i, "x 7 =", i * 7)

# On parcourt aussi une liste
fruits = ["pomme", "poire", "cerise"]
pour fruit dans fruits:
    affiche("J'aime les", fruit + "s")

# tantque : répéter tant qu'une condition est vraie
n = 1
tantque n < 1000:
    n = n * 2
affiche("Première puissance de 2 au-delà de 1000 :", n)

# sortir quitte la boucle, continuer passe au tour suivant
pour i dans intervalle(10):
    si i == 3:
        continuer
    si i == 7:
        sortir
    affiche("i =", i)
