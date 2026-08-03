const express = require('express');
const session = require('express-session');
const path = require('path');
const config = require('./config');
const { injetarUsuario } = require('./lib/auth');

// Garante que o banco exista/seja criado (lib/db.js cria as tabelas ao ser importado)
require('./lib/db');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 8 * 60 * 60 * 1000, // 8 horas
      httpOnly: true,
      sameSite: 'lax',
      // secure: true, // habilitar quando servir via HTTPS em produção
    },
  })
);

app.use(injetarUsuario);
app.use((req, res, next) => {
  res.locals.empresa = config.EMPRESA;
  res.locals.caminhoAtual = req.path;
  res.locals.linkGPE = config.LINK_GPE;
  res.locals.empreendimentosFooter = config.EMPREENDIMENTOS;
  next();
});

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------
app.use('/', require('./routes/public'));
app.use('/cadastro', require('./routes/cadastro'));
app.use('/interno', require('./routes/interno'));

// 404
app.use((req, res) => {
  res.status(404).render('erro', { titulo: 'Página não encontrada', mensagem: 'A página que você procura não existe ou foi movida.' });
});

// Tratamento de erros (inclui erros do Multer, ex: arquivo muito grande)
app.use((err, req, res, next) => {
  console.error(err);
  const mensagem = err.message && err.message.includes('File too large')
    ? `O arquivo enviado excede o limite de ${config.MAX_UPLOAD_SIZE_MB}MB.`
    : err.message || 'Ocorreu um erro inesperado.';
  res.status(500).render('erro', { titulo: 'Erro', mensagem });
});

app.listen(config.PORT, () => {
  console.log(`Global Engenharia - servidor rodando em http://localhost:${config.PORT}`);
});
