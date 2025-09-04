import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

// User interface
interface User {
  id: number;
  name: string;
  email: string;
}

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

// Demo user data for testing
const DEMO_USERS = [
  { id: 1, name: 'João Silva', email: 'joao@empresa.com', password: 'demo123' },
  { id: 2, name: 'Maria Santos', email: 'maria@empresa.com', password: 'demo123' },
  { id: 3, name: 'Pedro Costa', email: 'pedro@empresa.com', password: 'demo123' }
];

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Demo authentication
    const user = DEMO_USERS.find(
      u => u.email === formData.email && u.password === formData.password
    );

    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...userWithoutPassword } = user;
      onLogin(userWithoutPassword);
    } else {
      setError('Email ou senha inválidos. Use: demo@empresa.com / demo123');
    }
    
    setIsLoading(false);
  };

  const handleDemoLogin = () => {
    setFormData({
      email: 'joao@empresa.com',
      password: 'demo123'
    });
    setError(null);
  };

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center mb-4">
            <span className="text-white text-2xl">⚡</span>
          </div>
          <CardTitle className="text-2xl font-bold">Bem-vindo</CardTitle>
          <CardDescription>
            Entre com suas credenciais para acessar o sistema de processamento de contas de energia
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData(prev => ({ ...prev, email: e.target.value }))
                }
                placeholder="seu@email.com"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData(prev => ({ ...prev, password: e.target.value }))
                }
                placeholder="Sua senha"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600"
              disabled={isLoading}
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">🚀 Acesso de Demonstração</h4>
            <p className="text-sm text-blue-700 mb-3">
              Use as credenciais abaixo para testar o sistema:
            </p>
            <div className="text-sm space-y-1 mb-3">
              <p><strong>Email:</strong> joao@empresa.com</p>
              <p><strong>Senha:</strong> demo123</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDemoLogin}
              className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              Preencher dados de demonstração
            </Button>
          </div>

          <div className="mt-4 text-center text-xs text-gray-500">
            <p>Sistema para demonstração • Dados fictícios</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}