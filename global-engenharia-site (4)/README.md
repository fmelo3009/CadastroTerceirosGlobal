# Global Engenharia — Site institucional + Cadastro de Terceirizados

Site institucional da Global Engenharia (empresa do Grupo Global) com foco real em manter um
**banco de dados de empresas e profissionais terceirizados**, organizados por empreendimento
(usina), para consulta futura da equipe interna no momento de contratar.

Stack: **Node.js + Express + EJS + better-sqlite3** (sem build step / sem frontend framework).

---

## Como rodar localmente

Pré-requisitos: Node.js 18+.

```bash
# 1. instalar dependências
npm install

# 2. copiar variáveis de ambiente
cp .env.example .env

# 3. popular o banco (cria usuário admin + catálogo de serviços)
npm run seed

# 4. subir o servidor
npm start
```

Acesse **http://localhost:3000**.

O banco SQLite é criado automaticamente em `data/global_engenharia.db` na primeira execução
(pasta ignorada pelo git — ver `.gitignore`).

### Login da área interna (placeholder)

Criado pelo `npm run seed`:
- **e-mail:** `admin@globalengenharia.com.br`
- **senha:** `GlobalEng@2026`

⚠️ Troque essa senha antes de qualquer uso real. O painel interno (`/interno`) ainda é só um
placeholder de login — o dashboard de consulta aos cadastros é a próxima etapa do projeto.

---

## Estrutura do projeto

```
config.js              → dados da empresa, empreendimentos, listas fixas (UFs, tipos de doc.)
server.js              → bootstrap do Express, middlewares, rotas, tratamento de erro
lib/
  db.js                → conexão SQLite + schema (CREATE TABLE ...)
  seed.js               → popula catálogo de serviços + usuário admin inicial
  auth.js               → middlewares de sessão/autenticação da área interna
routes/
  public.js             → rotas institucionais (/, /sobre, /servicos, /contato)
  cadastro.js           → cadastro de terceirizados (geral e por empreendimento)
  interno.js             → login da área interna (placeholder — dashboard ainda não implementado)
views/                  → templates EJS (partials/, public/, cadastro/, interno/)
public/
  css/style.css          → design system (cores, tipografia, componentes)
  js/main.js             → menu mobile + wizard do formulário de cadastro
  img/                   → logo e fotos reais dos empreendimentos
data/                   → banco SQLite (gerado; ignorado pelo git)
uploads/                → documentos enviados pelos terceirizados (gerado; ignorado pelo git)
```

---

## Rotas

| Rota | Descrição |
|---|---|
| `GET /` | Home institucional (hero, empreendimentos, diferenciais, contato) |
| `GET /sobre` | Institucional (missão, visão, valores) |
| `GET /servicos` | Catálogo de serviços |
| `GET /contato` | Formulário de contato (visual, sem backend ainda) |
| `GET/POST /cadastro` | Cadastro geral de terceirizado (permite escolher o empreendimento) |
| `GET/POST /cadastro/:slug` | Cadastro vinculado a um empreendimento específico (ex: `/cadastro/ute-guarani`) |
| `GET /interno/login` | Login da área interna |
| `GET /interno` | Painel interno (placeholder — "em construção") |

Empreendimentos atualmente cadastrados em `config.js` (`EMPREENDIMENTOS`): `ute-guarani`,
`ute-tupa` (ainda sem foto/link oficiais) e `ute-apoena`.

---

## O que já está pronto

- Design visual completo (identidade "Grupo Global": azul/branco, logo real da GPE, fotos reais
  dos empreendimentos).
- Formulário de cadastro em 5 etapas (dados cadastrais, serviços, experiência, documentos,
  revisão), com os campos reais usados pela empresa (CNPJ, inscrição estadual/municipal, CEP,
  setor de atividade etc.), upload de documentos e gravação no SQLite.
- Cadastro por empreendimento (`/cadastro/:slug`), já salvando a coluna `empreendimento` no banco.

## Pendências conhecidas

- Painel interno (`/interno`) para consulta/filtro dos terceirizados cadastrados — ainda não
  implementado (só o login existe).
- Formulário de `/contato` é só visual, sem envio real.
- Textos institucionais de `/sobre` são provisórios (marcados no próprio HTML).
- UTE Tupã está com imagem/link placeholder, aguardando material oficial.
- Sem testes automatizados.

---

## Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm start` / `npm run dev` | Sobe o servidor (`server.js`) |
| `npm run seed` | Popula o catálogo de serviços e cria o usuário admin inicial |
