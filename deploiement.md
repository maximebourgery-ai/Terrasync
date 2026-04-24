# Terrassement.io — Guide de deploiement

## Architecture

```
admin.terrassement.io           → Votre interface admin (ce fichier)
admin.terrassement.io?portal=ID → Portail client (meme fichier, URL differente)
```

## Deploiement initial (une seule fois)

### 1. Creer un compte Netlify gratuit
→ https://app.netlify.com/signup

### 2. Deposer le fichier
→ https://app.netlify.com/drop
Glissez le ZIP genere par votre admin sur cette page.
Vous obtenez une URL type: https://xxxxx.netlify.app

### 3. Configurer votre domaine personnalise
Dans Netlify > votre site > Domain settings > Add custom domain:
- Entrez: admin.terrassement.io (ou votre domaine)
- Netlify vous donne deux options:
  A) Pointer vos DNS vers Netlify (recommande)
  B) Utiliser un sous-domaine existant

### DNS si vous avez un domaine existant (ex: terrassement.io)
Chez votre registrar (OVH, Namecheap, etc.), ajouter:
  Type: CNAME
  Nom:  admin
  Valeur: xxxxx.netlify.app (l'URL Netlify de votre site)
  TTL:  3600

Apres propagation DNS (1-24h): admin.terrassement.io fonctionne.

### DNS si vous n'avez pas de domaine
Achetez terrassement.io sur:
- OVH: ~10€/an
- Namecheap: ~10$/an
- Google Domains: ~12$/an

Puis CNAME comme ci-dessus.

## Mises a jour

Quand vous modifiez des clients/outils dans l'admin:
1. Parametres → GENERER LE FICHIER
2. Cliquez le bouton vert pour telecharger
3. Redeposes sur app.netlify.com/drop (meme URL, donnees mises a jour)

Les portails clients voient les changements immediatement
(donnees en localStorage partage sur le meme domaine).

## URLs finales

- Admin: https://admin.terrassement.io
- Portail Taleo: https://admin.terrassement.io?portal=ID_TALEO
- Le bouton "LANCER LE PORTAIL" ouvre le portail directement dans votre admin
