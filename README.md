# TerrasyncAutomation

Plateforme SaaS IA de recrutement — hébergée sur Cloudflare Pages, base de données Supabase.

## Stack technique

- **Hébergement** : Cloudflare Pages
- **Base de données** : Supabase (PostgreSQL + Realtime)
- **API IA** : Anthropic Claude (proxied via Cloudflare Functions)
- **Auth** : PBKDF2 (Web Crypto API) + tokens de session
- **Frontend** : Vanilla JavaScript, CSS inline, sans framework

## Structure

```
/
├── app.html              # Application portail client
├── admin-platform.html   # Interface d'administration
├── index.html            # Landing page
├── login.html            # Connexion
├── functions/api/
│   ├── _shared.js        # Helpers CORS/JSON partagés
│   ├── anthropic.js      # Proxy Anthropic + Supabase + crédits
│   └── find-portal.js    # Authentification portail (PBKDF2)
├── blog/                 # Articles SEO
└── setup.sql             # Schéma base de données Supabase
```

## Variables d'environnement (Cloudflare Pages)

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Clé API Anthropic |
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_KEY` | Clé service Supabase (service_role) |

## Déploiement

1. Connecter le dépôt GitHub à Cloudflare Pages
2. Configurer les variables d'environnement ci-dessus
3. Initialiser la base de données avec `setup.sql` dans Supabase SQL Editor
