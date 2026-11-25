/* Reading Digest manual bookmark.
   Only click handlers write to localStorage. Scroll, load, hash, and history must never save or overwrite.
   One bookmark per browser: { date: 'YYYY-MM-DD', id: 'e-N' }. No account, no cross-device, no auto-jump.
*/
(function (root) {
  var KEY = 'readingDigest.bookmark';
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var ID_RE = /^e-\d+$/;
  var bound = false;
  var storageAvailable = true;
  var lastError = '';

  function announce(msg) {
    var el = root.document && document.querySelector('.r-bookmark-status');
    if (el) el.textContent = msg || '';
  }

  function getStore() {
    try {
      return root.localStorage;
    } catch (err) {
      storageAvailable = false;
      lastError = 'localStorage unavailable';
      return null;
    }
  }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var date = raw.date;
    var id = raw.id;
    if (typeof date !== 'string' || typeof id !== 'string') return null;
    if (!DATE_RE.test(date) || !ID_RE.test(id)) return null;
    return { date: date, id: id };
  }

  function read() {
    lastError = '';
    var store = getStore();
    if (!store) return null;
    var txt;
    try {
      txt = store.getItem(KEY);
    } catch (err) {
      storageAvailable = false;
      lastError = 'read failed';
      return null;
    }
    if (txt == null || txt === '') return null;
    var parsed;
    try {
      parsed = JSON.parse(txt);
    } catch (err) {
      try { store.removeItem(KEY); } catch (e2) {}
      return null;
    }
    var bm = normalize(parsed);
    if (!bm) {
      try { store.removeItem(KEY); } catch (e2) {}
      return null;
    }
    return bm;
  }

  function write(bm) {
    lastError = '';
    var norm = normalize(bm);
    if (!norm) {
      lastError = 'invalid bookmark';
      return false;
    }
    var store = getStore();
    if (!store) {
      announce('无法保存书签，浏览器可能禁用了本地存储');
      return false;
    }
    try {
      store.setItem(KEY, JSON.stringify(norm));
      storageAvailable = true;
      announce('已标记到 ' + norm.date + ' 第 ' + norm.id.slice(2) + ' 条');
      return true;
    } catch (err) {
      storageAvailable = false;
      lastError = 'write failed';
      announce('无法保存书签，浏览器可能禁用了本地存储');
      return false;
    }
  }

  function clear() {
    lastError = '';
    var store = getStore();
    if (!store) {
      announce('无法清除书签，浏览器可能禁用了本地存储');
      return false;
    }
    try {
      store.removeItem(KEY);
      storageAvailable = true;
      announce('已清除标记');
      return true;
    } catch (err) {
      storageAvailable = false;
      lastError = 'clear failed';
      announce('无法清除书签，浏览器可能禁用了本地存储');
      return false;
    }
  }

  function pageDate() {
    var doc = root.document;
    if (doc) {
      var marked = doc.querySelector('[data-digest-date]');
      if (marked) {
        var d = marked.getAttribute('data-digest-date');
        if (d && DATE_RE.test(d)) return d;
      }
    }
    var path = (root.location && root.location.pathname) || '';
    var m = path.match(/digest-(\d{4}-\d{2}-\d{2})\.html$/);
    if (m) return m[1];
    if (root.DIGEST_ARCHIVE && root.DIGEST_ARCHIVE.length && root.DIGEST_ARCHIVE[0].d) {
      return root.DIGEST_ARCHIVE[0].d;
    }
    return '';
  }

  function entryNum(id) {
    return id ? id.replace(/^e-/, '') : '';
  }

  function paintRail(bm) {
    var doc = root.document;
    if (!doc) return;
    var lis = doc.querySelectorAll('.rail .a-list li');
    for (var i = 0; i < lis.length; i++) {
      lis[i].classList.remove('r-has-bookmark');
      var old = lis[i].querySelector('.r-bookmark-slot');
      if (old) old.parentNode.removeChild(old);
    }
    if (!bm) return;
    var li = doc.querySelector('.rail .a-list li[data-date="' + bm.date + '"]');
    if (!li) return;
    li.classList.add('r-has-bookmark');
    var slot = doc.createElement('span');
    slot.className = 'r-bookmark-slot';
    var link = doc.createElement('a');
    link.className = 'r-last-read';
    link.href = 'digest-' + bm.date + '.html#' + bm.id;
    link.textContent = '上次读到';
    link.setAttribute('aria-label', '上次读到 ' + bm.date + ' 第 ' + entryNum(bm.id) + ' 条');
    var clr = doc.createElement('button');
    clr.type = 'button';
    clr.className = 'r-clear-mark';
    clr.textContent = '清除';
    clr.setAttribute('aria-label', '清除阅读书签');
    slot.appendChild(link);
    slot.appendChild(clr);
    li.appendChild(slot);
  }

  function paintEntries(bm) {
    var doc = root.document;
    if (!doc) return;
    var date = pageDate();
    var entries = doc.querySelectorAll('article.r-entry[data-entry-id]');
    for (var i = 0; i < entries.length; i++) {
      var art = entries[i];
      var id = art.getAttribute('data-entry-id');
      var on = !!(bm && bm.date === date && bm.id === id);
      art.classList.toggle('r-bookmarked', on);
      var btn = art.querySelector('.r-mark-here');
      if (!btn) continue;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on) {
        btn.textContent = '清除标记';
        btn.setAttribute('aria-label', '清除标记，第 ' + entryNum(id) + ' 条');
      } else {
        btn.textContent = '标记读到这里';
        btn.setAttribute('aria-label', '标记读到这里，第 ' + entryNum(id) + ' 条');
      }
    }
  }

  function paint() {
    var bm = read();
    paintRail(bm);
    paintEntries(bm);
    return bm;
  }

  function onMarkClick(btn) {
    var id = btn.getAttribute('data-entry-id');
    var date = pageDate();
    if (!id || !DATE_RE.test(date) || !ID_RE.test(id)) return;
    var bm = read();
    if (bm && bm.date === date && bm.id === id) clear();
    else write({ date: date, id: id });
    paint();
  }

  function onDocumentClick(ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var mark = t.closest('.r-mark-here');
    if (mark) {
      ev.preventDefault();
      onMarkClick(mark);
      return;
    }
    var clr = t.closest('.r-clear-mark');
    if (clr) {
      ev.preventDefault();
      clear();
      paint();
    }
  }

  function bind() {
    if (bound || !root.document) return;
    root.document.addEventListener('click', onDocumentClick);
    bound = true;
  }

  function init() {
    bind();
    paint();
    /* Do not scroll, do not change location, do not write storage on load. */
  }

  var api = {
    KEY: KEY,
    read: read,
    write: write,
    clear: clear,
    pageDate: pageDate,
    paint: paint,
    init: init,
    bind: bind,
    normalize: normalize,
    get lastError() { return lastError; },
    get storageAvailable() { return storageAvailable; },
    get bound() { return bound; }
  };

  root.ReadingBookmark = api;
  /* Script is inlined at the end of the page; required nodes already exist. Init now.
     Do not wait for DOMContentLoaded — and never write storage or jump on init. */
  if (root.document) init();
})(typeof window !== 'undefined' ? window : globalThis);
