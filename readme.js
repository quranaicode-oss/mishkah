(function(window){
  'use strict';
  const w = window;
  const Mishkah = w.Mishkah = w.Mishkah || {};

  function loadSync(path){
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', path, false);
      xhr.overrideMimeType('text/plain; charset=utf-8');
      xhr.send(null);
      if (xhr.status >= 200 && xhr.status < 400) {
        return xhr.responseText;
      }
    } catch (err) {
      console.warn('[Mishkah.readme] Failed to load', path, err);
    }
    return '';
  }

  const baseAr = loadSync('./README-Base.md');
  const baseEnRaw = loadSync('./README-Base.en.md');
  const tecArRaw = loadSync('./README.md');
  const tecEnRaw = loadSync('./README.en.md');

  const tecAr = tecArRaw || baseAr;
  const readmeStore = {
    base: {
      ar: baseAr,
      en: baseEnRaw || baseAr
    },
    tec: {
      ar: tecAr,
      en: tecEnRaw || tecAr
    }
  };

  Mishkah.readme = readmeStore;
})(window);
