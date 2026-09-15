// functions/api/ndl-lookup.js
// Cloudflare Pages Functions: openBDに無い書誌をNDLサーチ(国立国会図書館)で補うための中継API。
// なぜ中継が必要か: ndlsearch.ndl.go.jpはCORS(異なるオリジンからのfetchを許可する仕組み)の
// ヘッダーを返さないため、ブラウザから直接fetchするとブロックされる。
// サーバー側(Pages Functions)経由にすればCORSの制約を受けない。
export async function onRequestGet({ request }) {
  const isbn = new URL(request.url).searchParams.get('isbn');
  if (!isbn) {
    return Response.json({ error: 'isbn is required' }, { status: 400 });
  }

  const ndlRes = await fetch(`https://ndlsearch.ndl.go.jp/api/opensearch?isbn=${encodeURIComponent(isbn)}`);
  const xml = await ndlRes.text();
  const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/);
  if (!itemMatch) {
    return Response.json(null);
  }

  const item = itemMatch[1];
  const title = extractFirst(item, 'dc:title');
  const author = extractAll(item, 'dc:creator').join('/');
  const publisher = extractFirst(item, 'dc:publisher');

  return Response.json({ isbn, title, author, publisher });
}

function extractFirst(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`));
  return m ? decodeEntities(m[1].trim()) : '';
}

function extractAll(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'g');
  const results = [];
  let m;
  while ((m = re.exec(xml))) {
    results.push(decodeEntities(m[1].trim()));
  }
  return results;
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
