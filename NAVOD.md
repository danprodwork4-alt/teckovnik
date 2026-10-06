# Tečkovník – vlastní aplikace (návod k nastavení)

Výsledek: aplikace na adrese `https://TVUJ-UCET.github.io/teckovnik/`, ikona na ploše iPadu, otevírá se přes celou obrazovku, synchronizace a spolupráce v reálném čase, přístup jen pro lidi, kterým založíš účet. Vše zdarma.

**Čas:** zhruba 30 minut. **Doporučení:** kroky 2–4 dělej na počítači (stačí školní). Nahrávání složek na GitHub na iPadu nefunguje spolehlivě.

---

## Krok 1 – Záloha dat z verze v claude.ai
1. Otevři Tečkovník v claude.ai.
2. Dole vpravo **Nastavení** (ikona posuvníků) → **Export dat** → **Exportovat** → potvrď uložení.
3. Soubor `teckovnik-export-RRRR-MM-DD.json` si uschovej (např. na iCloud Drive). Použiješ ho v kroku 6.

## Krok 2 – Databáze Supabase
1. Jdi na **supabase.com** → **Start your project** → zaregistruj se (e-mailem nebo přes GitHub).
2. **New project**:
   - Name: `teckovnik`
   - Database Password: vygeneruj a **ulož si ho** (do aplikace ho nevkládáš, ale budeš ho potřebovat při správě)
   - Region: **Central EU (Frankfurt)**
   - Plán: **Free**
   - **Create new project**, počkej asi 2 minuty.
3. Vlevo **SQL Editor** → **New query** → vlož celý obsah souboru `supabase.sql` → **Run**.
   Na konci se musí vypsat 4 řádky (`books`, `pages`, `symbols`, `chunks`) a u všech `rls_on = true`.
4. ⚠️ **Vypni registraci** (bez tohoto kroku by si účet mohl založit kdokoliv):
   **Authentication** → **Sign In / Providers** (v některých verzích *Settings*) → vypni **Allow new users to sign up** → **Save**.
5. **Založ účty** (sobě i každému spolužákovi):
   **Authentication** → **Users** → **Add user** → **Create new user** → e-mail + heslo → zaškrtni **Auto Confirm User** → **Create user**.
   Heslo předej osobně. Každý si ho po přihlášení změní v aplikaci (Nastavení → Heslo).
6. **Zkopíruj přístupové údaje** do poznámek:
   - **Project URL**: tlačítko **Connect** nahoře, nebo **Project Settings** → **Data API**. Tvar `https://abcdefgh.supabase.co`.
   - **Publishable key** (`sb_publishable_…`): **Project Settings** → **API Keys**. Ve starších projektech se jmenuje **anon public**.
   - ❌ Klíč **secret** / **service_role** do aplikace **nikdy** nevkládej. Obchází veškeré zabezpečení.

## Krok 3 – GitHub Pages (hosting zdarma)
1. Jdi na **github.com** → **Sign up** a vytvoř účet.
2. Vpravo nahoře **+** → **New repository**:
   - Repository name: `teckovnik`
   - **Public** (GitHub Pages je zdarma jen pro veřejné repozitáře; veřejný je jen kód, tvoje poznámky jsou v Supabase za přihlášením)
   - **Create repository**
3. Na stránce repozitáře klikni na odkaz **uploading an existing file**.
4. Rozbal `teckovnik-pwa.zip` a **přetáhni obsah složky** do okna prohlížeče: `index.html`, `config.js`, `pwa.js`, `sw.js`, `manifest.webmanifest`, `supabase.sql`, `NAVOD.md` a složky `vendor` a `icons`.
   `index.html` musí být **přímo v kořeni** repozitáře, ne ve vnořené složce.
5. Dole **Commit changes**.

## Krok 4 – Propojení s databází
1. V repozitáři klikni na `config.js` → ikona **tužky** (Edit).
2. Nahraď obě hodnoty údaji z kroku 2.6:
   ```js
   window.TK_CONFIG = {
     supabaseUrl: 'https://abcdefgh.supabase.co',
     supabaseKey: 'sb_publishable_...'
   };
   ```
3. **Commit changes**.
4. **Settings** (repozitáře) → **Pages** → Source: **Deploy from a branch** → Branch: **main**, složka **/ (root)** → **Save**.
5. Po 1–2 minutách se nahoře zobrazí adresa `https://TVUJ-UCET.github.io/teckovnik/`.

## Krok 5 – iPad
1. Otevři adresu v **Safari**.
2. **Sdílet** → **Přidat na plochu** → **Přidat**.
3. Aplikaci otevři **z ikony na ploše** a přihlas se v ní.
   iPad má pro aplikaci na ploše oddělené přihlášení od Safari, proto se přihlašuj až z ikony.

## Krok 6 – Přenos dat
V aplikaci **Nastavení** → **Import dat** → **Importovat** → vyber soubor z kroku 1 → potvrď.
Sešity, stránky a vlastní značky se objeví v seznamu sešitů.

## Krok 7 – Kontrola zabezpečení (2 minuty)
- Otevři adresu aplikace v anonymním okně: musí se ukázat jen přihlašovací obrazovka.
- Zkus se přihlásit vymyšleným e-mailem: musí to selhat.

---

## Údržba
| Situace | Co udělat |
|---|---|
| Nový spolužák | Krok 2.5 |
| Někdo zapomněl heslo | Authentication → Users → uživatele smaž a založ znovu se stejným e-mailem. Poznámky se neztratí, nejsou vázané na účet. |
| Aplikace hlásí, že data nejdou načíst, po delší pauze | Free projekt Supabase se po **7 dnech bez aktivity** uspí. V supabase.com otevři projekt → **Restore project**. Data zůstávají. |
| Aktualizace na verzi s obrázky a PDF | Spusť znovu celý `supabase.sql` (vytvoří úložiště obrázků, nic nesmaže) a nahraj nové soubory včetně složky `vendor/pdfjs`. |
| Nahrávám novou verzi aplikace | Nahraj nové soubory na GitHub a v `sw.js` zvyš `VERSION` (např. `tk-v1` → `tk-v2`). Na iPadu aplikaci zavři a otevři (případně dvakrát). |

## Limity bezplatných tarifů
- Supabase: databáze 500 MB, úložiště souborů 1 GB (zhruba 2–3 tisíce vložených fotek), 5 GB přenosu za měsíc, 2 miliony zpráv v reálném čase za měsíc. Pro třídu stačí s velkou rezervou.
- Rozpracované tahy a kurzory (ne uložené poznámky) jdou přes veřejné kanály Supabase. Teoreticky by je mohl sledovat jen ten, kdo zná veřejný klíč i náhodné ID stránky.
- Funkce „Na schéma“ (rozpoznání nakreslených součástek) používá Clauda, a proto funguje jen ve verzi v claude.ai. Vlastní aplikace umí „Srovnat“, převod obrázků a PDF na tahy i vkládání obrázků.
- Bez internetu se aplikace otevře a půjde kreslit. Změny se odešlou po připojení, ale **jen pokud aplikaci mezitím nezavřeš**.
