import { DatabaseProvider, useDatabase } from "./db/DatabaseContext";

import "./App.css";
import MainMenu from "./MainMenu";

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

  return <MainMenu />;
}

function App() {
  return (
    <DatabaseProvider>
      <AppContent />
    </DatabaseProvider>
  );
}

export default App;
