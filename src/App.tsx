import { Routes, Route, Navigate } from "react-router-dom";
import { DatabaseProvider, useDatabase } from "./db/DatabaseContext";
import { useSync } from "./hooks/useSync";
import { ToastProvider } from "./components/Toast";

import "./App.css";
import HomePage from "./pages/HomePage/HomePage";
import ChooseDishesPage from "./pages/ChooseDishesPage/ChooseDishesPage";
import AddDishPage from "./pages/AddDishPage/AddDishPage";
import EditDishPage from "./pages/EditDishPage/EditDishPage";
import SettingsPage from "./pages/SettingsPage/SettingsPage";
import RegisterPage from "./pages/RegisterPage/RegisterPage";
import LoginPage from "./pages/LoginPage/LoginPage";
import LogoutPage from "./pages/LogoutPage/LogoutPage";

function DatabaseError() {
  return (
    <div className="app-container">
      <p className="status-message status-error">
        Impossible d'initialiser la base de données locale. Rechargez la page ou
        contactez le support.
      </p>
    </div>
  );
}

function AppContent() {
  const { error } = useDatabase();
  useSync();

  if (error) {
    return <DatabaseError />;
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/choose" element={<ChooseDishesPage />} />
      <Route path="/add" element={<AddDishPage />} />
      <Route path="/edit" element={<EditDishPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/logout" element={<LogoutPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <DatabaseProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </DatabaseProvider>
  );
}

export default App;
