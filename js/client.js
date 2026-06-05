/* global TrelloPowerUp */
(function () {
  'use strict';

  const DATA_KEY = 'nestedChecklistData';
  const DEFAULT_TITLE = 'Nested Checklist';
  const ICON = new URL('../assets/checklist.svg', document.currentScript.src).href;

  function makeId() {
    return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map((item) => ({
      id: String(item.id || makeId()),
      t: String(item.t || item.text || 'Без назви'),
      d: item.d ? 1 : 0,
      c: item.c ? 1 : 0,
      ch: normalizeItems(item.ch || item.children || []),
    }));
  }

  function normalizeData(data) {
    if (!data || typeof data !== 'object') return { v: 3, ttl: DEFAULT_TITLE, ac: 0, i: [], u: null };
    return {
      v: 3,
      ttl: String(data.ttl || data.title || DEFAULT_TITLE).trim() || DEFAULT_TITLE,
      ac: data.ac ? 1 : 0,
      i: normalizeItems(data.i || data.items || []),
      u: data.u || data.updatedAt || null,
    };
  }

  function count(items) {
    return (items || []).reduce((acc, item) => {
      acc.total += 1;
      if (item.d) acc.done += 1;
      const childCount = count(item.ch);
      acc.total += childCount.total;
      acc.done += childCount.done;
      return acc;
    }, { total: 0, done: 0 });
  }

  function getProgressText(data) {
    const stats = count(normalizeData(data).i);
    if (!stats.total) return null;
    return `${stats.done}/${stats.total}`;
  }

  function openEditor(t) {
    return t.get('card', 'shared', DATA_KEY, null).then((data) => {
      const title = normalizeData(data).ttl;
      return t.modal({
        title,
        url: t.signUrl('./nested.html'),
        height: 760,
        fullscreen: false,
        accentColor: '#0079BF',
      });
    });
  }

  window.TrelloPowerUp.initialize({
    'card-buttons': function () {
      return [{
        icon: ICON,
        text: 'Nested Checklist',
        condition: 'edit',
        callback: openEditor,
      }];
    },

    'card-back-section': function (t) {
      return t.get('card', 'shared', DATA_KEY, null).then((data) => {
        const normalized = normalizeData(data);
        return {
          title: normalized.ttl,
          icon: ICON,
          content: {
            type: 'iframe',
            url: t.signUrl('./section.html'),
            height: 360,
          },
          action: {
            text: 'Open editor',
            callback: openEditor,
          },
        };
      });
    },

    'card-badges': function (t) {
      return t.get('card', 'shared', DATA_KEY, null).then((data) => {
        const normalized = normalizeData(data);
        const text = getProgressText(normalized);
        if (!text) return [];
        const stats = count(normalized.i);
        return [{
          icon: ICON,
          text: `${normalized.ttl}: ${text}`,
          color: stats.done === stats.total ? 'green' : 'blue',
        }];
      });
    },

    'card-detail-badges': function (t) {
      return t.get('card', 'shared', DATA_KEY, null).then((data) => {
        const normalized = normalizeData(data);
        const text = getProgressText(normalized);
        if (!text) return [];
        const stats = count(normalized.i);
        return [{
          title: normalized.ttl,
          text: `${text} виконано`,
          color: stats.done === stats.total ? 'green' : 'blue',
          callback: openEditor,
        }];
      });
    },
  });
}());
