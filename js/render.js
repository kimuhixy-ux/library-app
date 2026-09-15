// render.js: 一覧カードと詳細シートの描画
// なぜ: 外部データ(書名・あらすじなど)はinnerHTMLに渡さず、textContentで組み立てる(XSS対策)
const Render = (() => {
  const cardTemplate = document.getElementById('book-card-template');

  function renderList(container, books, onSelect) {
    container.textContent = '';
    for (const book of books) {
      const card = cardTemplate.content.firstElementChild.cloneNode(true);
      const cover = card.querySelector('.book-card-cover');
      cover.src = book.coverImageUrl || '';
      cover.alt = book.title;
      card.querySelector('.book-card-title').textContent = book.title;
      card.querySelector('.book-card-author').textContent = book.author;
      card.addEventListener('click', () => onSelect(book));
      container.appendChild(card);
    }
  }

  function field(label, value) {
    if (!value) return null;
    const wrap = document.createElement('div');
    wrap.className = 'detail-field';
    const h = document.createElement('h3');
    h.textContent = label;
    const p = document.createElement('p');
    p.textContent = value;
    wrap.appendChild(h);
    wrap.appendChild(p);
    return wrap;
  }

  function renderDetail(container, book) {
    container.textContent = '';

    const title = document.createElement('h2');
    title.textContent = book.title;
    container.appendChild(title);

    if (book.coverImageUrl) {
      const cover = document.createElement('img');
      cover.className = 'detail-cover';
      cover.src = book.coverImageUrl;
      cover.alt = book.title;
      container.appendChild(cover);
    }

    if (book.duplicateTitleNote) {
      const note = document.createElement('div');
      note.className = 'duplicate-note';
      note.textContent = book.duplicateTitleNote;
      container.appendChild(note);
    }

    const basics = [
      ['著者', book.author],
      ['出版社', book.publisher],
      ['ISBN', book.isbn],
      ['登録日', book.registeredAt],
    ];
    for (const [label, value] of basics) {
      const el = field(label, value);
      if (el) container.appendChild(el);
    }

    const longFields = [
      ['あらすじ', book.synopsis],
      ['登場人物の相関', book.characterRelations],
      ['テーマ', book.themes],
    ];
    for (const [label, value] of longFields) {
      const el = field(label, value);
      if (el) container.appendChild(el);
    }

    if (book.detailUrl) {
      const link = document.createElement('a');
      link.href = book.detailUrl;
      link.textContent = '楽天ブックスで見る';
      link.target = '_blank';
      link.rel = 'noopener';
      container.appendChild(link);
    }
  }

  return { renderList, renderDetail };
})();
