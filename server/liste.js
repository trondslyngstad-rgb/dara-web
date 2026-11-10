// DARAs egen e-postliste for The Week (Trond 10.11.2026: «en egen mailingliste overalt»).
// Steg 1: påmelding og bekreftelse her. The Week sendes inntil videre fra Substack; Trond henter nye bekreftede adresser i /api/eksport.
// Lagres: e-post, språk, hvor man meldte seg på, status og tidspunkter. Ikke navn og ikke IP-adressen.
// For å hindre misbruk lagres en kode laget av IP-adressen og et tilfeldig salt for dagen; begge slettes etter et døgn.
// Ubekreftede adresser slettes etter VENTER_DAGER dager.
// Innstillinger i Cloudflare: DB (D1-databasen), CF_ACCOUNT_ID og CF_EMAIL_TOKEN (Cloudflare Email Sending), EPOST_FRA (standard post@daramag.com), EKSPORT_PASSORD.

export const TILLATTE = [
  'https://daramag.com', 'https://www.daramag.com', 'https://magasin.daramag.com',
  'https://leanin.no', 'https://www.leanin.no', 'https://test.leanin-web.pages.dev', 'https://test.dara-web-8vv.pages.dev',
];
export const KILDER = ['daramag', 'theweek', 'leanin'];
export const GYLDIG = /^[a-z0-9._%+'-]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,}$/; // strengt nok til at en adresse ikke kan bli en formel i Excel
export const LENKE_DAGER = 7;
export const NY_EPOST_ETTER_MIN = 15;
export const MAKS_PER_IP_PER_TIME = 5;
export const MAKS_PER_ADRESSE = 3; // høyst så mange bekreftelser til en adresse som ikke er bekreftet (Katherine 10.11.2026)
export const MAKS_PER_DOGN = 300; // tak for hele listen, så skjemaet ikke kan brukes til å sende masse e-post
export const VENTER_DAGER = 7; // ubekreftede adresser slettes etter så mange dager

let klar = false;
export async function sikreTabeller(db) {
  if (klar) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS abonnenter (
      epost TEXT PRIMARY KEY, status TEXT NOT NULL, sprak TEXT NOT NULL, kilde TEXT NOT NULL, token TEXT NOT NULL UNIQUE,
      opprettet TEXT NOT NULL, sist_sendt TEXT, antall_sendt INTEGER NOT NULL DEFAULT 0, bekreftet TEXT, eksportert TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS forsok (kode TEXT NOT NULL, tid TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS salt (dato TEXT PRIMARY KEY, verdi TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sendinger (dato TEXT PRIMARY KEY, antall INTEGER NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS forsok_kode ON forsok (kode, tid)`),
  ]);
  klar = true;
}

export const naa = () => new Date().toISOString();
export const minutterSiden = (iso) => (Date.now() - Date.parse(iso)) / 60000;

export function nyToken() {
  const b = new Uint8Array(24); crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Rydder bort det som ikke skal ligge lenger: forsøk og salt eldre enn et døgn, ubekreftede adresser eldre enn VENTER_DAGER.
export async function rydd(db) {
  const dogn = new Date(Date.now() - 86400000).toISOString();
  await db.batch([
    db.prepare(`DELETE FROM forsok WHERE tid < ?`).bind(dogn),
    db.prepare(`DELETE FROM salt WHERE dato < ?`).bind(dogn.slice(0, 10)),
    db.prepare(`DELETE FROM sendinger WHERE dato < ?`).bind(dogn.slice(0, 10)),
    db.prepare(`DELETE FROM abonnenter WHERE status = 'venter' AND sist_sendt < ?`).bind(new Date(Date.now() - VENTER_DAGER * 86400000).toISOString()),
  ]);
}

// En kode laget av IP-adressen og et tilfeldig salt for dagen, så vi kan telle forsøk uten å lagre IP-adressen.
// Saltet slettes etter et døgn, og da kan koden ikke føres tilbake til IP-adressen. IPv6 telles per /64, siden én bruker ofte har et helt slikt nett.
export async function forsokKode(db, ip) {
  const dato = new Date().toISOString().slice(0, 10);
  await db.prepare(`INSERT OR IGNORE INTO salt (dato, verdi) VALUES (?, ?)`).bind(dato, nyToken()).run();
  const salt = (await db.prepare(`SELECT verdi FROM salt WHERE dato = ?`).bind(dato).first()).verdi;
  const del = ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip;
  const n = await crypto.subtle.importKey('raw', new TextEncoder().encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const h = await crypto.subtle.sign('HMAC', n, new TextEncoder().encode(del));
  return [...new Uint8Array(h)].slice(0, 12).map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Teller e-poster sendt i dag. Gir false når dagens tak er nådd.
export async function kanSendeIDag(db) {
  const dato = new Date().toISOString().slice(0, 10);
  const r = await db.prepare(`SELECT antall FROM sendinger WHERE dato = ?`).bind(dato).first();
  if (r && r.antall >= MAKS_PER_DOGN) return false;
  await db.prepare(`INSERT INTO sendinger (dato, antall) VALUES (?, 1) ON CONFLICT(dato) DO UPDATE SET antall = antall + 1`).bind(dato).run();
  return true;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const T = {
  no: {
    emne: 'Bekreft påmeldingen til The Week',
    hei: 'Hei!',
    tekst: 'Trykk på knappen, så får du DARA The Week på e-post hver lørdag.',
    knapp: 'Bekreft påmeldingen',
    ikke_deg: 'Ikke deg? Da kan du se bort fra denne e-posten.',
    nesten: 'Nesten ferdig',
    sjekk: 'Sjekk e-posten din og trykk «Bekreft påmeldingen».',
    spam: 'Ser du den ikke? Se i søppelposten.',
    tilbake: 'Tilbake',
    takk: 'Takk! Du får The Week hver lørdag.',
    les: 'Les siste utgave',
    forsiden: 'Til forsiden',
    utlopt: 'Denne lenken virker ikke lenger. Meld deg på igjen, så får du en ny.',
    meld_pa: 'Meld deg på',
    feil: 'Det gikk ikke. Prøv igjen om litt.',
    ugyldig: 'Sjekk e-postadressen.',
    bekreft_tittel: 'Bekreft påmeldingen til The Week',
  },
  en: {
    emne: 'Confirm your subscription to The Week',
    hei: 'Hi!',
    tekst: 'Tap the button to get DARA The Week by email every Saturday.',
    knapp: 'Confirm subscription',
    ikke_deg: 'Not you? You can ignore this email.',
    nesten: 'Almost done',
    sjekk: 'Check your email and tap “Confirm subscription”.',
    spam: "Can't find it? Check your spam folder.",
    tilbake: 'Back',
    takk: "Thanks! You'll get The Week every Saturday.",
    les: 'Read the latest issue',
    forsiden: 'Home',
    utlopt: "This link no longer works. Sign up again and we'll send you a new one.",
    meld_pa: 'Sign up',
    feil: "That didn't work. Try again in a moment.",
    ugyldig: 'Please check your email address.',
    bekreft_tittel: 'Confirm your subscription to The Week',
  },
};

export { MAGASIN } from './magasin.js'; // siste utgave av The Week; filen lages av build.js fra content/site.json

export const JSONHODER = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export function bekreftEpost(sp, lenke) {
  const t = T[sp];
  const tekst = `${t.hei}\n\n${t.tekst}\n\n${t.knapp}:\n${lenke}\n\n${t.ikke_deg}\n\nDARA · daramag.com\n`;
  const html = `<!doctype html><html lang="${sp}"><body style="margin:0;background:#F7F2E8;font-family:Georgia,serif;color:#0B1F44">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="font:800 28px/1 Georgia,serif;letter-spacing:2px;margin:0 0 24px">DARA</p>
<p style="font-size:17px;line-height:1.5;margin:0 0 12px">${esc(t.hei)}</p>
<p style="font-size:17px;line-height:1.5;margin:0 0 24px">${esc(t.tekst)}</p>
<p style="margin:0 0 28px"><a href="${esc(lenke)}" style="display:inline-block;background:#0B1F44;color:#ffffff;text-decoration:none;font:700 16px/1 Arial,sans-serif;padding:14px 22px;border-radius:8px">${esc(t.knapp)}</a></p>
<p style="font:400 14px/1.5 Arial,sans-serif;color:#5a6170;margin:0 0 24px">${esc(t.ikke_deg)}</p>
<p style="font:400 13px/1.5 Arial,sans-serif;color:#5a6170;margin:0">DARA · <a href="https://daramag.com/${sp}/" style="color:#5a6170">daramag.com</a></p>
</div></body></html>`;
  return { emne: t.emne, tekst, html };
}

export async function sendEpost(env, { til, emne, tekst, html }) {
  const fra = env.EPOST_FRA || 'post@daramag.com';
  if (!env.CF_EMAIL_TOKEN || !env.CF_ACCOUNT_ID) throw new Error('E-post er ikke satt opp (CF_EMAIL_TOKEN, CF_ACCOUNT_ID)');
  const nokkel = String(env.CF_EMAIL_TOKEN).trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${nokkel}`, 'content-type': 'application/json' },
    body: JSON.stringify({ to: til, from: fra, subject: emne, text: tekst, html }),
  });
  const svar = await r.json().catch(() => ({}));
  if (!r.ok || svar.success === false) throw new Error(`Cloudflare e-post svarte ${r.status}: ${JSON.stringify(svar.errors || '').slice(0, 300)}`);
}

// Enkel side i DARAs stil, for svar uten JavaScript og for bekreftelsen.
export function side(sp, tittel, innhold, status = 200) {
  const html = `<!doctype html><html lang="${sp}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(tittel)} · DARA</title><meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,800&family=Source+Serif+4:wght@400;600&family=Inter:wght@400;600;700&display=swap">
<link rel="stylesheet" href="/stil.css"></head>
<body><main class="liste-side"><p class="liste-logo"><a href="/${sp}/">DARA</a></p>${innhold}</main></body></html>`;
  return new Response(html, { status, headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self'; script-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'",
    'X-Content-Type-Options': 'nosniff',
  } });
}
