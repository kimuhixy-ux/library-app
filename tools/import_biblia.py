#!/usr/bin/env python3
"""Biblia(iPhone蔵書アプリ)のCSVエクスポートを data/books.json に変換する。

Dropboxの「アプリ/Biblia」フォルダには複数の書き出しファイルがあり、
一番新しいファイル(books.csv)はExcel/Numbersで開かれた影響でISBN列が
指数表記(9.78456E+12など)に壊れている。他の古いファイルにはISBNが
壊れずに残っているので、タイトル+著者+出版社で突き合わせて復元する。

再実行すれば常に最新のCSVからdata/books.jsonを作り直せる(冪等)。
"""
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

BIBLIA_DIR = Path.home() / "Library/CloudStorage/Dropbox/アプリ/Biblia"
MAIN_FILE = "books.csv"
REPAIR_FILES = ["books3.csv", "books4.csv", "books1.csv", "books 2.csv"]
OUT_FILE = Path(__file__).resolve().parent.parent / "data" / "books.json"


def load_rows(path: Path) -> list[list[str]]:
    with path.open(encoding="utf-8-sig") as fh:
        return list(csv.reader(fh))


def build_isbn_repair_lookup() -> dict[tuple[str, str, str], str]:
    lookup: dict[tuple[str, str, str], str] = {}
    for name in REPAIR_FILES:
        path = BIBLIA_DIR / name
        if not path.exists():
            continue
        for row in load_rows(path):
            if len(row) < 6:
                continue
            key = (row[0].strip(), row[2].strip(), row[4].strip())
            lookup[key] = row[5].strip()
    return lookup


def to_iso_date(s: str) -> str:
    s = s.strip()
    m = re.match(r"^(\d{4})/(\d{1,2})/(\d{1,2})$", s)
    if not m:
        return ""
    y, mo, d = m.groups()
    return f"{y}-{int(mo):02d}-{int(d):02d}"


def main() -> None:
    main_path = BIBLIA_DIR / MAIN_FILE
    rows = load_rows(main_path)
    repair = build_isbn_repair_lookup()

    books = []
    seen_isbn: dict[str, int] = {}
    unresolved = []

    for row in rows:
        # 想定外の列数(pandas経由で壊れた行など)はスキップして知らせる
        if len(row) < 11:
            unresolved.append(row)
            continue

        title = unicodedata.normalize("NFC", row[0].strip())
        author = row[2].strip()
        publisher = row[4].strip()
        isbn = row[5].strip()

        if "E+" in isbn or "e+" in isbn:
            key = (row[0].strip(), author, publisher)
            fixed = repair.get(key)
            if fixed:
                isbn = fixed
            else:
                unresolved.append(row)
                continue

        synopsis = row[7].strip()
        character_relations = row[8].strip() if len(row) > 8 else ""
        cover_image_url = row[9].strip() if len(row) > 9 else ""
        detail_url = row[10].strip() if len(row) > 10 else ""
        registered_at = to_iso_date(row[6]) or to_iso_date(row[11] if len(row) > 11 else "")
        rating_raw = row[13].strip() if len(row) > 13 else "0"
        try:
            rating = int(rating_raw)
        except ValueError:
            rating = 0

        book = {
            "id": "",
            "isbn": isbn,
            "title": title,
            "author": author,
            "publisher": publisher,
            "registeredAt": registered_at,
            "synopsis": synopsis,
            "characterRelations": character_relations,
            "themes": "",
            "duplicateTitleNote": "",
            "coverImageUrl": cover_image_url,
            "detailUrl": detail_url,
            "rating": rating,
        }
        books.append(book)
        seen_isbn[isbn] = seen_isbn.get(isbn, 0) + 1

    # 同一タイトルが複数存在する場合に注記を自動セット(蔵書内での同名検出)
    title_counts: dict[str, int] = {}
    for b in books:
        title_counts[b["title"]] = title_counts.get(b["title"], 0) + 1
    for b in books:
        if title_counts[b["title"]] > 1:
            others = sorted(
                {
                    f'{o["author"]}（{o["publisher"]}）'
                    for o in books
                    if o["title"] == b["title"] and o["isbn"] != b["isbn"]
                }
            )
            if others:
                b["duplicateTitleNote"] = "同名の書籍が蔵書内に他にあります: " + " / ".join(others)

    dup_isbn = {k: v for k, v in seen_isbn.items() if v > 1}

    # 同じISBNが複数回登録されている場合(再読・再スキャンなど)はidを枝番で分ける
    seen_count: dict[str, int] = {}
    for b in books:
        seen_count[b["isbn"]] = seen_count.get(b["isbn"], 0) + 1
        n = seen_count[b["isbn"]]
        b["id"] = b["isbn"] if n == 1 else f'{b["isbn"]}-{n}'

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(
        json.dumps(books, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"書き出し件数: {len(books)}")
    print(f"ISBN復元不能で除外: {len(unresolved)}")
    for r in unresolved:
        print("  除外:", r[0] if r else r)
    print(f"ISBN重複(要確認): {len(dup_isbn)}")
    for k, v in list(dup_isbn.items())[:20]:
        print("  ", k, v)
    print(f"同名タイトル注記を付与した件数: {sum(1 for b in books if b['duplicateTitleNote'])}")
    print(f"出力先: {OUT_FILE}")


if __name__ == "__main__":
    sys.exit(main())
