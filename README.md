# 🏗️ FluxoCaixa — Gestão Financeira para Obras e Construção Civil

> Sistema web completo para controle financeiro, gerenciamento de custos e planejamento de obras. Desenvolvido para construtoras, empreiteiras e prestadores de serviço da construção civil.

---

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Requisitos](#-requisitos)
- [Instalação e Execução](#-instalação-e-execução)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Perfis de Acesso](#-perfis-de-acesso)
- [Módulos](#-módulos)
- [Screenshots](#-screenshots)
- [Exportação de Dados](#-exportação-de-dados)
- [Backup e Restauração](#-backup-e-restauração)
- [Variáveis de Ambiente](#-variáveis-de-ambiente)
- [Contribuição](#-contribuição)

---

## 🎯 Sobre o Projeto

O **FluxoCaixa** é uma aplicação web full-stack desenvolvida para controle financeiro de empresas da construção civil. Permite o acompanhamento em tempo real de receitas, despesas, orçamentos por projeto, contas a pagar e a receber, além de gerar relatórios gerenciais para apoio à tomada de decisão.

### Principais Diferenciais

- **Multi-projeto**: gerencie simultaneamente múltiplas obras com orçamentos independentes
- **Controle de parcelas**: lançamentos parcelados com vencimentos automáticos
- **Orçado × Realizado**: comparativo detalhado por categoria e projeto com alertas de estouro
- **Relatórios gerenciais**: dashboards com KPIs, evolução mensal, ranking de fornecedores e clientes
- **Gestão de NF/recibos**: upload, visualização e download de comprovantes diretamente no lançamento
- **Cadastro de contatos**: clientes e fornecedores com consulta automática de CNPJ na Receita Federal
- **Responsivo**: funciona em desktop, tablet e celular (Android/iOS)

---

## ✅ Funcionalidades

| Módulo | Funcionalidade |
|---|---|
| **Dashboard** | KPIs em tempo real, gráfico de evolução mensal, top projetos, lançamentos recentes |
| **Projetos** | Cadastro de obras com cliente, endereço, prazo, orçamento global e status |
| **Lançamentos** | Receitas e despesas, parcelamento, anexo de NF, status de pagamento |
| **Contas a Pagar/Receber** | Gestão de pendências com filtro de vencidos, a vencer e pagos |
| **Orçamentos** | Orçamento por categoria × projeto com barra de progresso e alertas |
| **Relatórios** | Fluxo de caixa, análise por categoria, ranking fornecedores/clientes, insights automáticos |
| **Orçado vs Realizado** | Comparativo detalhado por projeto com alertas de categorias estouradas |
| **Contatos** | Clientes e fornecedores com busca automática de dados via CNPJ |
| **Categorias** | Categorias de receitas e despesas personalizáveis com cores |
| **Usuários** | Gerenciamento de usuários com controle de acesso por perfil |
| **Backup** | Backup e restauração do banco de dados em arquivo ZIP compactado |

---

## 🛠️ Tecnologias

### Frontend
| Tecnologia | Versão | Uso |
|---|---|---|
| [React](https://react.dev/) | 18 | Interface de usuário |
| [TypeScript](https://www.typescriptlang.org/) | 5 | Tipagem estática |
| [Vite](https://vitejs.dev/) | 5 | Build e dev server |
| [Tailwind CSS](https://tailwindcss.com/) | 3 | Estilização |
| [Recharts](https://recharts.org/) | 2 | Gráficos |
| [React Router](https://reactrouter.com/) | 6 | Roteamento |
| [Axios](https://axios-http.com/) | 1 | Cliente HTTP |
| [ExcelJS](https://github.com/exceljs/exceljs) | 4 | Exportação Excel |
| [jsPDF](https://github.com/parallax/jsPDF) | 2 | Exportação PDF |
| [Lucide React](https://lucide.dev/) | — | Ícones |
| [date-fns](https://date-fns.org/) | 3 | Manipulação de datas |

### Backend
| Tecnologia | Versão | Uso |
|---|---|---|
| [Node.js](https://nodejs.org/) | 18+ | Runtime |
| [Express](https://expressjs.com/) | 4 | Framework HTTP |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | — | Banco de dados SQLite |
| [JWT](https://jwt.io/) | — | Autenticação |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | — | Hash de senhas |
| [Multer](https://github.com/expressjs/multer) | — | Upload de arquivos |
| [adm-zip](https://github.com/cthackers/adm-zip) | — | Compactação ZIP (backup) |
| [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) | — | Rate limiting |
| [pdf-parse](https://github.com/modesty/pdf-parse) | — | Extração de dados de PDF |

---

## 📦 Requisitos

- **Node.js** 18 ou superior
- **npm** 9 ou superior
- Sistema operacional: Linux, macOS ou Windows

---

## 🚀 Instalação e Execução

### 1. Clone o repositório

```bash
git clone https://github.com/rodrigogbvasconcelos/fluxodecaixa.git
cd fluxodecaixa
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Execute em modo desenvolvimento

```bash
npm run dev
```

Acesse:
- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **API Backend**: [http://localhost:3001](http://localhost:3001)

### 4. Ou execute com o script de inicialização

```bash
chmod +x start.sh
./start.sh
```

### 5. Build para produção

```bash
npm run build
npm start
```

### Credenciais padrão

> ⚠️ **Troque a senha imediatamente após o primeiro acesso!**

| Campo | Valor |
|---|---|
| E-mail | `admin@fluxocaixa.com` |
| Senha | `admin123` |

---

## 📁 Estrutura do Projeto

```
FluxodeCaixa/
├── backend/
│   └── src/
│       ├── data/              # Banco de dados SQLite (gerado automaticamente)
│       ├── middleware/        # Autenticação JWT, controle de acesso
│       ├── routes/            # Endpoints da API REST
│       │   ├── auth.ts        # Login / logout
│       │   ├── backup.ts      # Backup e restauração
│       │   ├── budgets.ts     # Orçamentos
│       │   ├── categories.ts  # Categorias
│       │   ├── contacts.ts    # Contatos (clientes/fornecedores)
│       │   ├── invoices.ts    # Upload e download de NF/recibos
│       │   ├── payables.ts    # Contas a pagar/receber
│       │   ├── projects.ts    # Projetos/obras
│       │   ├── reports.ts     # Relatórios e dashboard
│       │   ├── transactions.ts# Lançamentos financeiros
│       │   └── users.ts       # Gerenciamento de usuários
│       ├── services/          # Lógica de negócio
│       ├── database.ts        # Schema e conexão SQLite
│       └── index.ts           # Ponto de entrada do servidor
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Layout/        # Sidebar, header, layout geral
│       │   └── UI/            # Componentes reutilizáveis
│       ├── contexts/          # Context API (autenticação)
│       ├── pages/             # Páginas da aplicação
│       │   ├── Dashboard.tsx
│       │   ├── Projects.tsx
│       │   ├── Transactions.tsx
│       │   ├── PayablesReceivables.tsx
│       │   ├── Budgets.tsx
│       │   ├── Reports.tsx
│       │   ├── Contacts.tsx
│       │   ├── Categories.tsx
│       │   ├── Users.tsx
│       │   ├── Backup.tsx
│       │   └── Login.tsx
│       ├── services/          # API client, exportação Excel/PDF
│       ├── types/             # Interfaces TypeScript
│       └── utils/             # Formatadores, helpers
│
├── package.json               # Workspaces monorepo
├── start.sh                   # Script de inicialização
└── README.md
```

---

## 👥 Perfis de Acesso

O sistema possui 4 níveis de acesso com permissões progressivas:

| Perfil | Visualizar | Lançamentos | Projetos/Orçamentos | Usuários/Backup |
|---|:---:|:---:|:---:|:---:|
| **viewer** (visualizador) | ✅ | ❌ | ❌ | ❌ |
| **operator** (operador) | ✅ | ✅ | ❌ | ❌ |
| **manager** (gerente) | ✅ | ✅ | ✅ | ❌ |
| **admin** (administrador) | ✅ | ✅ | ✅ | ✅ |

---

## 📊 Módulos

### Dashboard
Visão geral da saúde financeira da empresa com:
- KPIs: total de receitas, despesas, saldo e projetos ativos
- Gráfico de evolução mensal (12 meses)
- Top 5 projetos por custo
- Lançamentos recentes
- Despesas por categoria

### Projetos
Cadastro e acompanhamento de obras com:
- Dados da obra: nome, cliente, endereço, prazo, status
- Orçamento global do projeto
- Resumo financeiro por projeto (receitas × despesas)
- Busca de cliente integrada ao cadastro de contatos

### Lançamentos
Registro de todas as movimentações financeiras:
- Tipos: receita ou despesa
- Parcelamento automático (até 60×) com vencimentos mensais
- Status: pago ou pendente
- Anexo de nota fiscal, recibo ou comprovante (PDF, PNG, JPG)
- **Visualização de anexo diretamente na tela** (PDF em iframe, imagem em modal)
- Campos: projeto, categoria, fornecedor/cliente, nº documento, forma de pagamento
- Busca de fornecedor/cliente integrada ao cadastro de contatos

### Contas a Pagar / Receber
Controle de pendências financeiras:
- Filtros: vencidos, a vencer hoje, próximos 7 dias, próximos 30 dias, todos
- Registro de pagamento/recebimento com data e forma de pagamento
- Indicadores visuais de vencimento (em atraso, vence hoje, a vencer)

### Orçamentos
Planejamento orçamentário por projeto e categoria:
- Definição de valor orçado por categoria de despesa
- Barra de progresso com código de cores (verde/amarelo/vermelho)
- Comparativo orçado × realizado em tempo real
- Alertas de categorias próximas do limite ou estouradas

### Relatórios
Análise gerencial do fluxo financeiro:
- **KPIs financeiros**: receitas, despesas, saldo, margem, a receber, a pagar, vencidos
- **Diagnóstico automático**: insights e alertas gerados automaticamente
- **Evolução mensal**: gráfico de linha + tabela com saldo acumulado
- **Distribuição por categoria**: gráfico de barras (despesas) e pizza (receitas)
- **Ranking de fornecedores**: top gastadores por categoria
- **Ranking de clientes**: top pagadores
- **Orçado × Realizado por projeto**: alertas de estouro, saúde do orçamento
- Exportação em **Excel** e **PDF**

### Contatos
Cadastro de clientes e fornecedores:
- **Consulta automática de CNPJ** via BrasilAPI (Receita Federal)
- Preenchimento automático de dados: razão social, endereço, telefone
- Tipo: cliente, fornecedor ou ambos
- Integração com lançamentos e projetos (busca por nome)

### Categorias
Personalização das categorias financeiras:
- Categorias padrão pré-cadastradas para obras (mão de obra, materiais, equipamentos, etc.)
- Suporte a cores personalizadas
- Separação por tipo: receita ou despesa

### Backup
Proteção dos dados (apenas administrador):
- **Download** do banco de dados completo em arquivo `.zip` com metadados
- **Restauração** a partir de arquivo de backup com confirmação dupla
- Inclui banco de dados + todos os arquivos de NF/recibos anexados

---

## 📤 Exportação de Dados

| Formato | Módulo | Conteúdo |
|---|---|---|
| **Excel (.xlsx)** | Relatórios | Lançamentos filtrados + aba de resumo financeiro |
| **PDF** | Relatórios | Relatório formatado com cabeçalho, cards e tabela |
| **Excel (.xlsx)** | Orçado × Realizado | Comparativo por projeto e categoria com % de utilização |

---

## 💾 Backup e Restauração

O módulo de backup (exclusivo para `admin`) gera um arquivo `.zip` contendo:

```
backup_FluxoCaixa_YYYY-MM-DD_HH-MM-SS.zip
├── metadata.json       # Informações do backup (app, versão, data)
├── cashflow.db         # Banco de dados SQLite completo
└── uploads/            # Todos os arquivos de NF/recibos anexados
```

Para restaurar, basta fazer upload do arquivo `.zip` gerado pelo próprio sistema. O servidor reinicia automaticamente após a restauração.

---

## ⚙️ Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto `backend/` se necessário:

```env
# JWT
JWT_SECRET=sua_chave_secreta_muito_segura_aqui

# Servidor
PORT=3001
NODE_ENV=production
```

> Por padrão, o sistema gera um `JWT_SECRET` aleatório se não for informado. Para produção, defina uma chave fixa para evitar invalidação de tokens após reinicializações.

---

## 🔐 Segurança

- Senhas armazenadas com **bcrypt** (hash + salt)
- Autenticação via **JWT** com expiração de 24h
- **Rate limiting** nas rotas de login e upload
- Validação de tipo de arquivo no upload (apenas PDF, PNG, JPG, TXT)
- Proteção contra **path traversal** nos downloads de arquivos
- Sanitização de nomes de arquivos com `Content-Disposition` seguro
- Auditoria completa: todas as operações são registradas com usuário, IP e dados anteriores/novos

---

## 📱 Suporte Mobile

A aplicação é totalmente responsiva e funciona como **PWA (Progressive Web App)**:

- Sidebar como drawer deslizante no mobile
- Layout adaptado para telas pequenas
- Suporte a `safe-area-inset` (iPhone com notch)
- Pode ser instalada na tela inicial do Android/iOS

---

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature: `git checkout -b feature/nova-funcionalidade`
3. Commit suas alterações: `git commit -m 'feat: adiciona nova funcionalidade'`
4. Push para a branch: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está sob licença privada. Todos os direitos reservados.

---

<div align="center">
  <strong>FluxoCaixa</strong> — Desenvolvido para a gestão eficiente de obras e empresas da construção civil
</div>
