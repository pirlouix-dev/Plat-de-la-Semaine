import { Routes, Route } from "react-router-dom";
import { DatabaseProvider, useDatabase } from "./db/DatabaseContext";
import { useSync } from "./hooks/useSync";

import "./App.css";
import MainMenuPage from "./pages/MainMenuPage";
import ChooseMenuPage from "./pages/ChooseMenuPage";
import AddDishPage from "./pages/AddDishPage";
import EditDishPage from "./pages/EditDishPage";
import SettingsPage from "./pages/SettingsPage";

function DatabaseError({ message }: { message: string }) {
  return (
    <div className="app-container">
      <p className="status-message status-error">
        Failed to initialize database: {message}
      </p>
    </div>
  );
}

function AppContent() {
  const { error } = useDatabase();
  useSync();

  if (error) {
    return <DatabaseError message={error} />;
  }

  return (
    <Routes>
      <Route path="/" element={<MainMenuPage />} />
      <Route path="/choose" element={<ChooseMenuPage />} />
      <Route path="/add" element={<AddDishPage />} />
      <Route path="/edit" element={<EditDishPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}

function App() {
  return (
    <DatabaseProvider>
      <AppContent />
    </DatabaseProvider>
  );
}

export default App;
