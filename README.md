# Plateforme de Messagerie

Une plateforme web moderne de messagerie avec gestion de documents (images, PDF, vidéos) construite avec Next.js, Supabase et Tailwind CSS.

## 🚀 Fonctionnalités

### Rôle ADMIN
- ✅ Gérer les utilisateurs (ajouter, modifier, supprimer)
- ✅ Envoyer des messages aux utilisateurs
- ✅ Envoyer des fichiers (images, PDF, vidéos)
- ✅ Créer et gérer un groupe commun
- ✅ Consulter tous les messages des utilisateurs
- ✅ Dashboard avec statistiques

### Rôle USER
- ✅ Envoyer des messages à l'ADMIN uniquement
- ✅ Envoyer des fichiers (images, PDF, vidéos)
- ✅ Consulter les messages de l'admin individuellement
- ✅ Consulter le groupe commun (lecture seule)

## 🛠️ Technologies

- **Next.js 16** - Framework React
- **Supabase** - Backend (PostgreSQL + Auth + Storage + Realtime)
- **Tailwind CSS** - Styling
- **shadcn/ui** - Composants UI
- **TypeScript** - Typage statique

## 📦 Installation

1. **Cloner le projet**
```bash
git clone <repository-url>
cd designmn
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer les variables d'environnement**
Créez un fichier `.env.local` à la racine du projet :
```env
NEXT_PUBLIC_SUPABASE_URL=votre-url-supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-clé-anon-supabase
```

4. **Lancer le serveur de développement**
```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

## 🗄️ Base de données

La base de données est déjà configurée avec :
- Table `user_profiles` - Profils utilisateurs avec rôles
- Table `conversations` - Conversations individuelles et groupe
- Table `conversation_participants` - Participants aux conversations
- Table `messages` - Messages
- Table `message_files` - Fichiers attachés

Un bucket Storage `message-files` est configuré pour stocker les fichiers.

## 📝 Structure du projet

```
app/
  (auth)/
    login/          # Page de connexion
  (dashboard)/
    dashboard/      # Dashboard principal
    messages/       # Interface de messagerie
    group/          # Groupe commun
    users/          # Gestion des utilisateurs (ADMIN)
components/
  messages/         # Composants de messagerie
  users/           # Composants de gestion utilisateurs
  ui/              # Composants UI (shadcn/ui)
lib/
  supabase/        # Configuration Supabase
```

## 🔐 Authentification

L'authentification est gérée par Supabase Auth. Les utilisateurs peuvent se connecter avec email/password.

**Note importante** : Pour créer le premier utilisateur ADMIN, vous devez :
1. Créer un compte via l'interface Supabase Auth
2. Mettre à jour manuellement le rôle dans la table `user_profiles` en ADMIN

## 📱 Responsive

L'interface est entièrement responsive et s'adapte aux différentes tailles d'écran.

## 🎨 Design

- Interface moderne et minimaliste
- Palette de couleurs neutres avec touches colorées
- Composants UI cohérents (shadcn/ui)
- Support du mode sombre

## 📄 License

MIT