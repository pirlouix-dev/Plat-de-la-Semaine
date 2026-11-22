import type { MessageValue } from "../types";
import type { MessageKey } from "./en";

/** French catalogue. Typed against the English keys so it cannot drift. */
export const fr: Record<MessageKey, MessageValue> = {
  // Shared
  "common.back": "Retour",
  "common.cancel": "Annuler",
  "common.undo": "Annuler",
  "common.delete": "Supprimer",
  "common.deleting": "Suppression…",
  "common.save": "Enregistrer",
  "common.saving": "Enregistrement…",
  "common.loading": "Chargement…",
  "common.never": "Jamais",
  "common.today": "Aujourd'hui",
  "common.allSeasons": "Toutes saisons",
  "common.showPassword": "Afficher le mot de passe",
  "common.hidePassword": "Masquer le mot de passe",
  "common.showPasswordConfirmation":
    "Afficher la confirmation du mot de passe",
  "common.hidePasswordConfirmation":
    "Masquer la confirmation du mot de passe",
  "common.seeMore": "Voir plus",
  "common.seeLess": "Voir moins",
  "common.at": "{date} à {time}",

  // Courses and seasons
  "course.starter": "Entrée",
  "course.main": "Plat",
  "course.dessert": "Dessert",
  "course.starter.plural": "Entrées",
  "course.main.plural": "Plats",
  "course.dessert.plural": "Desserts",
  "season.spring": "Printemps",
  "season.summer": "Été",
  "season.autumn": "Automne",
  "season.winter": "Hiver",

  // App shell
  "app.databaseError":
    "Impossible d'initialiser la base de données locale. Rechargez la page ou contactez le support.",

  // Home
  "home.greeting": "Bonjour, {username} !",
  "home.guestMode": "Mode invité",
  "home.guestHint": "Connectez-vous pour sauvegarder vos plats",
  "home.account": "Mon compte",
  "home.signIn": "Se connecter",
  "home.menu.choose": "Choisir les plats",
  "home.menu.add": "Ajouter un plat",
  "home.menu.edit": "Modifier un plat",
  "home.menu.settings": "Paramètres",

  // Login
  "login.title": "Connexion",
  "login.noAccount": "Vous souhaitez créer un compte ?",
  "login.registerLink": "S'inscrire",
  "login.email": "Email",
  "login.password": "Mot de passe",
  "login.forgotPassword": "Mot de passe oublié ?",
  "login.sending": "Envoi en cours…",
  "login.signingIn": "Connexion...",
  "login.submit": "Se connecter",
  "login.continueWithoutAccount": "Continuer sans compte",
  "login.invalidEmail": "Veuillez entrer une adresse email valide.",
  "login.resetSent":
    "Si ce compte existe, un email de réinitialisation a été envoyé. Il se situe probablement dans vos spams.",

  // Register
  "register.title": "Inscription",
  "register.haveAccount": "Vous avez déjà un compte ?",
  "register.loginLink": "Se connecter",
  "register.username": "Nom d'utilisateur",
  "register.email": "Email",
  "register.password": "Mot de passe",
  "register.confirmPassword": "Confirmer le mot de passe",
  "register.passwordMismatch": "Les mots de passe ne correspondent pas.",
  "register.submitting": "Inscription...",
  "register.submit": "S'inscrire",

  // Add dish
  "add.title": "Ajouter un plat",
  "add.name": "Nom du plat",
  "add.description": "Description, conseils de préparation ou ingrédients...",
  "add.submit": "Sauvegarder",
  "add.success": "Plat ajouté avec succès",
  "add.error": "Erreur lors de la création",

  // Edit dish
  "edit.title": "Modifier un plat",
  "edit.search": "Rechercher par nom ou ingrédient...",
  "edit.toggleFilters": "Afficher/masquer les filtres",
  "edit.noResults": "Aucun plat ne correspond à vos critères.",
  "edit.detailTitle": "Édition : {name}",
  "edit.backToList": "Retour à la liste",
  "edit.deleteDish": "Supprimer ce plat",
  "edit.save": "Sauvegarder",
  "edit.saving": "Sauvegarde...",
  "edit.noSelectionTitle": "Aucun plat sélectionné",
  "edit.noSelectionHint":
    "Choisissez un plat dans la liste de gauche pour modifier ses ingrédients, sa saison ou sa catégorie.",
  "edit.deleteTitle": "Supprimer le plat ?",
  "edit.deleteConfirm": "Voulez-vous vraiment supprimer « {name} » ?",
  "edit.irreversible": "Cette action est irréversible.",
  "edit.saveSuccess": "Plat modifié avec succès",
  "edit.saveError": "Erreur lors de la sauvegarde",
  "edit.deleteSuccess": "Plat supprimé",
  "edit.deleteError": "Erreur lors de la suppression",

  // Choose dishes
  "choose.title.editing": "Choisir les plats",
  "choose.title.saved": "Plats sauvegardés",
  "choose.reset": "Réinitialiser",
  "choose.resetAria": "Réinitialiser les plats",
  "choose.conflict.title": "Un menu a été enregistré sur un autre appareil.",
  "choose.conflict.keep": "Garder mon menu",
  "choose.conflict.load": "Charger le menu distant",
  "choose.conflict.remoteEmpty": "La version distante est vide.",
  "choose.conflict.remoteEmptyOn": "La version distante du {date} est vide.",
  "choose.conflict.remoteDishes": {
    one: "La version distante contient {count} plat.",
    other: "La version distante contient {count} plats.",
  },
  "choose.conflict.remoteDishesOn": {
    one: "La version distante du {date} contient {count} plat.",
    other: "La version distante du {date} contient {count} plats.",
  },
  "choose.proposedDish": "Plat proposé",
  "choose.reject": "✕ Refuser",
  "choose.accept": "✓ Accepter",
  "choose.loading": "Chargement des plats…",
  "choose.empty": "Aucun plat disponible.",
  "choose.addDish": "Ajouter un plat",
  "choose.noneInSeason": "🍂 Aucun plat de saison pour le moment.",
  "choose.reviewComplete": "Tous les plats ont été passés en revue.",
  "choose.selectedTitle": "Plats sélectionnés ({count})",
  "choose.noneAccepted": "Aucun plat accepté pour l'instant.",
  "choose.summary": "Récapitulatif",
  "choose.counters.starters": "🥗 Entrées",
  "choose.counters.mains": "🍽️ Plats",
  "choose.counters.desserts": "🍰 Desserts",
  "choose.validate": "Valider ({count})",
  "choose.recapCategory": "{label} ({count})",
  "choose.editDishes": "Modifier les plats",
  "choose.resetTitle": "Réinitialiser la liste ?",
  "choose.resetConfirm":
    "Voulez-vous vraiment effacer tous les plats sélectionnés et repartir de zéro ?",
  "choose.resetIrreversible": "Cette action est irréversible.",
  "choose.resetYes": "Oui, réinitialiser",

  // Settings — shell and tabs
  "settings.title": "Paramètres",
  "settings.tab.account": "Mon compte",
  "settings.tab.data": "Données & Plats",
  "settings.tab.bugs": "Signaler un bug",
  "settings.tab.language": "Langue",
  "settings.tab.info": "À propos",
  "settings.loginPrompt": "Connectez-vous pour accéder à cette section.",
  "settings.signIn": "Se connecter",

  // Settings — language
  "settings.language.title": "Langue",
  "settings.language.description":
    "Choisissez la langue de l'application. Le changement s'applique immédiatement.",
  "settings.language.label": "Langue de l'application",

  // Settings — account
  "settings.account.profile": "Profil utilisateur",
  "settings.account.username": "Nom d'utilisateur",
  "settings.account.usernameUpdated": "Nom d'utilisateur mis à jour",
  "settings.account.security": "Sécurité",
  "settings.account.signOut": "Se déconnecter",
  "settings.account.resetPassword": "Réinitialiser le mot de passe",
  "settings.account.resetPasswordSending": "Envoi en cours…",
  "settings.account.resetEmailSent":
    "Email de réinitialisation envoyé. Il se situe probablement dans vos spams.",
  "settings.account.dangerZone": "Zone de danger",
  "settings.account.deleteWarning":
    "Cette action est irréversible. Toutes vos données seront supprimées.",
  "settings.account.deleteAccount": "Supprimer le compte",
  "settings.account.deleteTitle": "Supprimer le compte ?",
  "settings.account.deleteConfirm":
    "Voulez-vous vraiment supprimer votre compte et toutes vos données ?",
  "settings.account.deleteIrreversible": "Cette action est irréversible.",

  // Settings — data
  "settings.data.syncTitle": "Synchronisation",
  "settings.data.syncDescription":
    "Recharge tous vos plats depuis le serveur si vous pensez qu'ils ne sont plus à jour.",
  "settings.data.lastSync": "Dernière synchronisation : {value}",
  "settings.data.syncing": "Synchronisation en cours…",
  "settings.data.refreshing": "Rafraîchissement…",
  "settings.data.refresh": "Rafraîchir les plats depuis le serveur",
  "settings.data.databaseUnavailable":
    "Base de données indisponible. Réessayez dans un instant.",
  "settings.data.refreshSuccess": "Plats rafraîchis depuis le serveur",
  "settings.data.refreshFailed":
    "Le rafraîchissement des plats a échoué. Réessayez plus tard.",
  "settings.data.refreshOffline":
    "Vous êtes hors ligne. Réessayez une fois reconnecté.",
  "settings.data.importExport": "Importer / Exporter des plats",
  "settings.data.importExportDescription":
    "Importez plusieurs plats d'un coup depuis un fichier JSON, ou exportez tous vos plats dans un fichier JSON.",
  "settings.data.importing": "Importer depuis un fichier JSON…",
  "settings.data.import": "Importer depuis un fichier JSON",
  "settings.data.exporting": "Export en cours…",
  "settings.data.export": "Exporter dans un fichier JSON",
  "settings.data.importReadError": "Impossible de lire le fichier.",
  "settings.data.importEmpty": "Aucun plat valide dans le fichier.",
  "settings.data.importError": "Erreur lors de l'import",
  "settings.data.importSaved": {
    one: "{count} plat enregistré localement",
    other: "{count} plats enregistrés localement",
  },
  "settings.data.importImported": {
    one: "{count} plat importé",
    other: "{count} plats importés",
  },
  "settings.data.importFailed": {
    one: "{count} en échec",
    other: "{count} en échec",
  },
  "settings.data.importSyncIncomplete": "synchronisation incomplète",
  "settings.data.exportEmpty": "Aucun plat à exporter.",
  "settings.data.exportError": "Erreur lors de l'export",
  "settings.data.exported": {
    one: "{count} plat exporté",
    other: "{count} plats exportés",
  },
  "settings.data.backupTitle": "Restauration des données",
  "settings.data.backupDescription":
    "Sauvegardes automatiques, créées avant chaque modification.",
  "settings.data.backupsLoading": "Chargement…",
  "settings.data.backupsEmpty": "Aucune sauvegarde disponible.",
  "settings.data.backupDishes": {
    one: "{count} plat",
    other: "{count} plats",
  },
  "settings.data.restore": "Restaurer",
  "settings.data.restoring": "Restauration…",
  "settings.data.restoreSuccess": "Sauvegarde restaurée avec succès",
  "settings.data.atTime": "à {time}",

  // Settings — bugs
  "settings.bugs.title": "Signaler un bug",
  "settings.bugs.description":
    "Décrivez le problème rencontré pour nous aider à le résoudre :",
  "settings.bugs.guidelineBefore":
    "Ce que vous faisiez juste avant l'incident",
  "settings.bugs.guidelineFrequency":
    "Si le comportement est systématique ou occasionnel",
  "settings.bugs.placeholder":
    "Lorsque j'accepte plusieurs plats très rapidement...",
  "settings.bugs.sending": "Envoi…",
  "settings.bugs.submit": "Envoyer le rapport",
  "settings.bugs.success": "Rapport envoyé, merci !",

  // Settings — info
  "settings.info.title": "Informations sur l'application",
  "settings.info.version": "Version de l'application",
  "settings.info.lastSync": "Dernière synchronisation",

  // Sync status
  "sync.offline": "Vous êtes hors ligne • synchronisation impossible",
  "sync.syncing": "Synchronisation en cours…",
  "sync.failedRetry": "Échec de la synchronisation • Tentative n°{count}",
  "sync.failed": "Échec de la synchronisation",
  "sync.synced": "Vos plats sont synchronisés • {age}",
  "sync.waiting": "Synchronisation en attente…",
  "sync.age.now": "à l'instant",
  "sync.age.minutes": {
    one: "il y a {count} min",
    other: "il y a {count} min",
  },
  "sync.age.hours": {
    one: "il y a {count} h",
    other: "il y a {count} h",
  },
  "sync.age.days": {
    one: "il y a {count} j",
    other: "il y a {count} j",
  },

  // API errors — backend codes
  "errors.generic": "Une erreur est survenue.",
  "errors.serverWarmup":
    "Le serveur est en cours de démarrage et sera disponible dans quelques secondes. Veuillez réessayer.",
  "errors.network":
    "Impossible de contacter le serveur. Vérifiez votre connexion Internet.",
  "errors.server":
    "Le serveur a rencontré une erreur. Veuillez réessayer plus tard.",
  "errors.sessionExpired": "Votre session a expiré. Veuillez vous reconnecter.",
  "errors.forbidden":
    "Vous n'avez pas l'autorisation d'effectuer cette action.",
  "errors.rateLimited": "Trop de requêtes. Veuillez réessayer plus tard.",
  "errors.serviceUnavailable":
    "Le service est temporairement indisponible. Veuillez réessayer dans quelques instants.",
  "errors.emailExists":
    "Un compte existe déjà avec cette adresse email.",
  "errors.invalidEmail": "L'adresse email est invalide.",
  "errors.invalidCredentials": "Email ou mot de passe incorrect.",
  "errors.userDisabled": "Ce compte est désactivé.",
  "errors.tooManyAttempts":
    "Trop de tentatives. Veuillez réessayer plus tard.",
  "errors.authFailed": "L'authentification a échoué. Veuillez réessayer.",
  "errors.validation":
    "Certaines informations sont invalides. Vérifiez votre saisie.",
  "errors.notFound": "L'élément demandé est introuvable.",
  "errors.badRequest": "La demande n'a pas pu être traitée.",
  "errors.invalidOperation": "L'opération n'a pas pu être effectuée.",
  "errors.menuVersionConflict":
    "Le menu a été modifié sur un autre appareil. Il a été actualisé.",
  "errors.versionMismatch":
    "Mettez à jour l'application pour envoyer un signalement.",
  "errors.reportRateLimited":
    "Trop de signalements envoyés. Veuillez réessayer plus tard.",
  "errors.reportFailed":
    "Le signalement n'a pas pu être envoyé. Veuillez réessayer plus tard.",
  "errors.missingConfig":
    "Le service est indisponible. Veuillez réessayer plus tard.",

  // Dish import validation
  "import.invalidJson": "Le fichier n'est pas un JSON valide.",
  "import.notArray": "Le JSON doit contenir un tableau de plats.",
  "import.error.notObject": "L'élément doit être un objet",
  "import.error.nameRequired": "Le nom est requis",
  "import.error.nameTooLong":
    "Le nom ne doit pas dépasser {max} caractères",
  "import.error.descriptionType":
    "La description doit être une chaîne de caractères",
  "import.error.descriptionTooLong":
    "La description ne doit pas dépasser {max} caractères",
  "import.error.invalidCourse":
    "Le type de plat doit être 0 (entrée), 1 (plat) ou 2 (dessert)",
  "import.error.seasonsRequired": "Au moins une saison est requise",
  "import.error.invalidSeasons": "Les saisons doivent être comprises entre 0 et 3",
};
