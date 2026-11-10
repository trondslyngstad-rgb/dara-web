// Fil med nye bekreftede adresser, som Trond laster opp i Substack så lenge The Week sendes derfra (steg 1, Trond 10.11.2026).
// Bare adresser som ikke er hentet før kommer med, og de merkes som hentet, så ingen meldes på igjen ved en feil (Don 10.11.2026).
// Krever passordet EKSPORT_PASSORD (innstilling i Cloudflare). Nettleseren spør om brukernavn og passord; brukernavnet kan være hva som helst.
// ?alle=1 gir alle bekreftede adresser uten å merke dem.
import { sikreTabeller, naa } from '../../server/liste.js';

const nekt = () => new Response('Logg inn', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="DARA", charset="UTF-8"', 'Cache-Control': 'no-store' } });

async function likt(a, b) {
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let d = 0; for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}

export async function onRequestGet({ request, env }) {
  const passord = String(env.EKSPORT_PASSORD || '');
  if (passord.length < 12 || !env.DB) return new Response('Ikke satt opp', { status: 503 });
  const auth = request.headers.get('Authorization') || '';
  let gitt = '';
  try { gitt = atob(auth.replace(/^Basic\s+/i, '')).split(':').slice(1).join(':'); } catch { gitt = ''; }
  if (!auth.startsWith('Basic ') || !(await likt(gitt, passord))) return nekt();

  await sikreTabeller(env.DB);
  const alle = new URL(request.url).searchParams.get('alle') === '1';
  const rader = (await env.DB.prepare(`SELECT epost FROM abonnenter WHERE status = 'bekreftet'${alle ? '' : ' AND eksportert IS NULL'} ORDER BY bekreftet`).all()).results || [];
  if (!alle && rader.length) {
    const tid = naa();
    await env.DB.batch(rader.map((r) => env.DB.prepare(`UPDATE abonnenter SET eksportert = ? WHERE epost = ?`).bind(tid, r.epost)));
  }
  const csv = 'email\n' + rader.map((r) => r.epost).join('\n') + (rader.length ? '\n' : '');
  const dato = new Date().toISOString().slice(0, 10);
  return new Response(csv, { headers: {
    'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="dara-nye-abonnenter-${dato}.csv"`, 'Cache-Control': 'no-store',
  } });
}
