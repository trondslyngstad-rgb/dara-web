// Påmelding til DARA på Substack fra daramag.com. Svaret vises i boksen på siden (Don 10.11.2026).
// Bruker Substacks eget påmeldingsendepunkt, det samme som Substacks innebygde skjema bruker. Det er ikke dokumentert av Substack,
// så siden faller tilbake til en lenke til Substacks påmeldingsside hvis dette feiler. E-postadressen lagres ikke her.
// Vern mot misbruk (Katherine 10.11.2026): bare kall fra vår egen side, bare JSON, og et skjult lokkefelt for roboter.
// I tillegg bør Cloudflare ha en regel for antall forsøk på /api/abonner (legges inn av Trond).
// Innstilling i Cloudflare: SUBSTACK (for eksempel https://substack.daramag.com).
export async function onRequestPost({ request, env }) {
  const egen = new URL(request.url).origin;
  if (request.headers.get('Origin') !== egen) return svar(403, 'feil');
  if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return svar(415, 'feil');
  let data;
  try { data = await request.json(); } catch { return svar(400, 'ugyldig'); }
  if (data && data.nettsted) return svar(200, 'ok'); // lokkefeltet er fylt ut: en robot
  const epost = String((data && data.epost) || '').trim();
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(epost) || epost.length > 254) return svar(400, 'ugyldig');
  const side = String(data.side || '').startsWith(egen + '/') ? String(data.side).slice(0, 300) : egen + '/';
  if (!env.SUBSTACK) return svar(503, 'feil');
  const base = env.SUBSTACK.replace(/\/$/, '');
  try {
    const s = await fetch(`${base}/api/v1/free`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: epost, first_url: side, first_referrer: '', current_url: side, current_referrer: '', referral_code: '', source: 'embed' }),
    });
    if (s.ok) return svar(200, 'ok');
    console.log('substack svarte', s.status, (await s.text()).slice(0, 300));
    return svar(424, 'feil', s.status);
  } catch (e) {
    console.log('substack feilet', String(e));
    return svar(424, 'feil', 0);
  }
}
const svar = (status, resultat, kode) => new Response(JSON.stringify(kode === undefined ? { resultat } : { resultat, kode }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
