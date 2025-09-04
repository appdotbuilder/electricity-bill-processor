# EnergiaBills - Sistema de Processamento de Contas de Energia

## 🚀 Visão Geral

O EnergiaBills é um sistema completo para processamento automático de contas de energia elétrica, desenvolvido com React (frontend) e tRPC/FastAPI (backend). O sistema permite:

- Upload de arquivos ZIP contendo múltiplas contas de energia
- Extração automática de dados usando OCR e processamento de PDFs
- Correção monetária baseada na taxa SELIC histórica
- Geração de relatórios consolidados em Excel/CSV
- Visualização gráfica da evolução dos valores

## 🏗️ Arquitetura do Sistema

### Frontend (React + TypeScript)
- **Framework**: React 18 com TypeScript
- **Estilização**: Tailwind CSS + Radix UI
- **Comunicação**: tRPC para type-safe API calls
- **Gráficos**: Componentes customizados para visualização de dados

### Backend (Node.js + tRPC)
- **Framework**: tRPC para APIs type-safe
- **Processamento**: PDFPlumber (PDFs digitais) + Tesseract (OCR para imagens)
- **Banco de dados**: SQLite para armazenamento
- **Correção monetária**: Taxa SELIC histórica

## 📱 Funcionalidades

### 1. Tela de Login
- Sistema de autenticação mock para demonstração
- Credenciais padrão: `joao@empresa.com` / `demo123`
- Interface responsiva e acessível

### 2. Upload de Arquivos
- Drag & drop ou seleção manual de arquivos ZIP
- Validação de formato e tamanho (máx. 50MB)
- Feedback visual durante o upload
- Processamento em tempo real

### 3. Resultados e Análises
- **Visão Geral**: Resumo financeiro com totais originais e corrigidos
- **Detalhes**: Tabela completa com status de cada conta processada
- **Gráficos**: Evolução temporal dos valores (anual e mensal)
- **Relatórios**: Export para Excel/CSV

## 🛠️ Componentes Principais

### `App.tsx`
Componente raiz que gerencia:
- Estados da aplicação (login, upload, resultados)
- Navegação entre telas
- Dados do usuário logado

### `LoginScreen.tsx`
- Interface de autenticação
- Validação de credenciais
- Dados de demonstração pré-preenchidos

### `UploadScreen.tsx`
- Interface de upload com drag & drop
- Validação de arquivos
- Feedback de progresso
- Instruções de uso

### `ResultsScreen.tsx`
- Dashboard completo com resultados
- Tabs organizadas (Visão Geral, Detalhes, Gráficos)
- Geração de relatórios
- Status de processamento em tempo real

### `BillsChart.tsx`
- Visualizações gráficas usando CSS puro
- Gráficos anuais e mensais
- Comparação valores originais vs corrigidos
- Dados de consumo energético

## 📊 Tipos e Schemas

O sistema utiliza schemas Zod para validação type-safe:

```typescript
// Principais entidades
- ElectricityBill: Dados da conta processada
- UploadBatch: Informações do lote de upload
- SelicRate: Taxa SELIC histórica
- ConsolidatedReport: Relatório consolidado
```

## 🎨 Design System

### Cores Principais
- **Azul**: `#3B82F6` - Valores originais, elementos primários
- **Verde**: `#10B981` - Valores corrigidos, sucesso
- **Roxo**: `#8B5CF6` - Consumo energético, diferenças
- **Vermelho**: `#EF4444` - Erros, falhas de processamento
- **Amarelo**: `#F59E0B` - Processamento, avisos

### Componentes UI
Baseados no Radix UI para acessibilidade:
- Buttons, Cards, Tables
- Alerts, Progress, Badges
- Tabs, Dialogs, Tooltips

## 🔧 Configuração Local

### Pré-requisitos
```bash
Node.js 18+
npm ou yarn
Python 3.8+ (para backend)
```

### Frontend
```bash
cd client
npm install
npm run dev
```

### Backend
```bash
cd server
npm install
npm run dev
```

### Dependências Python (Backend)
```bash
pip install fastapi uvicorn
pip install pdfplumber pytesseract
pip install pandas openpyxl
pip install sqlite3
```

## 📈 Funcionalidades de Processamento

### Extração de Dados
1. **PDFs Digitais**: Usa `pdfplumber` para extrair texto
2. **Imagens/PDFs Escaneados**: OCR com `pytesseract`
3. **Campos Extraídos**:
   - Total a pagar (valor final da conta)
   - Consumo de energia em kWh
   - Data de vencimento/período

### Correção Monetária
- Base: Taxa SELIC histórica mensal
- Cálculo: Juros compostos desde a data da conta
- Fonte: Dados do Banco Central (CSV pré-carregado)

### Tratamento de Erros
- Arquivos corrompidos
- Formatos não suportados
- Falhas na extração OCR
- Dados inconsistentes

## 📝 Dados de Teste

O sistema inclui dados fictícios para demonstração:
- Contas de energia dos anos 2023-2024
- Valores variando de R$ 150 a R$ 350
- Consumo entre 100-300 kWh
- Alguns arquivos com erro para testar tratamento

## 🚀 Deploy e Produção

### Variáveis de Ambiente
```env
SERVER_PORT=2022
DATABASE_URL=sqlite:./energia_bills.db
SELIC_CSV_PATH=./data/selic_historical.csv
```

### Build Production
```bash
# Frontend
npm run build

# Backend
npm run build
npm start
```

## 🧪 Testes

### Casos de Teste Incluídos
1. Upload de arquivo válido
2. Processamento com sucesso/erro
3. Geração de relatórios
4. Cálculos de correção SELIC
5. Responsividade mobile

### Dados Mock
- Usuários: 3 usuários de demonstração
- Contas: 8 contas fictícias + 1 com erro
- SELIC: Dados históricos 2020-2024

## 📚 Documentação Adicional

### Estrutura de Arquivos
```
client/src/
├── components/
│   ├── ui/           # Componentes Radix UI
│   ├── LoginScreen.tsx
│   ├── UploadScreen.tsx
│   ├── ResultsScreen.tsx
│   └── BillsChart.tsx
├── utils/
│   └── trpc.ts       # Configuração tRPC
├── App.tsx           # Componente principal
└── App.css          # Estilos globais
```

### APIs Disponíveis
- `uploadZip`: Upload e processamento inicial
- `getUploadStatus`: Status do processamento
- `generateReport`: Geração de relatórios
- `getAllSelicRates`: Dados SELIC históricos

## 🤝 Contribuição

Para contribuir com o projeto:
1. Fork do repositório
2. Crie uma branch para sua feature
3. Commit com mensagens descritivas
4. Abra um Pull Request

## 📄 Licença

Sistema desenvolvido para fins educacionais e de demonstração.

---

**Desenvolvido com ❤️ para facilitar o processamento de contas de energia elétrica**