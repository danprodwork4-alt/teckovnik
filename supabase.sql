-- =====================================================================
-- Tečkovník – databáze pro Supabase
-- Spusť celý soubor jednou: Supabase → SQL Editor → New query → vložit → Run.
-- Bezpečné spustit znovu (nic nesmaže).
-- =====================================================================

-- Tabulky: každý záznam = id + data (JSON), stejně jako v původní verzi.
create table if not exists public.books   (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.pages   (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.symbols (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.chunks  (id text primary key, page_id text not null, data jsonb not null, updated_at timestamptz not null default now());
create index if not exists chunks_page_id_idx on public.chunks (page_id);

-- Ochrana proti obřím záznamům (jeden balík tahů max. ~300 kB).
do $$ begin
  alter table public.chunks  add constraint chunks_size_ck  check (pg_column_size(data) < 300000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.symbols add constraint symbols_size_ck check (pg_column_size(data) < 300000);
exception when duplicate_object then null; end $$;

-- Čas poslední změny.
create or replace function public.tk_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['books','pages','symbols','chunks'] loop
    execute format('drop trigger if exists tk_touch on public.%I', t);
    execute format('create trigger tk_touch before update on public.%I for each row execute function public.tk_touch()', t);
  end loop;
end $$;

-- Zabezpečení: číst a zapisovat smí jen PŘIHLÁŠENÍ uživatelé.
-- Účty zakládá jen správce v Authentication → Users (registrace musí být vypnutá!).
-- Mazání není povolené vůbec – aplikace maže jen označením (deleted: true).
do $$ declare t text; begin
  foreach t in array array['books','pages','symbols','chunks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tk_select on public.%I', t);
    execute format('drop policy if exists tk_insert on public.%I', t);
    execute format('drop policy if exists tk_update on public.%I', t);
    execute format('create policy tk_select on public.%I for select to authenticated using (true)', t);
    execute format('create policy tk_insert on public.%I for insert to authenticated with check (true)', t);
    execute format('create policy tk_update on public.%I for update to authenticated using (true) with check (true)', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Změny v reálném čase (synchronizace mezi zařízeními).
do $$ declare t text; begin
  foreach t in array array['books','pages','symbols','chunks'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Obrázky: soukromé úložiště, číst a nahrávat smí jen přihlášení.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', false, 10485760, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
drop policy if exists tk_img_select on storage.objects;
drop policy if exists tk_img_insert on storage.objects;
create policy tk_img_select on storage.objects for select to authenticated using (bucket_id = 'images');
create policy tk_img_insert on storage.objects for insert to authenticated with check (bucket_id = 'images');

-- Kontrola: musí vypsat 4 řádky s rls_on = true.
select relname as tabulka, relrowsecurity as rls_on
from pg_class where relname in ('books','pages','symbols','chunks') and relnamespace = 'public'::regnamespace;
