// data.js: 蔵書データの読み込みと検索
// なぜ: 一覧表示と追加機能の両方から同じデータストアを使うため、読み込み処理を1箇所にまとめている
const BookStore = (() => {
  let books = [];

  async function load() {
    const res = await fetch('data/books.json');
    const staticBooks = await res.json();
    const addedBooks = await loadAdded();
    books = [...addedBooks, ...staticBooks];
    return books;
  }

  // Cloudflare Pages Functions未対応のローカル環境(python http.server)では
  // 404/接続失敗になるので、その場合は静的データのみで動く
  async function loadAdded() {
    try {
      const res = await fetch('/api/books');
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  }

  function getAll() {
    return books;
  }

  function getById(id) {
    return books.find((b) => b.id === id);
  }

  function search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) => {
      return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
    });
  }

  function findByTitle(title) {
    return books.filter((b) => b.title === title);
  }

  function addLocal(book) {
    books.unshift(book);
  }

  return { load, getAll, getById, search, findByTitle, addLocal };
})();
