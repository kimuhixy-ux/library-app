// app.js: 画面全体の配線(一覧・検索・詳細・追加ボタン)
(async () => {
  const listEl = document.getElementById('book-list');
  const emptyEl = document.getElementById('empty-message');
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');
  const detailView = document.getElementById('detail-view');
  const detailContent = document.getElementById('detail-content');
  const addView = document.getElementById('add-view');
  const addButton = document.getElementById('add-button');

  function openSheet(el) {
    el.hidden = false;
  }

  function closeSheet(el) {
    el.hidden = true;
  }

  function showList(books) {
    const onSelect = (book) => {
      Render.renderDetail(detailContent, book);
      openSheet(detailView);
    };
    const grouped = sortSelect.value === 'country';
    listEl.classList.toggle('grouped', grouped);
    if (grouped) {
      Render.renderGroupedByCountry(listEl, books, onSelect);
    } else {
      Render.renderList(listEl, books, onSelect);
    }
    emptyEl.hidden = books.length !== 0;
  }

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.close);
      if (target === addView) Scan.stopScanner();
      closeSheet(target);
    });
  });

  searchInput.addEventListener('input', () => {
    showList(BookStore.search(searchInput.value));
  });

  sortSelect.addEventListener('change', () => {
    showList(BookStore.search(searchInput.value));
  });

  addButton.addEventListener('click', () => {
    Scan.renderAddFlow(document.getElementById('add-content'), {
      onSaved: (book) => {
        BookStore.addLocal(book);
        closeSheet(addView);
        showList(BookStore.search(searchInput.value));
      },
    });
    openSheet(addView);
  });

  await BookStore.load();
  showList(BookStore.getAll());

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
})();
