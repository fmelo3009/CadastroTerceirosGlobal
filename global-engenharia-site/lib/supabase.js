const { createClient } = require('@supabase/supabase-js');


// ============================================================
// VARIÁVEIS DE AMBIENTE
// ============================================================

const supabaseUrl =
  process.env.SUPABASE_URL;

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;


// ============================================================
// VALIDAÇÃO
// ============================================================

if (!supabaseUrl) {
  throw new Error(
    'Variável SUPABASE_URL não configurada.'
  );
}

if (!supabaseServiceRoleKey) {
  throw new Error(
    'Variável SUPABASE_SERVICE_ROLE_KEY não configurada.'
  );
}


// ============================================================
// CLIENTE SUPABASE
// ============================================================

const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);


// ============================================================
// EXPORTAÇÃO
// ============================================================

module.exports = supabase;
