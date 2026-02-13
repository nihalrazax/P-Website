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
      // Flipped pages: lower index = further back on the left
      // Unflipped pages: higher stacking so the top page is the current spread
      pages[i].style.zIndex = i < currentSpread ? i + 1 : pages.length - i + 1;
    }
  }

  function flipNext() {
    if (currentSpread >= pages.length || isAnimating) return;
    isAnimating = true;
    var flipping = pages[currentSpread];
    // Boost z-index of flipping page so it appears above others during animation
    flipping.style.zIndex = pages.length + 10;
    flipping.classList.add('flipped');
    currentSpread++;
    // Reset z-index after flip completes
    setTimeout(function () {
      updateZIndex();
      isAnimating = false;
    }, 1000);
    updateControls();
  }

  function flipPrev() {
    if (currentSpread <= 0 || isAnimating) return;
    isAnimating = true;
    currentSpread--;
    var flipping = pages[currentSpread];
    // Boost z-index of flipping page so it appears above others during animation
    flipping.style.zIndex = pages.length + 10;
    flipping.classList.remove('flipped');
    // Reset z-index after flip completes
    setTimeout(function () {
      updateZIndex();
      isAnimating = false;
    }, 1000);
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

  // ── Fullscreen 3D Flipbook Viewer ──
  var fsOverlay = null;
  var fsPrevBtn = null;
  var fsNextBtn = null;
  var fsIndicator = null;
  var fsBookContainer = null;
  var fsPages = [];
  var fsCurrentSpread = 0;
  var fsIsAnimating = false;
  var fsIsOpen = false;

  function createFsOverlay() {
    if (fsOverlay) return;
    fsOverlay = document.createElement('div');
    fsOverlay.className = 'gfx-fs-overlay';
    fsOverlay.innerHTML =
      '<button class="gfx-fs-close">&times;</button>' +
      '<div class="gfx-fs-page-wrapper">' +
        '<div class="gfx-fs-book-container"></div>' +
      '</div>' +
      '<div class="gfx-fs-controls">' +
        '<button class="gfx-fs-nav-btn" id="gfx-fs-prev">&#10094; Prev</button>' +
        '<span class="gfx-fs-indicator" id="gfx-fs-indicator">Page 1 / 1</span>' +
        '<button class="gfx-fs-nav-btn" id="gfx-fs-next">Next &#10095;</button>' +
      '</div>';
    document.body.appendChild(fsOverlay);

    fsBookContainer = fsOverlay.querySelector('.gfx-fs-book-container');
    fsPrevBtn = fsOverlay.querySelector('#gfx-fs-prev');
    fsNextBtn = fsOverlay.querySelector('#gfx-fs-next');
    fsIndicator = fsOverlay.querySelector('#gfx-fs-indicator');
    var closeBtn = fsOverlay.querySelector('.gfx-fs-close');
    var wrapper = fsOverlay.querySelector('.gfx-fs-page-wrapper');

    closeBtn.addEventListener('click', closeFsViewer);
    fsOverlay.addEventListener('click', function (e) {
      if (e.target === fsOverlay || e.target === wrapper) closeFsViewer();
    });
    fsPrevBtn.addEventListener('click', function () { fsFlipPrev(); });
    fsNextBtn.addEventListener('click', function () { fsFlipNext(); });

    // Keyboard navigation
    document.addEventListener('keydown', function (e) {
      if (!fsIsOpen) return;
      if (e.key === 'Escape') closeFsViewer();
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') fsFlipPrev();
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') fsFlipNext();
    });

    // Swipe gesture on fullscreen book
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

    wrapper.addEventListener('touchend', function (e) {
      if (!isSwiping) return;
      isSwiping = false;
      var diffX = e.changedTouches[0].clientX - touchStartX;
      var diffY = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) fsFlipNext();
        else fsFlipPrev();
      }
    }, { passive: true });

    wrapper.addEventListener('touchmove', function () {
      // Cancel swipe if too much vertical movement
    }, { passive: true });
  }

  function fsBuildBook() {
    fsBookContainer.innerHTML = '';
    fsPages = [];
    for (var i = 0; i < renderedCanvases.length; i += 2) {
      var spreadIdx = Math.floor(i / 2);
      var pageDiv = document.createElement('div');
      pageDiv.className = 'gfx-page';
      pageDiv.setAttribute('data-spread', spreadIdx);

      var front = document.createElement('div');
      front.className = 'gfx-page-front';
      // Clone canvas content
      var frontCanvas = document.createElement('canvas');
      frontCanvas.width = renderedCanvases[i].width;
      frontCanvas.height = renderedCanvases[i].height;
      frontCanvas.getContext('2d').drawImage(renderedCanvases[i], 0, 0);
      front.appendChild(frontCanvas);

      var back = document.createElement('div');
      back.className = 'gfx-page-back';
      if (renderedCanvases[i + 1]) {
        var backCanvas = document.createElement('canvas');
        backCanvas.width = renderedCanvases[i + 1].width;
        backCanvas.height = renderedCanvases[i + 1].height;
        backCanvas.getContext('2d').drawImage(renderedCanvases[i + 1], 0, 0);
        back.appendChild(backCanvas);
      }

      pageDiv.appendChild(front);
      pageDiv.appendChild(back);
      fsBookContainer.appendChild(pageDiv);
      fsPages.push(pageDiv);

      // Click on page to flip
      (function (idx) {
        pageDiv.addEventListener('click', function (e) {
          e.stopPropagation();
          if (fsIsAnimating) return;
          if (idx === fsCurrentSpread) fsFlipNext();
          else if (idx === fsCurrentSpread - 1) fsFlipPrev();
        });
      })(spreadIdx);
    }

    // Apply flipped state up to current spread
    for (var j = 0; j < fsCurrentSpread; j++) {
      fsPages[j].classList.add('flipped');
    }
    fsUpdateZIndex();
  }

  function fsUpdateZIndex() {
    for (var i = 0; i < fsPages.length; i++) {
      fsPages[i].style.zIndex = i < fsCurrentSpread ? i + 1 : fsPages.length - i + 1;
    }
  }

  function fsFlipNext() {
    if (fsCurrentSpread >= fsPages.length || fsIsAnimating) return;
    fsIsAnimating = true;
    var flipping = fsPages[fsCurrentSpread];
    flipping.style.zIndex = fsPages.length + 10;
    flipping.classList.add('flipped');
    fsCurrentSpread++;
    setTimeout(function () {
      fsUpdateZIndex();
      fsIsAnimating = false;
    }, 1000);
    fsUpdateControls();
  }

  function fsFlipPrev() {
    if (fsCurrentSpread <= 0 || fsIsAnimating) return;
    fsIsAnimating = true;
    fsCurrentSpread--;
    var flipping = fsPages[fsCurrentSpread];
    flipping.style.zIndex = fsPages.length + 10;
    flipping.classList.remove('flipped');
    setTimeout(function () {
      fsUpdateZIndex();
      fsIsAnimating = false;
    }, 1000);
    fsUpdateControls();
  }

  function fsUpdateControls() {
    fsPrevBtn.disabled = fsCurrentSpread <= 0;
    fsNextBtn.disabled = fsCurrentSpread >= fsPages.length;
    var startPage = fsCurrentSpread * 2 + 1;
    var total = currentPdf ? currentPdf.numPages : 1;
    var endPage = Math.min(startPage + 1, total);
    fsIndicator.textContent = 'Page ' + startPage +
      (startPage !== endPage ? '-' + endPage : '') + ' / ' + total;
  }

  function openFsViewer() {
    if (!renderedCanvases.length || !currentPdf) return;
    createFsOverlay();
    // Sync to the current spread of the inline flipbook
    fsCurrentSpread = currentSpread;
    fsBuildBook();
    fsUpdateControls();
    fsIsOpen = true;
    fsOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeFsViewer() {
    if (!fsOverlay) return;
    fsIsOpen = false;
    fsOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Full Size button
  if (fsBtn) {
    fsBtn.addEventListener('click', openFsViewer);
  }

  // ── Double-tap & Long-press on flipbook to open fullscreen ──
  var lastTapTime = 0;
  var longPressTimer = null;

  container.addEventListener('touchstart', function () {
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
