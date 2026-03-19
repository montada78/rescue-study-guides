// Product form upload logic - loaded at bottom of page, DOM is ready
(function() {
  var pdfInput = document.getElementById('pdf_file');
  if (!pdfInput) return;

  var formEl   = document.getElementById('productForm');
  var upBtn    = document.getElementById('uploadNowBtn');
  var pdfLabel = document.getElementById('pdfLabel');

  // ── Step 1: file(s) chosen ───────────────────────────────────────────────
  pdfInput.addEventListener('change', function() {
    if (!this.files || !this.files[0]) return;
    var files     = Array.from(this.files);
    var totalSize = files.reduce(function(s, f) { return s + f.size; }, 0);
    var totalMB   = (totalSize / 1024 / 1024).toFixed(1);
    var label     = files.length === 1 ? files[0].name : files.length + ' files (' + totalMB + ' MB total)';

    document.getElementById('pdfLabelText').textContent = label + ' — ready';
    pdfLabel.style.borderColor = '#2563eb';
    pdfLabel.style.background  = '#eff6ff';

    document.getElementById('uploadFileName').textContent = label;
    document.getElementById('uploadPercent').textContent  = '0%';
    document.getElementById('uploadBar').style.width      = '0%';
    document.getElementById('uploadBar').style.background = '#2563eb';
    document.getElementById('uploadStatus').textContent   = 'Ready — click Upload PDF Now';
    document.getElementById('uploadProgressWrap').style.display = 'block';

    upBtn.style.display     = 'block';
    upBtn.style.background  = '#2563eb';
    upBtn.style.color       = '#ffffff';
    upBtn.style.cursor      = 'pointer';
    upBtn.style.opacity     = '1';
    upBtn.disabled          = false;
    document.getElementById('uploadNowText').textContent = files.length > 1
      ? 'Upload ' + files.length + ' PDFs Now' : 'Upload PDF Now';

    window._pdfUploaded = false;
  });

  // ── Step 2: Upload Now ───────────────────────────────────────────────────
  upBtn.addEventListener('click', function() {
    var files = pdfInput.files;
    if (!files || !files[0]) { alert('Please choose a PDF file first.'); return; }

    var formData = new FormData(formEl);
    var xhr      = new XMLHttpRequest();

    upBtn.disabled         = true;
    upBtn.style.background = '#9ca3af';
    upBtn.style.cursor     = 'not-allowed';
    document.getElementById('uploadNowText').textContent = 'Uploading…';

    xhr.upload.addEventListener('progress', function(e) {
      if (!e.lengthComputable) return;
      var pct    = Math.round((e.loaded / e.total) * 100);
      var loaded = (e.loaded / 1024 / 1024).toFixed(1);
      var total  = (e.total  / 1024 / 1024).toFixed(1);
      document.getElementById('uploadBar').style.width     = pct + '%';
      document.getElementById('uploadPercent').textContent = pct + '%';
      document.getElementById('uploadStatus').textContent  =
        pct < 100 ? pct + '% — ' + loaded + ' MB of ' + total + ' MB' : '⏳ Saving on server…';
    });

    xhr.addEventListener('load', function() {
      var resp = null;
      try { resp = JSON.parse(xhr.responseText); } catch(e) {}

      if (xhr.status < 400 && resp && resp.success) {
        document.getElementById('uploadBar').style.width      = '100%';
        document.getElementById('uploadBar').style.background = '#16a34a';
        document.getElementById('uploadPercent').textContent  = '100%';
        document.getElementById('uploadStatus').textContent   = '✅ Saved! Redirecting…';
        upBtn.style.background = '#16a34a';
        document.getElementById('uploadNowText').textContent  = '✅ Done';
        window._pdfUploaded = true;
        setTimeout(function() { window.location.href = resp.redirect || '/admin/products'; }, 1500);
      } else {
        var msg = (resp && resp.message) ? resp.message : 'Error (HTTP ' + xhr.status + ')';
        document.getElementById('uploadStatus').textContent = '❌ ' + msg;
        document.getElementById('uploadBar').style.background = '#dc2626';
        upBtn.disabled         = false;
        upBtn.style.background = '#dc2626';
        upBtn.style.cursor     = 'pointer';
        document.getElementById('uploadNowText').textContent = 'Retry';
      }
    });

    xhr.addEventListener('error', function() {
      document.getElementById('uploadStatus').textContent   = '❌ Network error — retry.';
      document.getElementById('uploadBar').style.background = '#dc2626';
      upBtn.disabled         = false;
      upBtn.style.background = '#dc2626';
      upBtn.style.cursor     = 'pointer';
      document.getElementById('uploadNowText').textContent  = 'Retry';
    });

    xhr.open('POST', formEl.action);
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.timeout = 600000;
    xhr.send(formData);
  });

  // ── Save Guide (text fields only) ────────────────────────────────────────
  window.saveGuide = function() {
    var hasPdf = pdfInput.files && pdfInput.files[0];
    if (hasPdf && !window._pdfUploaded) {
      if (!confirm('PDF(s) chosen but not uploaded yet.\nOK = save without PDFs\nCancel = go back and upload first')) return;
    }
    formEl.submit();
  };

})();
