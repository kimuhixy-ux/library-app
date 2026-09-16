// render.js: 一覧カードと詳細シートの描画
// なぜ: 外部データ(書名・あらすじなど)はinnerHTMLに渡さず、textContentで組み立てる(XSS対策)
const Render = (() => {
  const cardTemplate = document.getElementById('book-card-template');

  function buildCard(book, onSelect) {
    const card = cardTemplate.content.firstElementChild.cloneNode(true);
    const cover = card.querySelector('.book-card-cover');
    cover.src = book.coverImageUrl || '';
    cover.alt = book.title;
    card.querySelector('.book-card-title').textContent = book.title;
    card.querySelector('.book-card-author').textContent = book.author;
    card.addEventListener('click', () => onSelect(book));
    return card;
  }

  function renderList(container, books, onSelect) {
    container.textContent = '';
    for (const book of books) {
      container.appendChild(buildCard(book, onSelect));
    }
  }

  // 国別整理オプション用: originCountryごとに見出し+グリッドを並べる
  // なぜMapで集約するか: 国名の出現順に関わらず、見出しの並び順を安定させたいため
  function renderGroupedByCountry(container, books, onSelect) {
    container.textContent = '';
    const groups = new Map();
    for (const book of books) {
      const key = book.originCountry || '国不明';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(book);
    }
    const keys = [...groups.keys()].sort((a, b) => {
      if (a === '国不明') return 1;
      if (b === '国不明') return -1;
      return a.localeCompare(b, 'ja');
    });
    for (const key of keys) {
      const heading = document.createElement('h2');
      heading.className = 'country-heading';
      heading.textContent = `${key}(${groups.get(key).length})`;
      container.appendChild(heading);

      const grid = document.createElement('div');
      grid.className = 'book-list';
      for (const book of groups.get(key)) {
        grid.appendChild(buildCard(book, onSelect));
      }
      container.appendChild(grid);
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

  function externalLink(label, url) {
    const link = document.createElement('a');
    link.className = 'external-link';
    link.href = url;
    link.textContent = label;
    link.target = '_blank';
    link.rel = 'noopener';
    return link;
  }

  // 販売サイトと読書メモサイトへのリンク一覧を組み立てる
  // なぜGoogleのsite検索経由か: 読書メーター・ブクログは内部検索のURL仕様が不確かで、
  // ISBNやタイトルで直接リンクを組み立てると本が見つからない場合があるため
  function buildExternalLinks(book) {
    const wrap = document.createElement('div');
    wrap.className = 'detail-field';

    const shopHeading = document.createElement('h3');
    shopHeading.textContent = '販売サイトで見る';
    wrap.appendChild(shopHeading);

    const shopList = document.createElement('div');
    shopList.className = 'link-list';
    if (book.detailUrl) {
      shopList.appendChild(externalLink('楽天ブックス', book.detailUrl));
    }
    if (book.isbn) {
      shopList.appendChild(
        externalLink('Amazon', `https://www.amazon.co.jp/s?k=${encodeURIComponent(book.isbn)}`)
      );
    }
    wrap.appendChild(shopList);

    const query = `${book.title} ${book.author}`.trim();
    if (query) {
      const noteHeading = document.createElement('h3');
      noteHeading.textContent = '他の人の読書メモを見る';
      wrap.appendChild(noteHeading);

      const noteList = document.createElement('div');
      noteList.className = 'link-list';
      const encodedQuery = encodeURIComponent(query);
      noteList.appendChild(
        externalLink('読書メーター', `https://www.google.com/search?q=site:bookmeter.com+${encodedQuery}`)
      );
      noteList.appendChild(
        externalLink('ブクログ', `https://www.google.com/search?q=site:booklog.jp+${encodedQuery}`)
      );
      wrap.appendChild(noteList);
    }

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
      ['原作の国', book.originCountry],
      ['初版発行日', book.firstPublishedDate],
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

    container.appendChild(buildExternalLinks(book));
  }

  return { renderList, renderGroupedByCountry, renderDetail };
})();
