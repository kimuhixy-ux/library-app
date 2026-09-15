// functions/api/books.js
// Cloudflare Pages Functions: 追加した本をKVに保存し、すぐ一覧に反映するためのAPI。
// なぜKVか: このアプリはCloudflare Access配下の非公開ページなので、
// 書き込みAPIも同じホスト・同じAccess保護の範囲に収まる(別のIDやトークンを持たせない)。
const KV_PREFIX = 'book:';
const REQUIRED_FIELDS = ['isbn', 'title'];

export async function onRequestGet({ env }) {
  const list = await env.LIBRARY_KV.list({ prefix: KV_PREFIX });
  const books = await Promise.all(
    list.keys.map(async (key) => {
      const value = await env.LIBRARY_KV.get(key.name);
      return value ? JSON.parse(value) : null;
    })
  );
  return Response.json(books.filter(Boolean));
}

export async function onRequestPost({ request, env }) {
  const book = await request.json();

  for (const field of REQUIRED_FIELDS) {
    if (!book[field]) {
      return Response.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  await env.LIBRARY_KV.put(KV_PREFIX + book.isbn, JSON.stringify(book));
  return Response.json(book, { status: 201 });
}
