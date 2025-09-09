# Frontend de test - Devosphere-Core

Ce mini frontend permet de tester rapidement l'API Devosphere-Core en local.

## Prérequis
- API lancée en local sur `http://localhost:3000` (ou adapter l'URL)
- Navigateur moderne (Chrome, Edge, Firefox)

## Utilisation
1. Ouvrir le fichier `test-frontend/index.html` dans votre navigateur (double-clic suffit).
2. Dans le champ "Base API", renseignez la base de l'API (par défaut `http://localhost:3000/api/v1`).
3. Utilisez les cartes pour:
   - Inscrire un utilisateur (Register)
   - Se connecter (Login)
   - Rafraîchir un token (Refresh)
   - Se déconnecter (Logout)
   - Vérifier le profil (GET /profile)
   - Tester la route admin (GET /admin)
   - Lister les utilisateurs (GET /users)
4. Les réponses JSON s'affichent dans les blocs sous chaque action.

## Notes
- Les tokens sont affichés de manière abrégée pour éviter de saturer l'écran.
- Pour accéder aux routes protégées, vous devez d'abord vous connecter (Login).
- La route `/admin` nécessite un utilisateur avec rôle `admin`.
- Les CORS doivent autoriser l'origine `file://` si vous rencontrez des blocages (sinon, envisager de servir le fichier via un petit serveur statique local).

## Dépannage
- Erreurs CORS: vérifiez la variable d'environnement `CORS_ORIGINS` ou servez `index.html` via un serveur local:
  - PowerShell: `npx serve test-frontend` (puis ouvrez l'URL indiquée)
- API non joignable: assurez-vous que l'API est démarrée et que l'URL est correcte dans l'interface.
