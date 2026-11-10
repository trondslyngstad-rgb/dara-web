// Påmelding til DARA på Substack fra daramag.com. Svaret vises i boksen på siden (Don 10.11.2026).
// Bruker Substacks eget påmeldingsendepunkt, det samme som Substacks innebygde skjema bruker. Det er ikke dokumentert av Substack,
// så siden faller tilbake til en lenke til Substacks påmeldingsside hvis dette feiler. E-postadressen lagres ikke her.
// Innstilling i Cloudflare: SUBSTACK (for eksempel https://substack.daramag.com). Uten den brukes https://www.daramag.com.
export async function onRequestPost({ request, env }) {
  let data;
  try { data = await request.json(); } catch { return svar(400, 'ugyldig'); }
  const epost = String((data && data.epost) || '').trim();
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(epost) || epost.length > 254) return svar(400, 'ugyldig');
  const side = /^https:\/\//.test(String(data.side || '')) ? String(data.side).slice(0, 300) : '';
  const base = (env.SUBSTACK || 'https://www.daramag.com').replace(/\/$/, '');
  try {
    const s = await fetch(`${base}/api/v1/free`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: epost, first_url: side, first_referrer: '', current_url: side, current_referrer: '', referral_code: '', source: 'embed' }),
    });
    if (!s.ok) return svar(502, 'feil');
    return svar(200, 'ok');
  } catch {
    return svar(502, 'feil');
  }
}
const svar = (status, resultat) => new Response(JSON.stringify({ resultat }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
