# 10. Les classes : créer ses propres objets
# soi désigne l'objet lui-même (c'est le self de Python).

classe Compte:
    def __init__(soi, titulaire, solde):
        soi.titulaire = titulaire
        soi.solde = solde

    def depose(soi, montant):
        soi.solde += montant
        retourne soi.solde

    def retire(soi, montant):
        si montant > soi.solde:
            affiche("Refusé : solde insuffisant pour", soi.titulaire)
            retourne soi.solde
        soi.solde -= montant
        retourne soi.solde

    def decris(soi):
        affiche(soi.titulaire, "possède", soi.solde, "euros")

lea = Compte("Léa", 100)
tom = Compte("Tom", 20)
lea.depose(50)
tom.retire(30)
lea.retire(30)
lea.decris()
tom.decris()

# Les erreurs : essaie / sauf
fonction divise(a, b):
    si b == 0:
        lever "division par zéro"
    retourne a / b

essaie:
    affiche(divise(10, 4))
    affiche(divise(1, 0))
sauf(e):
    affiche("Problème :", e)
