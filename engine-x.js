(function () {
  function slim() {
    const casa = document.getElementById('btn-toggle-editor');
    if (casa) casa.style.display = 'none';
    const top = document.querySelector('.top-bar');
    if (top) {
      const btns = top.querySelectorAll('.btn-panel-toggle');
      if (btns.length > 1) {
        btns[0].style.display = 'none';
      }
    }
    const bar = document.getElementById('action-bar-container');
    if (bar) {
      bar.style.transform = 'scale(0.82)';
      bar.style.transformOrigin = 'bottom right';
      bar.style.opacity = '0.88';
    }
    const tel = document.getElementById('telemetry-bar');
    if (tel) {
      tel.style.maxWidth = '58vw';
      tel.style.overflow = 'hidden';
    }
    const bag = document.querySelector('button');
    document.querySelectorAll('body > button').forEach(function (b) {
      if (b.textContent === 'Mochila') {
        b.style.top = 'auto';
        b.style.bottom = '118px';
        b.style.right = '10px';
        b.style.left = 'auto';
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', slim);
  else slim();
  setTimeout(slim, 200);
})();
