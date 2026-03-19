// product-form.js  — runs immediately, DOM is already ready (loaded at page bottom)
(function () {
  // ── Element refs ────────────────────────────────────────────────────────────
  var pdfInput      = document.getElementById('pdf_file');
  if (!pdfInput) return;                        // guard: only run on product form

  var formEl        = document.getElementById('productForm');
  var dropZone      = document.getElementById('pdfLabel');
  var dropText      = document.getElementById('pdfLabelText');
  var uploadNowBtn  = document.getElementById('uploadNowBtn');
  var uploadNowTxt  = document.getElementById('uploadNowText');
  var progressWrap  = document.getElementById('uploadProgressWrap');
  var uploadBar     = document.getElementById('uploadBar');
  var uploadPercent = document.getElementById('uploadPercent');
  var uploadStatus  = document.getElementById('uploadStatus');
  var uploadFileName= document.getElementById('uploadFileName');
  var saveUploadBtn = document.getElementById('saveUploadBtn');   // NEW btn

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function mb(bytes) { return (bytes / 1024 / 1024).toFixed(1); }

  function setProgress(pct, loaded, total) {
    uploadBar.style.width        = pct + '%';
    uploadPercent.textContent    = pct + '%';
    uploadPercent.style.color    = pct === 100 ? '#16a34a' : '#2563eb';
    uploadBar.style.background   = pct === 100 ? '#16a34a' : '#2563eb';
    if (pct < 100) {
      uploadStatus.textContent   = pct + '% — ' + mb(loaded) + ' MB of ' + mb(total) + ' MB uploaded';
      uploadStatus.style.color   = '#6b7280';
    }
  }

  function activateSaveUpload(redirectUrl) {
    // progress bar full + green
    uploadBar.style.width      = '100%';
    uploadBar.style.background = '#16a34a';
    uploadPercent.textContent  = '100%';
    uploadPercent.style.color  = '#16a34a';
    uploadStatus.textContent   = '✅ Upload complete! Click "Save Upload" to continue.';
    uploadStatus.style.color   = '#16a34a';

    // Upload Now btn → done state
    uploadNowBtn.disabled          = true;
    uploadNowBtn.style.background  = '#6b7280';
    uploadNowBtn.style.cursor      = 'not-allowed';
    uploadNowTxt.textContent       = '✅ Uploaded';

    // Activate Save Upload button
    saveUploadBtn.disabled         = false;
    saveUploadBtn.style.background = '#16a34a';
    saveUploadBtn.style.color      = '#ffffff';
    saveUploadBtn.style.cursor     = 'pointer';
    saveUploadBtn.style.opacity    = '1';
    saveUploadBtn.style.animation  = 'pulse 1.5s infinite';
    saveUploadBtn.setAttribute('data-redirect', redirectUrl || '/admin/products');

    window._uploadRedirect = redirectUrl || '/admin/products';
  }

  function resetUploadBtn(label, bgColor) {
    uploadNowBtn.disabled         = false;
    uploadNowBtn.style.background = bgColor || '#dc2626';
    uploadNowBtn.style.cursor     = 'pointer';
    uploadNowTxt.textContent      = label || 'Retry Upload';
  }

  // ── Step 1: file chosen ──────────────────────────────────────────────────────
  pdfInput.addEventListener('change', function () {
    if (!this.files || !this.files[0]) return;
    var f = this.files[0];

    // Update drop-zone
    dropText.textContent       = '📄 ' + f.name + ' (' + mb(f.size) + ' MB) — ready to upload';
    dropZone.style.borderColor = '#2563eb';
    dropZone.style.background  = '#eff6ff';

    // Reset progress bar
    uploadFileName.textContent = f.name;
    setProgress(0, 0, f.size);
    uploadStatus.textContent   = 'Click "Upload PDF Now" to start uploading';
    progressWrap.style.display = 'block';

    // Show Upload Now button, reset Save Upload
    uploadNowBtn.style.display  = 'block';
    uploadNowBtn.disabled       = false;
    uploadNowBtn.style.background = '#2563eb';
    uploadNowBtn.style.cursor   = 'pointer';
    uploadNowBtn.style.opacity  = '1';
    uploadNowTxt.textContent    = 'Upload PDF Now';

    saveUploadBtn.disabled      = true;
    saveUploadBtn.style.background = '#9ca3af';
    saveUploadBtn.style.cursor  = 'not-allowed';
    saveUploadBtn.style.opacity = '0.6';
    saveUploadBtn.style.animation = 'none';

    window._uploadRedirect = null;
  });

  // ── Step 2: Upload Now ───────────────────────────────────────────────────────
  uploadNowBtn.addEventListener('click', function () {
    var file = pdfInput.files && pdfInput.files[0];
    if (!file) { alert('Please choose a PDF file first.'); return; }

    // Lock button during upload
    uploadNowBtn.disabled         = true;
    uploadNowBtn.style.background = '#9ca3af';
    uploadNowBtn.style.cursor     = 'not-allowed';
    uploadNowTxt.textContent      = 'Uploading…';

    var formData = new FormData(formEl);
    var xhr      = new XMLHttpRequest();

    // ── Live progress ──
    xhr.upload.addEventListener('progress', function (e) {
      if (!e.lengthComputable) return;
      var pct = Math.round((e.loaded / e.total) * 100);
      setProgress(pct, e.loaded, e.total);
      if (pct === 100) {
        uploadStatus.textContent = '⏳ Processing on server… please wait';
        uploadStatus.style.color = '#d97706';
      }
    });

    // ── Upload complete ──
    xhr.addEventListener('load', function () {
      var resp = null;
      try { resp = JSON.parse(xhr.responseText); } catch (e) {}

      if (xhr.status < 400 && resp && resp.success) {
        activateSaveUpload(resp.redirect);
      } else {
        var msg = (resp && resp.message) ? resp.message : 'Server error (HTTP ' + xhr.status + ')';
        uploadStatus.textContent   = '❌ ' + msg;
        uploadStatus.style.color   = '#dc2626';
        uploadBar.style.background = '#dc2626';
        resetUploadBtn('Retry Upload', '#dc2626');
      }
    });

    // ── Network error ──
    xhr.addEventListener('error', function () {
      uploadStatus.textContent   = '❌ Network error — check your connection and retry.';
      uploadStatus.style.color   = '#dc2626';
      uploadBar.style.background = '#dc2626';
      resetUploadBtn('Retry Upload', '#dc2626');
    });

    // ── Timeout (10 min) ──
    xhr.addEventListener('timeout', function () {
      uploadStatus.textContent   = '❌ Upload timed out — try a smaller file or retry.';
      uploadStatus.style.color   = '#dc2626';
      uploadBar.style.background = '#dc2626';
      resetUploadBtn('Retry Upload', '#dc2626');
    });

    xhr.open('POST', formEl.action);
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.timeout = 600000; // 10 min
    xhr.send(formData);
  });

  // ── Step 3: Save Upload button ───────────────────────────────────────────────
  saveUploadBtn.addEventListener('click', function () {
    var url = window._uploadRedirect || '/admin/products';
    window.location.href = url;
  });

  // ── Save Guide (sidebar red button — text fields only) ───────────────────────
  window.saveGuide = function () {
    var hasPdf = pdfInput.files && pdfInput.files[0];
    if (hasPdf && !window._uploadRedirect) {
      if (!confirm('You have chosen a PDF but have not uploaded it yet.\n\nOK = save text fields without PDF\nCancel = go back and click "Upload PDF Now" first')) return;
    }
    formEl.submit();
  };

})();
