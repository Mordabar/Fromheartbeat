// Classic script (runs before the ES-module graph finishes downloading): a link from the email says what it is opening while the studio loads.
(function () {
  var q = new URLSearchParams(location.search);
  if (!q.has('session')) return;
  var h = document.getElementById('lobby-hint');
  if (h) h.innerHTML = '<b>' + (q.get('share') === '1' ? 'Abriendo tu regalo…' : 'Abriendo tus canciones…') + '</b>';
})();
