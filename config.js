/* Tečkovník – propojení s databází Supabase.
   Hodnoty najdeš v Supabase: Project Settings → API (Data API / API Keys).
   Klíč „publishable“ (sb_publishable_…) nebo „anon public“ je určený do aplikace – není tajný.
   NIKDY sem nevkládej klíč „secret“ ani „service_role“. */
window.TK_CONFIG = {
  supabaseUrl: 'https://VLOZ-ID-PROJEKTU.supabase.co',
  supabaseKey: 'VLOZ-PUBLISHABLE-KLIC'
};
