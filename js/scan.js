// scan.js: バーコード読み取り→openBDで書誌情報取得→確認フォーム→保存
const Scan = (() => {
  const SCANNER_ID = 'scan-region';
  let html5QrCode = null;

  async function stopScanner() {
    if (html5QrCode) {
      try {
        await html5QrCode.stop();
      } catch (e) {
        // 既に停止済みの場合は無視
      }
      html5QrCode.clear();
      html5QrCode = null;
    }
  }

  async function lookupOpenBd(isbn) {
    const res = await fetch(`https://api.openbd.jp/v1/get?isbn=${encodeURIComponent(isbn)}`);
    const [entry] = await res.json();
    if (!entry) return null;
    const s = entry.summary || {};
    return {
      isbn,
      title: s.title || '',
      author: s.author || '',
      publisher: s.publisher || '',
    };
  }

  // openBDに無い書誌(古い文庫の再版など)をNDLサーチ(国立国会図書館)で補うフォールバック
  // なぜ自前のAPI経由か: ndlsearch.ndl.go.jpはCORS非対応のため、ブラウザから直接fetchできない
  async function lookupNdl(isbn) {
    const res = await fetch(`/api/ndl-lookup?isbn=${encodeURIComponent(isbn)}`);
    if (!res.ok) return null;
    const info = await res.json();
    if (!info || !info.title) return null;
    return info;
  }

  function buildForm(container, prefill, onSubmit, note) {
    container.textContent = '';

    const heading = document.createElement('h2');
    heading.textContent = '本の情報を確認';
    container.appendChild(heading);

    // note: この時点で以前のstatus要素はcontainer.textContent=''により消えているため、
    // 案内文はフォーム側で改めて表示する
    if (note) {
      const noteEl = document.createElement('p');
      noteEl.className = 'scan-status';
      noteEl.textContent = note;
      container.appendChild(noteEl);
    }

    const fields = {};
    const rows = [
      ['isbn', 'ISBN', 'input'],
      ['title', 'タイトル', 'input'],
      ['author', '著者', 'input'],
      ['publisher', '出版社', 'input'],
      ['synopsis', 'あらすじ', 'textarea'],
      ['characterRelations', '登場人物の相関', 'textarea'],
      ['themes', 'テーマ', 'textarea'],
      ['originCountry', '原作の国', 'input'],
      ['firstPublishedDate', '初版発行日', 'input'],
    ];

    for (const [key, label, tag] of rows) {
      const row = document.createElement('div');
      row.className = 'form-row';
      const l = document.createElement('label');
      l.textContent = label;
      const input = document.createElement(tag);
      input.value = prefill[key] || '';
      if (key === 'isbn') input.readOnly = true;
      row.appendChild(l);
      row.appendChild(input);
      container.appendChild(row);
      fields[key] = input;
    }

    const saveBtn = document.createElement('button');
    saveBtn.className = 'primary-button';
    saveBtn.type = 'button';
    saveBtn.textContent = '保存';
    saveBtn.addEventListener('click', () => {
      const book = {
        isbn: fields.isbn.value.trim(),
        title: fields.title.value.trim(),
        author: fields.author.value.trim(),
        publisher: fields.publisher.value.trim(),
        synopsis: fields.synopsis.value.trim(),
        characterRelations: fields.characterRelations.value.trim(),
        themes: fields.themes.value.trim(),
        originCountry: fields.originCountry.value.trim(),
        firstPublishedDate: fields.firstPublishedDate.value.trim(),
      };
      onSubmit(book);
    });
    container.appendChild(saveBtn);
  }

  function showStatus(container, message) {
    const p = document.createElement('p');
    p.className = 'scan-status';
    p.textContent = message;
    container.appendChild(p);
    return p;
  }

  async function saveBook(book, { onSaved, onError, statusEl }) {
    const others = BookStore.findByTitle(book.title);
    if (others.length) {
      const names = others.map((o) => `${o.author}（${o.publisher}）`).join(' / ');
      book.duplicateTitleNote = `同名の書籍が蔵書内に他にあります: ${names}`;
    } else {
      book.duplicateTitleNote = '';
    }
    book.registeredAt = new Date().toISOString().slice(0, 10);
    book.coverImageUrl = '';
    book.detailUrl = '';
    book.rating = 0;
    book.id = book.isbn;

    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(book),
      });
      if (!res.ok) throw new Error(`保存に失敗しました (${res.status})`);
      onSaved(book);
    } catch (e) {
      statusEl.textContent = `保存エラー: ${e.message}`;
      if (onError) onError(e);
    }
  }

  function renderAddFlow(container, { onSaved }) {
    container.textContent = '';
    const scanRegion = document.createElement('div');
    scanRegion.id = SCANNER_ID;
    container.appendChild(scanRegion);
    const status = showStatus(container, 'バーコードにカメラを向けてください');

    html5QrCode = new Html5Qrcode(SCANNER_ID);
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 120 },
      formatsToSupport: [Html5QrcodeSupportedFormats.EAN_13],
    };

    html5QrCode
      .start({ facingMode: 'environment' }, config, async (isbn) => {
        await stopScanner();

        // 同じISBNが既に蔵書内にある場合は、再検索せずその旨を伝えて既存データをプリフィルする
        // (物理的な重複所有もあり得るため、保存自体は引き続き可能にする)
        const existing = BookStore.findByIsbn(isbn);
        if (existing.length) {
          const info = existing[0];
          buildForm(
            container,
            info,
            (book) => saveBook(book, { onSaved, statusEl: status }),
            `この本は既に登録されています(登録日: ${info.registeredAt || '不明'})。同じ本をもう一冊登録する場合はそのまま保存してください。`
          );
          return;
        }

        status.textContent = `ISBN ${isbn} を検索中...`;
        try {
          const info = (await lookupOpenBd(isbn)) || (await lookupNdl(isbn));
          if (!info) {
            buildForm(
              container,
              { isbn },
              (book) => saveBook(book, { onSaved, statusEl: status }),
              'openBDにも国立国会図書館サーチにも情報が見つかりませんでした。手入力してください。'
            );
            return;
          }
          buildForm(container, info, (book) => saveBook(book, { onSaved, statusEl: status }));
        } catch (e) {
          status.textContent = `検索エラー: ${e.message}`;
        }
      })
      .catch((e) => {
        status.textContent = `カメラを起動できません: ${e.message}`;
      });
  }

  return { renderAddFlow, stopScanner };
})();
