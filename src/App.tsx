import { Routes, Route } from "react-router-dom";
import { DatabaseProvider, useDatabase } from "./db/DatabaseContext";

import "./App.css";
import MainMenu from "./MainMenu";
import ChooseMenuPage from "./pages/ChooseMenuPage";
import AddDishPage from "./pages/AddDishPage";
import EditDishPage from "./pages/EditDishPage";
import SettingsPage from "./pages/SettingsPage";

function DatabaseLoading() {
  return (
    <div className="app-container">
      <p className="status-message">Loading database...</p>
    </div>
  );
}

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
  const { db, isLoading, error } = useDatabase();

  if (error) {
    return <DatabaseError message={error} />;
  }

  if (isLoading || !db) {
    return <DatabaseLoading />;
  }

  return (
    <Routes>
      <Route path="/" element={<MainMenu />} />
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
