import type { MessageValue } from "../types";

/**
 * English catalogue — the source of truth for the message key type.
 *
 * Every other locale is typed as `Record<MessageKey, MessageValue>`, so a
 * missing or misspelt key fails type-checking instead of falling back at
 * runtime. Keep placeholders in braces and use full sentences rather than
 * concatenated fragments, since word order differs between languages.
 */
export const en = {
  // Shared
  "common.back": "Back",
  "common.cancel": "Cancel",
  "common.undo": "Undo",
  "common.delete": "Delete",
  "common.deleting": "Deleting…",
  "common.save": "Save",
  "common.saving": "Saving…",
  "common.loading": "Loading…",
  "common.never": "Never",
  "common.today": "Today",
  "common.allSeasons": "All seasons",
  "common.showPassword": "Show password",
  "common.hidePassword": "Hide password",
  "common.showPasswordConfirmation": "Show password confirmation",
  "common.hidePasswordConfirmation": "Hide password confirmation",
  "common.seeMore": "See more",
  "common.seeLess": "See less",
  "common.at": "{date} at {time}",

  // Courses and seasons
  "course.starter": "Starter",
  "course.main": "Main course",
  "course.dessert": "Dessert",
  "course.starter.plural": "Starters",
  "course.main.plural": "Main courses",
  "course.dessert.plural": "Desserts",
  "season.spring": "Spring",
  "season.summer": "Summer",
  "season.autumn": "Autumn",
  "season.winter": "Winter",

  // App shell
  "app.databaseError":
    "Could not initialize the local database. Reload the page or contact support.",

  // Home
  "home.greeting": "Hello, {username}!",
  "home.guestMode": "Guest mode",
  "home.guestHint": "Sign in to save your dishes",
  "home.account": "My account",
  "home.signIn": "Sign in",
  "home.menu.choose": "Choose dishes",
  "home.menu.add": "Add a dish",
  "home.menu.edit": "Edit a dish",
  "home.menu.settings": "Settings",

  // Login
  "login.title": "Sign in",
  "login.noAccount": "Want to create an account?",
  "login.registerLink": "Register",
  "login.email": "Email",
  "login.password": "Password",
  "login.forgotPassword": "Forgot password?",
  "login.sending": "Sending…",
  "login.signingIn": "Signing in...",
  "login.submit": "Sign in",
  "login.continueWithoutAccount": "Continue without an account",
  "login.invalidEmail": "Please enter a valid email address.",
  "login.resetSent":
    "If this account exists, a reset email has been sent. It is probably in your spam folder.",

  // Register
  "register.title": "Create account",
  "register.haveAccount": "Already have an account?",
  "register.loginLink": "Sign in",
  "register.username": "Username",
  "register.email": "Email",
  "register.password": "Password",
  "register.confirmPassword": "Confirm password",
  "register.passwordMismatch": "Passwords do not match.",
  "register.submitting": "Creating account...",
  "register.submit": "Register",

  // Add dish
  "add.title": "Add a dish",
  "add.name": "Dish name",
  "add.description":
    "Description, preparation tips or ingredients...",
  "add.submit": "Save",
  "add.success": "Dish added",
  "add.error": "Could not create the dish",

  // Edit dish
  "edit.title": "Edit a dish",
  "edit.search": "Search by name or ingredient...",
  "edit.toggleFilters": "Show/hide filters",
  "edit.noResults": "No dish matches your criteria.",
  "edit.detailTitle": "Editing: {name}",
  "edit.backToList": "Back to the list",
  "edit.deleteDish": "Delete this dish",
  "edit.save": "Save",
  "edit.saving": "Saving...",
  "edit.noSelectionTitle": "No dish selected",
  "edit.noSelectionHint":
    "Choose a dish from the list on the left to edit its ingredients, season or category.",
  "edit.deleteTitle": "Delete the dish?",
  "edit.deleteConfirm":
    'Do you really want to delete "{name}"?',
  "edit.irreversible": "This action cannot be undone.",
  "edit.saveSuccess": "Dish updated",
  "edit.saveError": "Could not save the dish",
  "edit.deleteSuccess": "Dish deleted",
  "edit.deleteError": "Could not delete the dish",

  // Choose dishes
  "choose.title.editing": "Choose dishes",
  "choose.title.saved": "Saved dishes",
  "choose.reset": "Reset",
  "choose.resetAria": "Reset the dishes",
  "choose.conflict.title": "A menu was saved on another device.",
  "choose.conflict.keep": "Keep my menu",
  "choose.conflict.load": "Load remote menu",
  "choose.conflict.remoteEmpty": "The remote version is empty.",
  "choose.conflict.remoteEmptyOn":
    "The remote version from {date} is empty.",
  "choose.conflict.remoteDishes": {
    one: "The remote version contains {count} dish.",
    other: "The remote version contains {count} dishes.",
  },
  "choose.conflict.remoteDishesOn": {
    one: "The remote version from {date} contains {count} dish.",
    other: "The remote version from {date} contains {count} dishes.",
  },
  "choose.proposedDish": "Proposed dish",
  "choose.reject": "✕ Reject",
  "choose.accept": "✓ Accept",
  "choose.loading": "Loading dishes…",
  "choose.empty": "No dishes available.",
  "choose.addDish": "Add a dish",
  "choose.noneInSeason": "🍂 No dishes in season right now.",
  "choose.reviewComplete": "All dishes have been reviewed.",
  "choose.selectedTitle": "Selected dishes ({count})",
  "choose.noneAccepted": "No dish accepted yet.",
  "choose.summary": "Summary",
  "choose.counters.starters": "🥗 Starters",
  "choose.counters.mains": "🍽️ Main courses",
  "choose.counters.desserts": "🍰 Desserts",
  "choose.validate": "Confirm ({count})",
  "choose.recapCategory": "{label} ({count})",
  "choose.editDishes": "Edit dishes",
  "choose.resetTitle": "Reset the list?",
  "choose.resetConfirm":
    "Do you really want to clear all selected dishes and start over?",
  "choose.resetIrreversible": "This action cannot be undone.",
  "choose.resetYes": "Yes, reset",

  // Settings — shell and tabs
  "settings.title": "Settings",
  "settings.tab.account": "My account",
  "settings.tab.data": "Data & dishes",
  "settings.tab.bugs": "Report a bug",
  "settings.tab.language": "Language",
  "settings.tab.info": "About",
  "settings.loginPrompt": "Sign in to access this section.",
  "settings.signIn": "Sign in",

  // Settings — language
  "settings.language.title": "Language",
  "settings.language.description":
    "Choose the language used by the app. The change applies immediately.",
  "settings.language.label": "App language",

  // Settings — account
  "settings.account.profile": "User profile",
  "settings.account.username": "Username",
  "settings.account.usernameUpdated": "Username updated",
  "settings.account.security": "Security",
  "settings.account.signOut": "Sign out",
  "settings.account.resetPassword": "Reset password",
  "settings.account.resetPasswordSending": "Sending…",
  "settings.account.resetEmailSent":
    "Reset email sent. It is probably in your spam folder.",
  "settings.account.dangerZone": "Danger zone",
  "settings.account.deleteWarning":
    "This action cannot be undone. All your data will be deleted.",
  "settings.account.deleteAccount": "Delete account",
  "settings.account.deleteTitle": "Delete account?",
  "settings.account.deleteConfirm":
    "Do you really want to delete your account and all your data?",
  "settings.account.deleteIrreversible": "This action cannot be undone.",

  // Settings — data
  "settings.data.syncTitle": "Synchronization",
  "settings.data.syncDescription":
    "Reloads all your dishes from the server if you think they are out of date.",
  "settings.data.lastSync": "Last sync: {value}",
  "settings.data.syncing": "Syncing…",
  "settings.data.refreshing": "Refreshing…",
  "settings.data.refresh": "Refresh dishes from the server",
  "settings.data.databaseUnavailable":
    "Database unavailable. Try again in a moment.",
  "settings.data.refreshSuccess": "Dishes refreshed from the server",
  "settings.data.refreshFailed":
    "Could not refresh the dishes. Try again later.",
  "settings.data.refreshOffline":
    "You are offline. Try again once you are back online.",
  "settings.data.importExport": "Import / export dishes",
  "settings.data.importExportDescription":
    "Import several dishes at once from a JSON file, or export all your dishes to a JSON file.",
  "settings.data.importing": "Importing from a JSON file…",
  "settings.data.import": "Import from a JSON file",
  "settings.data.exporting": "Exporting…",
  "settings.data.export": "Export to a JSON file",
  "settings.data.importReadError": "Could not read the file.",
  "settings.data.importEmpty": "No valid dish in the file.",
  "settings.data.importError": "Import failed",
  "settings.data.importSaved": {
    one: "{count} dish saved locally",
    other: "{count} dishes saved locally",
  },
  "settings.data.importImported": {
    one: "{count} dish imported",
    other: "{count} dishes imported",
  },
  "settings.data.importFailed": {
    one: "{count} failed",
    other: "{count} failed",
  },
  "settings.data.importSyncIncomplete": "sync incomplete",
  "settings.data.exportEmpty": "No dish to export.",
  "settings.data.exportError": "Export failed",
  "settings.data.exported": {
    one: "{count} dish exported",
    other: "{count} dishes exported",
  },
  "settings.data.backupTitle": "Data restore",
  "settings.data.backupDescription":
    "Automatic backups, created before each change.",
  "settings.data.backupsLoading": "Loading…",
  "settings.data.backupsEmpty": "No backup available.",
  "settings.data.backupDishes": {
    one: "{count} dish",
    other: "{count} dishes",
  },
  "settings.data.restore": "Restore",
  "settings.data.restoring": "Restoring…",
  "settings.data.restoreSuccess": "Backup restored successfully",
  "settings.data.atTime": "at {time}",

  // Settings — bugs
  "settings.bugs.title": "Report a bug",
  "settings.bugs.description":
    "Describe the problem you encountered to help us fix it:",
  "settings.bugs.guidelineBefore":
    "What you were doing right before the issue",
  "settings.bugs.guidelineFrequency":
    "Whether the behaviour is consistent or occasional",
  "settings.bugs.placeholder":
    "When I accept several dishes very quickly...",
  "settings.bugs.sending": "Sending…",
  "settings.bugs.submit": "Send report",
  "settings.bugs.success": "Report sent, thank you!",

  // Settings — info
  "settings.info.title": "Application information",
  "settings.info.version": "App version",
  "settings.info.lastSync": "Last sync",

  // Sync status
  "sync.offline": "You are offline • syncing unavailable",
  "sync.syncing": "Syncing…",
  "sync.failedRetry": "Sync failed • Attempt {count}",
  "sync.failed": "Sync failed",
  "sync.synced": "Your dishes are synced • {age}",
  "sync.waiting": "Waiting to sync…",
  "sync.age.now": "just now",
  "sync.age.minutes": {
    one: "{count} min ago",
    other: "{count} min ago",
  },
  "sync.age.hours": {
    one: "{count} h ago",
    other: "{count} h ago",
  },
  "sync.age.days": {
    one: "{count} d ago",
    other: "{count} d ago",
  },

  // API errors — backend codes
  "errors.generic": "Something went wrong.",
  "errors.serverWarmup":
    "The server is starting up and will be available in a few seconds. Please try again.",
  "errors.network":
    "Could not reach the server. Check your internet connection.",
  "errors.server":
    "The server encountered an error. Please try again later.",
  "errors.sessionExpired": "Your session has expired. Please sign in again.",
  "errors.forbidden": "You are not allowed to perform this action.",
  "errors.rateLimited": "Too many requests. Please try again later.",
  "errors.serviceUnavailable":
    "The service is temporarily unavailable. Please try again shortly.",
  "errors.emailExists": "An account already exists with this email address.",
  "errors.invalidEmail": "The email address is invalid.",
  "errors.invalidCredentials": "Incorrect email or password.",
  "errors.userDisabled": "This account is disabled.",
  "errors.tooManyAttempts": "Too many attempts. Please try again later.",
  "errors.authFailed": "Authentication failed. Please try again.",
  "errors.validation": "Some information is invalid. Check your input.",
  "errors.notFound": "The requested item could not be found.",
  "errors.badRequest": "The request could not be processed.",
  "errors.invalidOperation": "The operation could not be completed.",
  "errors.menuVersionConflict":
    "The menu was changed on another device. It has been refreshed.",
  "errors.versionMismatch": "Update the app to send a report.",
  "errors.reportRateLimited": "Too many reports sent. Please try again later.",
  "errors.reportFailed":
    "The report could not be sent. Please try again later.",
  "errors.missingConfig":
    "The service is unavailable. Please try again later.",

  // Dish import validation
  "import.invalidJson": "The file is not valid JSON.",
  "import.notArray": "The JSON must contain an array of dishes.",
  "import.error.notObject": "The item must be an object",
  "import.error.nameRequired": "Name is required",
  "import.error.nameTooLong": "Name must not exceed {max} characters",
  "import.error.descriptionType": "Description must be a string",
  "import.error.descriptionTooLong":
    "Description must not exceed {max} characters",
  "import.error.invalidCourse":
    "Course must be 0 (starter), 1 (main course) or 2 (dessert)",
  "import.error.seasonsRequired": "At least one season is required",
  "import.error.invalidSeasons": "Seasons must be between 0 and 3",
} as const satisfies Record<string, MessageValue>;

export type MessageKey = keyof typeof en;
