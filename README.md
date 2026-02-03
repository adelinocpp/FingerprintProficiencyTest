# Sistema de Teste de Proficiência em Comparação de Impressões Digitais

![Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

Sistema web completo para avaliação de proficiência em comparação de impressões digitais, desenvolvido para fins de pesquisa científica em papiloscopia forense.

## 📋 Sobre o Projeto

Este sistema permite a realização de testes de proficiência para avaliar a capacidade de profissionais em identificar correspondências entre impressões digitais. O projeto é desenvolvido com apoio da **FAPEMIG** e **Rede Mineira de Ciências Forenses** através do **RED-00120-23**.

### Objetivos

- Avaliar a proficiência de especialistas em comparação de impressões digitais
- Coletar dados estatísticos sobre taxas de acerto e erro
- Identificar padrões de falsos positivos em análises periciais
- Fornecer certificação aos participantes

### Funcionalidades Principais

- ✅ Cadastro e autenticação de participantes via códigos únicos
- ✅ Validação de email com token de segurança
- ✅ Geração automática de amostras com grupos de imagens
- ✅ Interface interativa para comparação de impressões digitais
- ✅ Sistema de avaliação com múltiplos níveis de conclusividade
- ✅ Geração automática de certificados em PDF
- ✅ Rastreamento de arquivos para evitar duplicação
- ✅ Estatísticas e análise de resultados
- ✅ Suporte multilíngue (Português, Inglês, Espanhol)
- ✅ Exportação de amostras em formato ZIP

---

## 🏗️ Arquitetura

### Stack Tecnológico

#### Backend
- **Runtime**: Bun.js (JavaScript runtime ultrarrápido)
- **Framework**: Elysia (framework web TypeScript minimalista)
- **Banco de Dados**: SQLite com modo WAL (Write-Ahead Logging)
- **Autenticação**: JWT (JSON Web Tokens)
- **Email**: Nodemailer (suporte Gmail, Yahoo, SMTP customizado)
- **Processamento de Imagens**: Sharp
- **Geração de PDF**: Puppeteer

#### Frontend
- **Framework**: React 18 com TypeScript
- **Build Tool**: Vite
- **Roteamento**: Wouter (roteador leve)
- **Estilização**: TailwindCSS + Radix UI
- **Internacionalização**: i18n customizado
- **Ícones**: Lucide React

### Estrutura de Diretórios

```
Pagina/
├── backend/
│   ├── src/
│   │   ├── config/          # Configurações e variáveis de ambiente
│   │   ├── controllers/     # Controladores de rotas (auth, samples, results)
│   │   ├── database/        # Schema SQLite e queries
│   │   ├── middleware/      # Validação, logs, tratamento de erros
│   │   ├── services/        # Lógica de negócio (email, certificados, grupos)
│   │   ├── types/           # Tipos TypeScript
│   │   └── utils/           # Funções auxiliares e segurança
│   ├── data/
│   │   ├── fingerprint.db   # Banco de dados SQLite
│   │   ├── samples/         # Amostras geradas (ZIP e imagens)
│   │   └── certificates/    # Certificados PDF gerados
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Componentes React reutilizáveis
│   │   ├── pages/           # Páginas da aplicação
│   │   ├── hooks/           # React hooks customizados
│   │   ├── services/        # Camada de API
│   │   ├── i18n/            # Traduções (pt-BR, en, es)
│   │   └── styles/          # CSS global
│   └── package.json
│
├── scripts/                 # Scripts utilitários
└── README.md
```

---

## 🚀 Instalação e Configuração

### Pré-requisitos

- **Bun** >= 1.3.0 ([Instalar Bun](https://bun.sh))
- **Node.js** >= 18 (para ferramentas auxiliares)
- **Git**

### 1. Clone o Repositório

```bash
git clone <repository-url>
cd Pagina
```

### 2. Configuração do Backend

```bash
cd backend

# Instalar dependências
bun install

# Criar arquivo .env
cp .env.example .env
```

#### Configurar `.env`

```env
# Servidor
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173

# Banco de Dados
DATABASE_URL=./data/fingerprint.db

# JWT (OBRIGATÓRIO EM PRODUÇÃO)
JWT_SECRET=sua-chave-secreta-super-segura-mude-isso
JWT_EXPIRATION=7d

# Email (OBRIGATÓRIO)
EMAIL_SERVICE=gmail
EMAIL_USER=seu-email@gmail.com
EMAIL_PASSWORD=sua-senha-de-app
EMAIL_FROM_NAME=Teste de Proficiência
EMAIL_FROM_EMAIL=seu-email@gmail.com

# SMTP (Opcional - para Yahoo ou servidor customizado)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false

# Caminhos de Imagens (ajustar conforme seu ambiente)
FINGERPRINT_IMAGES_BASE=/caminho/para/base/de/dados/de/digitais
FINGERPRINT_IMAGES_DIR_0=FP_gen_0
FINGERPRINT_IMAGES_DIR_1=FP_gen_1

# Processamento de Imagens
IMAGE_WIDTH=712
IMAGE_HEIGHT=855
DEGRADATION_MIN_AREA_PERCENT=10
DEGRADATION_MAX_AREA_PERCENT=25

# Geração de Amostras
HAS_SAME_SOURCE_PROBABILITY=0.85
GROUPS_PER_SAMPLE=10
IMAGES_PER_GROUP=11

# CSV de Comparações Pareadas
PAIRWISE_COMPARISONS_FILE=./data/pairwise_comparisons_prod.csv

# Segurança
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX_REQUESTS=100

# Códigos de Participante
VOLUNTARY_CODE_LENGTH=6
CARRY_CODE_LENGTH=5
SAMPLE_EXPIRATION_DAYS=120
```

#### Configurar Email do Gmail

1. Acesse [Google Account Security](https://myaccount.google.com/security)
2. Ative a verificação em duas etapas
3. Gere uma "Senha de App" em "Senhas de apps"
4. Use essa senha no `EMAIL_PASSWORD`

### 3. Configuração do Frontend

```bash
cd ../frontend

# Instalar dependências
bun install

# ou com npm
npm install
```

### 4. Inicializar Banco de Dados

O banco de dados é criado automaticamente na primeira execução. As tabelas são geradas pelo schema em `backend/src/database/schema.ts`.

---

## ▶️ Executando o Projeto

### Desenvolvimento

#### Terminal 1 - Backend
```bash
cd backend
bun run dev
```
O backend estará disponível em `http://localhost:3000`

#### Terminal 2 - Frontend
```bash
cd frontend
bun run dev
# ou: npm run dev
```
O frontend estará disponível em `http://localhost:5173`

### Produção

#### Backend
```bash
cd backend
bun run build
bun run start
```

#### Frontend
```bash
cd frontend
bun run build
bun run preview
```

---

## 🔐 Fluxo de Autenticação

### 1. Registro
1. Participante acessa `/register`
2. Informa: **email** e **nome completo**
3. Sistema gera:
   - `VOLUNTARY_CODE` (6 caracteres alfanuméricos)
   - `CARRY_CODE` (5 caracteres alfanuméricos)
   - Token de validação de email (expira em 48h)
4. Email enviado com link de validação

### 2. Validação de Email
1. Participante clica no link recebido por email
2. Sistema valida o token
3. **Amostra é gerada automaticamente** com 10 grupos
4. Email enviado com link para download no dashboard
5. Redirecionamento para login

### 3. Login
1. Participante informa `VOLUNTARY_CODE` **ou** `CARRY_CODE`
2. Sistema valida e gera JWT token (válido por 7 dias)
3. Redirecionamento para dashboard

### 4. Dashboard
- Visualiza amostras disponíveis
- Faz download do ZIP com imagens
- Inicia avaliação dos grupos

---

## 📊 Fluxo de Avaliação

### Estrutura de uma Amostra

Cada amostra contém **10 grupos**, onde cada grupo possui:
- **1 impressão questionada** (imagem a ser identificada)
- **10 impressões padrão** (candidatas à correspondência)

### Processo de Avaliação

1. **Visualização**: Participante visualiza a impressão questionada
2. **Seleção**: Escolhe uma das 10 impressões padrão para comparar lado a lado
3. **Análise**: Compara as duas impressões em detalhes
4. **Decisão**:
   - **Conclusivo?** Sim / Não / Inconclusivo
   - Se **Sim**:
     - **Há correspondência?** Sim / Não
     - Se **Sim**:
       - **Qual imagem?** (0-9)
       - **Grau de compatibilidade?** (1-4)
   - **Observações** (opcional)
5. **Submissão**: Salva o resultado

### Conclusão

Quando todos os 10 grupos são avaliados:
1. Amostra marcada como **completa**
2. **Certificado PDF gerado automaticamente**
3. Email enviado com certificado em anexo
4. Status do participante alterado para **completed**

---

## 📜 Certificado de Participação

### Geração Automática

O certificado é gerado em **PDF** usando **Puppeteer** e inclui:

- Nome completo do participante
- Código de participação (VOLUNTARY_CODE)
- Data de conclusão
- Número de grupos avaliados
- ID único do certificado (UUID)
- Assinatura do pesquisador responsável
- Informações sobre apoio FAPEMIG e Rede Mineira

### Características

- Formato A4 profissional
- Design com gradiente e efeitos visuais
- Informações de rastreabilidade
- Enviado automaticamente por email

---

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais

#### `participants`
Armazena dados dos participantes cadastrados.

#### `samples`
Amostras de teste atribuídas a cada participante.

#### `groups`
Grupos de imagens dentro de cada amostra.

#### `group_images`
Metadados das imagens (hash SHA256 para evitar duplicação).

#### `results`
Resultados das avaliações submetidas.

#### `certificates`
Registros de certificados emitidos.

#### `file_tracking`
Rastreamento de uso de imagens por participante.

#### `pairwise_cache`
Cache de scores de comparação entre pares de impressões.

### Índices e Constraints

- Foreign keys com `ON DELETE CASCADE`
- Índices em colunas frequentemente consultadas
- Constraints para validação de dados
- Modo WAL para melhor concorrência

---

## 📧 Sistema de Email

### Templates Disponíveis

1. **Boas-vindas** (`getWelcomeEmailTemplate`)
   - Enviado após cadastro
   - Contém link de validação
   - Códigos de acesso

2. **Lembrete** (`getReminderEmailTemplate`)
   - Enviado quando email já cadastrado tenta se registrar novamente
   - Reenvio dos códigos

3. **Amostra Pronta** (em `authController.ts`)
   - Notifica que amostra foi gerada
   - Link para download no dashboard

4. **Certificado** (`getCertificateEmailTemplate`)
   - Enviado após conclusão
   - Certificado PDF em anexo

### Configuração de Provedores

#### Gmail
```env
EMAIL_SERVICE=gmail
EMAIL_USER=seu-email@gmail.com
EMAIL_PASSWORD=senha-de-app-do-google
```

#### Yahoo
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=seu-email@yahoo.com
EMAIL_PASSWORD=sua-senha
```

#### SMTP Customizado
```env
SMTP_HOST=smtp.seuservidor.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=usuario
EMAIL_PASSWORD=senha
```

---

## 🛡️ Segurança

### Implementações

- ✅ JWT com expiração configurável
- ✅ Validação de email obrigatória
- ✅ Tokens de validação com prazo de 48h
- ✅ Prepared statements (SQLite)
- ✅ Sanitização de inputs
- ✅ Hash SHA256 para rastreamento de arquivos
- ✅ CORS configurável
- ✅ Logs de acesso com IP e User-Agent
- ✅ Limpeza automática de dados antigos

### Recomendações para Produção

1. **Altere o JWT_SECRET** para uma chave forte e única
2. **Use HTTPS** (configure SSL/TLS no servidor)
3. **Configure CORS** para permitir apenas seu domínio frontend
4. **Habilite rate limiting** (já configurado mas precisa ativar middleware)
5. **Backups regulares** do banco de dados SQLite
6. **Monitore logs** de acesso e erros
7. **Valide variáveis de ambiente** no `.env`

---

## 🌍 Internacionalização

O sistema suporta 3 idiomas:

- **Português (pt-BR)** - Padrão
- **Inglês (en)**
- **Espanhol (es)**

### Adicionar Nova Tradução

1. Criar arquivo em `frontend/src/i18n/{codigo-idioma}.json`
2. Copiar estrutura de `pt-br.json`
3. Traduzir todas as chaves
4. Adicionar no `I18nProvider`

---

## 🧪 Testes e Desenvolvimento

### Scripts Disponíveis

#### Backend
```bash
bun run dev         # Desenvolvimento com hot reload
bun run build       # Build para produção
bun run start       # Inicia servidor de produção
```

#### Frontend
```bash
bun run dev         # Servidor de desenvolvimento
bun run build       # Build otimizado
bun run preview     # Preview do build
bun run lint        # Linter (ESLint)
```

### Limpeza Automática

O sistema executa rotinas de limpeza na inicialização:

- Remove amostras pendentes com mais de 120 dias
- Remove tokens CSRF expirados
- Remove logs de acesso com mais de 90 dias

---

## 📁 Arquivos Importantes

### Configuração

- `backend/.env` - Variáveis de ambiente
- `backend/src/config/env.ts` - Validação de configuração
- `backend/package.json` - Dependências backend

### Lógica de Negócio

- `backend/src/services/certificateService.ts` - Geração de certificados PDF
- `backend/src/services/groupGeneratorService.ts` - Geração inteligente de grupos
- `backend/src/services/emailService.ts` - Envio de emails
- `backend/src/controllers/authController.ts` - Autenticação e registro

### Frontend

- `frontend/src/pages/SampleEvaluation.tsx` - Interface de avaliação
- `frontend/src/components/GroupViewer.tsx` - Visualizador de grupos
- `frontend/src/i18n/` - Traduções

---

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

---

## 👥 Equipe

**Pesquisador Responsável**: Dr. Adelino Pinheiro Silva

---

## 🙏 Agradecimentos

Este projeto é desenvolvido com apoio da **FAPEMIG** (Fundação de Amparo à Pesquisa do Estado de Minas Gerais) e **Rede Mineira de Ciências Forenses** através do projeto **RED-00120-23**.

---

## 📞 Suporte

Para dúvidas ou problemas:

1. Verifique a documentação
2. Consulte o [Guia do Participante](./GUIA_PARTICIPANTE.md)
3. Entre em contato com a equipe de pesquisa

---

## 🔄 Changelog

### Versão 1.0.0 (2024)

- ✅ Sistema completo de autenticação
- ✅ Geração automática de amostras
- ✅ Interface de avaliação interativa
- ✅ Certificados em PDF com Puppeteer
- ✅ Sistema de email automatizado
- ✅ Suporte multilíngue
- ✅ Dashboard responsivo
- ✅ Rastreamento de arquivos

---

**Desenvolvido com ❤️ para a ciência forense brasileira**
