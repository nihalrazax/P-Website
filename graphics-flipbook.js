(function () {
  if (typeof pdfjsLib === 'undefined') return;
  var container = document.getElementById('gfx-book-container');
  var prevBtn = document.getElementById('gfx-prev-btn');
  var nextBtn = document.getElementById('gfx-next-btn');
  var indicator = document.getElementById('gfx-page-indicator');
  var fsBtn = document.getElementById('gfx-fullscreen-btn');
  var tabs = document.querySelectorAll('.gfx-menu-tab');
  if (!container || !prevBtn || !nextBtn || !indicator || !tabs.length) return;

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  var currentPdf = null;
  var pages = [];
  var currentSpread = 0;
  var isAnimating = false;
  var renderedCanvases = []; // Store all rendered canvases for fullscreen

  function loadPdf(url) {
    container.classList.add('loading');
    container.innerHTML = '';
    pages = [];
    currentSpread = 0;
    renderedCanvases = [];

    pdfjsLib.getDocument(url).promise.then(function (pdf) {
      currentPdf = pdf;
      var renderPromises = [];
      for (var i = 1; i <= pdf.numPages; i++) {
        renderPromises.push(renderPage(pdf, i));
      }
      Promise.all(renderPromises).then(function (canvases) {
        renderedCanvases = canvases;
        buildBook(canvases);
        container.classList.remove('loading');
        updateControls();
      });
    }).catch(function () {
      container.classList.remove('loading');
      container.innerHTML =
        '<p style="text-align:center;color:#999;padding:40px;">Could not load PDF. Please check the file path.</p>';
    });
  }

  // Render at high resolution (3x) for crisp text, CSS scales it down to fit
  function renderPage(pdf, pageNum) {
    return pdf.getPage(pageNum).then(function (page) {
      // Render at 3x native scale for sharp text
      var scaled = page.getViewport({ scale: 3 });

      var canvas = document.createElement('canvas');
      canvas.width = scaled.width;
      canvas.height = scaled.height;
      var ctx = canvas.getContext('2d');

      return page.render({ canvasContext: ctx, viewport: scaled }).promise.then(function () {
        return canvas;
      });
    });
  }

  function buildBook(canvases) {
    for (var i = 0; i < canvases.length; i += 2) {
      var spreadIdx = Math.floor(i / 2);
      var pageDiv = document.createElement('div');
      pageDiv.className = 'gfx-page';
      pageDiv.setAttribute('data-spread', spreadIdx);

      var front = document.createElement('div');
      front.className = 'gfx-page-front';
      front.appendChild(canvases[i]);

      var back = document.createElement('div');
      back.className = 'gfx-page-back';
      if (canvases[i + 1]) {
        back.appendChild(canvases[i + 1]);
      }

      pageDiv.appendChild(front);
      pageDiv.appendChild(back);
      container.appendChild(pageDiv);
      pages.push(pageDiv);

      // Click on page to flip
      (function (idx) {
        pageDiv.addEventListener('click', function () {
          if (isAnimating) return;
          // If this page is the current unflipped page (right side), flip forward
          if (idx === currentSpread) {
            flipNext();
          }
          // If this page is the last flipped page (left side), flip back
          else if (idx === currentSpread - 1) {
            flipPrev();
          }
        });
      })(spreadIdx);
    }
    updateZIndex();
  }

  function updateZIndex() {
    for (var i = 0; i < pages.length; i++) {
      pages[i].style.zIndex = i < currentSpread ? i : pages.length - i;
    }
  }

  function flipNext() {
    if (currentSpread >= pages.length || isAnimating) return;
    isAnimating = true;
    pages[currentSpread].classList.add('flipped');
    currentSpread++;
    updateZIndex();
    setTimeout(function () { isAnimating = false; }, 800);
    updateControls();
  }

  function flipPrev() {
    if (currentSpread <= 0 || isAnimating) return;
    isAnimating = true;
    currentSpread--;
    pages[currentSpread].classList.remove('flipped');
    updateZIndex();
    setTimeout(function () { isAnimating = false; }, 800);
    updateControls();
  }

  function updateControls() {
    prevBtn.disabled = currentSpread <= 0;
    nextBtn.disabled = currentSpread >= pages.length;
    var startPage = currentSpread * 2 + 1;
    var total = currentPdf ? currentPdf.numPages : 1;
    var endPage = Math.min(startPage + 1, total);
    indicator.textContent = 'Page ' + startPage +
      (startPage !== endPage ? '-' + endPage : '') + ' / ' + total;
  }

  nextBtn.addEventListener('click', flipNext);
  prevBtn.addEventListener('click', flipPrev);

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      if (tab.classList.contains('active')) return;
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      loadPdf(tab.getAttribute('data-menu'));
    });
  });

  var firstTab = document.querySelector('.gfx-menu-tab.active');
  if (firstTab) {
    loadPdf(firstTab.getAttribute('data-menu'));
  }

  // ── Fullscreen Menu Viewer ──
  var fsOverlay = null;
  var fsPageImg = null;
  var fsPrevBtn = null;
  var fsNextBtn = null;
  var fsIndicator = null;
  var fsCurrentPage = 0;
  var fsIsOpen = false;

  function createFsOverlay() {
    if (fsOverlay) return;
    fsOverlay = document.createElement('div');
    fsOverlay.className = 'gfx-fs-overlay';
    fsOverlay.innerHTML =
      '<button class="gfx-fs-close">&times;</button>' +
      '<div class="gfx-fs-page-wrapper">' +
        '<span class="gfx-fs-swipe-left">&#10094;</span>' +
        '<canvas class="gfx-fs-page-img"></canvas>' +
        '<span class="gfx-fs-swipe-right">&#10095;</span>' +
      '</div>' +
      '<div class="gfx-fs-controls">' +
        '<button class="gfx-fs-nav-btn" id="gfx-fs-prev">&#10094; Prev</button>' +
        '<span class="gfx-fs-indicator" id="gfx-fs-indicator">1 / 1</span>' +
        '<button class="gfx-fs-nav-btn" id="gfx-fs-next">Next &#10095;</button>' +
      '</div>';
    document.body.appendChild(fsOverlay);

    fsPageImg = fsOverlay.querySelector('.gfx-fs-page-img');
    fsPrevBtn = fsOverlay.querySelector('#gfx-fs-prev');
    fsNextBtn = fsOverlay.querySelector('#gfx-fs-next');
    fsIndicator = fsOverlay.querySelector('#gfx-fs-indicator');
    var closeBtn = fsOverlay.querySelector('.gfx-fs-close');
    var wrapper = fsOverlay.querySelector('.gfx-fs-page-wrapper');

    closeBtn.addEventListener('click', closeFsViewer);
    fsOverlay.addEventListener('click', function (e) {
      if (e.target === fsOverlay) closeFsViewer();
    });
    fsPrevBtn.addEventListener('click', function () { fsSwitchPage(-1); });
    fsNextBtn.addEventListener('click', function () { fsSwitchPage(1); });

    // Keyboard navigation
    document.addEventListener('keydown', function (e) {
      if (!fsIsOpen) return;
      if (e.key === 'Escape') closeFsViewer();
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') fsSwitchPage(-1);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') fsSwitchPage(1);
    });

    // Swipe gesture on fullscreen page
    var touchStartX = 0;
    var touchStartY = 0;
    var isSwiping = false;

    wrapper.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isSwiping = true;
      }
    }, { passive: true });

    wrapper.addEventListener('touchmove', function (e) {
      // allow default scroll if vertical
    }, { passive: true });

    wrapper.addEventListener('touchend', function (e) {
      if (!isSwiping) return;
      isSwiping = false;
      var touchEndX = e.changedTouches[0].clientX;
      var touchEndY = e.changedTouches[0].clientY;
      var diffX = touchEndX - touchStartX;
      var diffY = touchEndY - touchStartY;

      // Only process horizontal swipes (more X movement than Y)
      if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) {
          fsSwitchPage(1); // Swipe left = next
        } else {
          fsSwitchPage(-1); // Swipe right = prev
        }
      }
    }, { passive: true });
  }

  function openFsViewer() {
    if (!renderedCanvases.length || !currentPdf) return;
    createFsOverlay();
    // Start at the current spread's first page
    fsCurrentPage = currentSpread * 2;
    if (fsCurrentPage >= renderedCanvases.length) fsCurrentPage = 0;
    fsIsOpen = true;
    fsRenderPage();
    fsOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeFsViewer() {
    if (!fsOverlay) return;
    fsIsOpen = false;
    fsOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function fsRenderPage() {
    if (!renderedCanvases[fsCurrentPage]) return;
    var src = renderedCanvases[fsCurrentPage];
    // Copy the source canvas to the display canvas
    fsPageImg.width = src.width;
    fsPageImg.height = src.height;
    var ctx = fsPageImg.getContext('2d');
    ctx.clearRect(0, 0, fsPageImg.width, fsPageImg.height);
    ctx.drawImage(src, 0, 0);

    var total = currentPdf ? currentPdf.numPages : 1;
    fsIndicator.textContent = (fsCurrentPage + 1) + ' / ' + total;
    fsPrevBtn.disabled = fsCurrentPage <= 0;
    fsNextBtn.disabled = fsCurrentPage >= renderedCanvases.length - 1;
  }

  function fsSwitchPage(dir) {
    var next = fsCurrentPage + dir;
    if (next < 0 || next >= renderedCanvases.length) return;
    fsCurrentPage = next;

    // Animate transition
    fsPageImg.style.opacity = '0';
    fsPageImg.style.transform = dir > 0 ? 'translateX(-30px) scale(0.95)' : 'translateX(30px) scale(0.95)';
    setTimeout(function () {
      fsRenderPage();
      fsPageImg.style.transform = dir > 0 ? 'translateX(30px) scale(0.95)' : 'translateX(-30px) scale(0.95)';
      // Force reflow
      void fsPageImg.offsetWidth;
      fsPageImg.style.opacity = '1';
      fsPageImg.style.transform = 'translateX(0) scale(1)';
    }, 150);
  }

  // Full Size button
  if (fsBtn) {
    fsBtn.addEventListener('click', openFsViewer);
  }

  // ── Double-tap & Long-press on flipbook to open fullscreen ──
  var lastTapTime = 0;
  var longPressTimer = null;

  container.addEventListener('touchstart', function (e) {
    // Long press: start timer
    longPressTimer = setTimeout(function () {
      longPressTimer = null;
      openFsViewer();
    }, 600);
  }, { passive: true });

  container.addEventListener('touchend', function (e) {
    // Clear long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    // Double tap detection
    var now = Date.now();
    if (now - lastTapTime < 350) {
      e.preventDefault();
      openFsViewer();
      lastTapTime = 0;
    } else {
      lastTapTime = now;
    }
  });

  container.addEventListener('touchmove', function () {
    // Cancel long press if user moves finger
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }, { passive: true });
})();

// Gallery Lightbox
(function () {
  var lb = document.createElement('div');
  lb.className = 'gfx-lightbox';
  lb.innerHTML = '<button class="gfx-lightbox-close">&times;</button><img src="" alt="Preview" />';
  document.body.appendChild(lb);

  var lbImg = lb.querySelector('img');
  var lbClose = lb.querySelector('.gfx-lightbox-close');

  document.querySelectorAll('.gfx-gallery-item').forEach(function (item) {
    item.addEventListener('click', function () {
      var img = item.querySelector('img');
      if (!img) return;
      lbImg.src = img.src;
      lbImg.alt = img.alt;
      lb.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  function closeLb() {
    lb.classList.remove('active');
    document.body.style.overflow = '';
  }

  lbClose.addEventListener('click', closeLb);
  lb.addEventListener('click', function (e) {
    if (e.target === lb) closeLb();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLb();
  });
})();
