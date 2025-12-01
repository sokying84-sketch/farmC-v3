import React, { useState, useEffect } from 'react';
import { UserRole } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { applyTheme, getTheme } from './services/sheetService';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserRole | null>(null);

  useEffect(() => {
    // Apply saved theme on startup
    applyTheme(getTheme());
  }, []);

  const handleLogin = (role: UserRole) => {
    setCurrentUser(role);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  return (
    <div className="h-full bg-slate-50">
      {!currentUser ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Dashboard userRole={currentUser} onLogout={handleLogout} />
      )}
    </div>
  );
}