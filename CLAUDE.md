# daramag.com: instruksjoner for AI-agenter

DARAs egen forside og artikkelsider. Redaktør: Trond Slyngstad. Trond godkjenner alt som publiseres.
Bestemt 10.11.2026 (Trond, skisse av Tim og Don): se docs/beslutninger.md.

## Slik er prosjektet bygget
- `content/site.json`: alle tekster på norsk og engelsk, adresser (Substack, magasinet), The Week-kortet og redaktør.
- Kildebiblioteket (Trond 11.11.2026): `/no/kilder/` og `/en/sources/` bygges av build.js fra `kilder` i artiklene, med søk og temaknapper. Temaene står i `temaer` i `content/site.json` (Betalt for data, Samtykke og tillit, Regler og rettigheter, KI og datasentre), og hver artikkel har `temaer` med en eller to id-er. Nytt tema legges til først når det finnes en sak om det.
- `content/artikler/<id>.json`: én fil per publisert artikkel, med norsk (`no`) og engelsk (`en`) utgave. `id` er id-en i DARA Redaksjon. `publisert` styrer rekkefølgen.
- `public/`: stil.css, dara.js og favicon, kopieres rett ut.
- `build.js`: bygger til `dist/` uten eksterne pakker. Kjør `node build.js` og sjekk at det går uten feil før du sender inn.
- `functions/index.js`: velger språk på daramag.com/ (eget valg, så Norge eller nettleserspråk gir norsk, ellers engelsk).
- `functions/api/abonner.js`, `functions/bekreft/` og `server/liste.js`: DARAs egen e-postliste for The Week (Trond 10.11.2026). Påmelding fra daramag.com, The Week og leanin.no/blog, bekreftelse på e-post fra post@daramag.com. Adressene ligger i D1-databasen `dara-abonnenter` (EU), bindingen `DB`. `functions/api/eksport.js` gir Trond nye bekreftede adresser som fil til Substack, så lenge The Week sendes derfra. Innstillinger i Cloudflare: `DB`, `CF_ACCOUNT_ID`, `CF_EMAIL_TOKEN` (Cloudflare Email Sending), `EPOST_FRA` (valgfri, standard post@daramag.com), `EKSPORT_PASSORD` (minst 12 tegn).
- `_redirects` (lages av build.js): gamle Substack-lenker sendes til substack.daramag.com.

## Regler
- Bare artikler som er publisert på Substack (status «publisert» i DARA Redaksjon) legges inn.
- Perspektiver er med (Trond 11.11.2026): `/no/perspektiver/` og `/en/perspectives/`, lenke i toppmenyen ved siden av The Week. Én fil per innlegg i `content/perspektiver/<id>.json`, med samme tekst som på Substack (endres ikke her). Byline er DARA Redaksjonen; deltakeren nevnes i teksten med lenke for kontakt, ikke som forfatter. Finnes et innlegg bare på ett språk, vises det på det andre språket med en linje om det.
- «I samarbeid med» LeanIn uten lenke til LeanIn er lansert.
- Vi lover ikke hvor ofte artiklene kommer. The Week kommer hver lørdag.
- Teksten i artiklene er DARAs: endre den ikke her. Rettelser gjøres i DARA Redaksjon.
- Språkreglene i agent-oppsett (`.claude/skills/sprakregler/SKILL.md`) gjelder alt annet som skrives.
- Ingen passord, nøkler eller personopplysninger i koden. E-postadresser lagres bare i D1-databasen `dara-abonnenter`, aldri i koden, i `content/` eller på GitHub. Endringer i e-postlisten krever hele laget (Don, Katherine og Margaret).
- Domenet daramag.com, DNS og Substacks innstillinger endres bare av Trond.
