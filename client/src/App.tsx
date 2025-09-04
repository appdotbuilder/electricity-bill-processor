import React, { useState } from 'react';
import { LoginScreen } from '@/components/LoginScreen';
import { UploadScreen } from '@/components/UploadScreen';
import { ResultsScreen } from '@/components/ResultsScreen';
import './App.css';

// Application states
type AppState = 'login' | 'upload' | 'results';

// User interface for authentication
interface User {
  id: number;
  name: string;
  email: string;
}

function App() {
  const [currentState, setCurrentState] = useState<AppState>('login');
  const [user, setUser] = useState<User | null>(null);
  const [currentUploadId, setCurrentUploadId] = useState<number | null>(null);

  const handleLogin = (userData: User) => {
    setUser(userData);
    setCurrentState('upload');
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentUploadId(null);
    setCurrentState('login');
  };

  const handleUploadComplete = (uploadId: number) => {
    setCurrentUploadId(uploadId);
    setCurrentState('results');
  };

  const handleBackToUpload = () => {
    setCurrentUploadId(null);
    setCurrentState('upload');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">⚡</span>
              </div>
              <h1 className="text-xl font-bold text-gray-800">EnergiaBills</h1>
            </div>
            {user && (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">Olá, {user.name}!</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {currentState === 'login' && (
          <LoginScreen onLogin={handleLogin} />
        )}
        
        {currentState === 'upload' && user && (
          <UploadScreen 
            user={user} 
            onUploadComplete={handleUploadComplete}
          />
        )}
        
        {currentState === 'results' && user && currentUploadId && (
          <ResultsScreen 
            uploadId={currentUploadId}
            user={user}
            onBackToUpload={handleBackToUpload}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t bg-gray-50">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p className="text-sm">
            Sistema de Processamento de Contas de Energia Elétrica
          </p>
          <p className="text-xs mt-2">
            Correção monetária baseada na taxa SELIC
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;