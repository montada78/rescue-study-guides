// product-form.js  — handles PDF + preview uploads & form submission
(function () {
  'use strict';

  // ── Element refs ──────────────────────────────────────────────────────────
  var pdfInput      = document.getElementById('pdf_file');
  var previewInput  = document.getElementById('preview_images_input');
  var upBtn         = document.getElementById('uploadNowBtn');
  var pdfLabel      = document.getElementById('pdfLabel');
  var productForm   = document.getElementById('productForm');

  if (!pdfInput || !upBtn) return; // guard

  // ── Helpers ───────────────────────────────────────────────────────────────
  function setProgress(pct, status, color) {
    var bar = document.getElementById('uploadBar');
    var pctEl = document.getElementById('uploadPercent');
    var statusEl = document.getElementById('uploadStatus');
    if (bar)    { bar.style.width = pct + '%'; if (color) bar.style.background = color; }
    if (pctEl)  pctEl.textContent = pct + '%';
    if (statusEl) statusEl.textContent = status;
  }

  function showUploadUI(label) {
    document.getElementById('uploadFileName').textContent = label;
    setProgress(0, 'Ready — click Upload Files Now', '#2563eb');
    document.getElementById('uploadProgressWrap').style.display = 'block';
    upBtn.style.display    = 'inline-flex';
    upBtn.style.background = '#2563eb';
    upBtn.style.color      = '#ffffff';
    upBtn.style.cursor     = 'pointer';
    upBtn.style.opacity    = '1';
    upBtn.disabled         = false;
    window._filesUploaded  = false;
  }

  // ── Step 1: PDF file(s) chosen ────────────────────────────────────────────
  pdfInput.addEventListener('change', function () {
    if (!this.files || !this.files[0]) return;
    var files     = Array.from(this.files);
    var totalSize = files.reduce(function (s, f) { return s + f.size; }, 0);
    var totalMB   = (totalSize / 1024 / 1024).toFixed(1);
    var label     = files.length === 1
      ? files[0].name
      : files.length + ' PDFs (' + totalMB + ' MB total)';

    document.getElementById('pdfLabelText').textContent = label + ' — ready to upload';
    if (pdfLabel) {
      pdfLabel.style.borderColor = '#2563eb';
      pdfLabel.style.background  = '#eff6ff';
    }
    document.getElementById('uploadNowText').textContent =
      files.length > 1 ? 'Upload ' + files.length + ' PDFs Now' : 'Upload PDF Now';
    showUploadUI(label);
  });

  // ── Step 1b: Preview images chosen ───────────────────────────────────────
  if (previewInput) {
    previewInput.addEventListener('change', function () {
      if (!this.files || !this.files[0]) return;
      var count = this.files.length;
      var label = count + ' preview image' + (count > 1 ? 's' : '') + ' selected';
      // Show the upload button even if no PDF chosen
      if (upBtn.style.display === 'none' || upBtn.style.display === '') {
        document.getElementById('uploadNowText').textContent = 'Upload Images Now';
        showUploadUI(label);
      } else {
        document.getElementById('uploadFileName').textContent =
          document.getElementById('uploadFileName').textContent + ' + ' + label;
      }
      window._filesUploaded = false;
    });
  }

  // ── Step 2: Upload Now ────────────────────────────────────────────────────
  upBtn.addEventListener('click', function () {
    var hasPdfs     = pdfInput.files && pdfInput.files[0];
    var hasPreviews = previewInput && previewInput.files && previewInput.files[0];

    if (!hasPdfs && !hasPreviews) {
      alert('Please choose at least one PDF or preview image first.');
      return;
    }

    // Determine upload URL: if editing an existing product use its id
    var productId = productForm ? productForm.dataset.productId : '';
    var uploadUrl = productId
      ? '/admin/products/upload-files/' + productId
      : '/admin/products/upload-files';

    var formData = new FormData();
    if (hasPdfs) {
      Array.from(pdfInput.files).forEach(function (f) {
        formData.append('pdf_files', f);
      });
    }
    if (hasPreviews) {
      Array.from(previewInput.files).forEach(function (f) {
        formData.append('preview_images', f);
      });
    }

    // Disable button while uploading
    upBtn.disabled         = true;
    upBtn.style.background = '#9ca3af';
    upBtn.style.cursor     = 'not-allowed';
    document.getElementById('uploadNowText').textContent = 'Uploading…';
    setProgress(0, 'Starting upload…', '#2563eb');

    var xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', function (e) {
      if (!e.lengthComputable) return;
      var pct    = Math.round((e.loaded / e.total) * 100);
      var loaded = (e.loaded / 1024 / 1024).toFixed(1);
      var total  = (e.total  / 1024 / 1024).toFixed(1);
      setProgress(pct,
        pct < 100
          ? pct + '% — ' + loaded + ' MB of ' + total + ' MB uploaded'
          : '⏳ Saving on server…',
        '#2563eb'
      );
    });

    xhr.addEventListener('load', function () {
      var resp = null;
      try { resp = JSON.parse(xhr.responseText); } catch (e) {}

      if (xhr.status < 400 && resp && resp.success) {
        setProgress(100, '✅ Files saved!', '#16a34a');
        upBtn.style.background = '#16a34a';
        document.getElementById('uploadNowText').textContent = '✅ Done';
        window._filesUploaded = true;

        // If no product id yet (new product), we need to remember files for after save
        // For existing products, show newly added files without page reload
        if (resp.pdfs && resp.pdfs.length > 0) {
          _appendSavedPdfs(resp.pdfs);
        }
        if (resp.previews && resp.previews.length > 0) {
          _appendSavedPreviews(resp.previews);
        }

        // Clear the inputs so they don't re-upload on form save
        pdfInput.value = '';
        if (previewInput) previewInput.value = '';

      } else {
        var msg = (resp && resp.message) ? resp.message : 'Upload error (HTTP ' + xhr.status + ')';
        setProgress(document.getElementById('uploadBar').style.width.replace('%','') || 0,
          '❌ ' + msg, '#dc2626');
        upBtn.disabled         = false;
        upBtn.style.background = '#dc2626';
        upBtn.style.cursor     = 'pointer';
        document.getElementById('uploadNowText').textContent = '↩ Retry';
      }
    });

    xhr.addEventListener('error', function () {
      setProgress(0, '❌ Network error — please retry.', '#dc2626');
      upBtn.disabled         = false;
      upBtn.style.background = '#dc2626';
      upBtn.style.cursor     = 'pointer';
      document.getElementById('uploadNowText').textContent = '↩ Retry';
    });

    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.timeout = 600000;
    xhr.send(formData);
  });

  // ── Append newly uploaded PDFs to the existing files list ─────────────────
  function _appendSavedPdfs(pdfs) {
    var list = document.getElementById('existingFilesList');
    if (!list) {
      // Create the container if first upload on new-product form
      var wrapper = document.createElement('div');
      wrapper.className = 'mb-4';
      wrapper.innerHTML = '<p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Uploaded Files</p><div class="space-y-2" id="existingFilesList"></div>';
      var pdfSection = document.getElementById('uploadNowBtn').parentNode;
      pdfSection.parentNode.insertBefore(wrapper, pdfSection);
      list = document.getElementById('existingFilesList');
    }
    pdfs.forEach(function (f) {
      var div = document.createElement('div');
      div.className = 'flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100';
      div.id = f.id ? 'pfile-' + f.id : '';
      div.innerHTML =
        '<div class="flex items-center gap-2 min-w-0">' +
          '<i class="fas fa-file-pdf text-red-400 flex-shrink-0"></i>' +
          '<span class="text-sm text-gray-700 font-medium truncate">' + f.file_name + '</span>' +
          '<span class="text-xs text-gray-400 flex-shrink-0">(' + (f.file_size/1024/1024).toFixed(1) + ' MB)</span>' +
        '</div>' +
        (f.id ? '<div class="flex items-center gap-1.5 flex-shrink-0 ml-2">' +
          '<a href="/admin/products/download/' + f.id + '" class="bg-blue-100 text-blue-600 px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-blue-200 transition-colors"><i class="fas fa-download mr-1"></i>Download</a>' +
          '<button type="button" onclick="deleteFile(' + f.id + ',\'pfile-' + f.id + '\')" class="bg-red-100 text-red-500 px-2 py-1 rounded-lg text-xs hover:bg-red-200 transition-colors"><i class="fas fa-trash"></i></button>' +
        '</div>' : '');
      list.appendChild(div);
    });
  }

  // ── Append newly uploaded previews to the preview grid ───────────────────
  function _appendSavedPreviews(previews) {
    var grid = document.getElementById('existingPreviewsList');
    if (!grid) {
      var wrapper = document.createElement('div');
      wrapper.className = 'grid grid-cols-3 gap-2 mb-4';
      wrapper.id = 'existingPreviewsList';
      var previewSection = document.querySelector('.preview-upload-section');
      if (previewSection) previewSection.insertBefore(wrapper, previewSection.firstChild);
      grid = wrapper;
    }
    previews.forEach(function (p) {
      var div = document.createElement('div');
      div.className = 'relative group';
      div.id = p.id ? 'prev-' + p.id : '';
      div.innerHTML =
        '<img src="' + p.image_path + '" class="w-full h-24 object-cover rounded-xl border border-gray-200">' +
        (p.id ? '<button type="button" onclick="deletePreview(' + p.id + ',\'prev-' + p.id + '\')" ' +
          'style="position:absolute;top:4px;right:4px;width:22px;height:22px;background:#ef4444;color:white;border:none;border-radius:50%;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
          '<i class="fas fa-times"></i></button>' : '');
      grid.appendChild(div);
    });
  }

  // ── Save Guide (text fields only, no file re-upload) ─────────────────────
  window.saveGuide = function () {
    var hasPdf     = pdfInput.files && pdfInput.files[0];
    var hasPreview = previewInput && previewInput.files && previewInput.files[0];
    if ((hasPdf || hasPreview) && !window._filesUploaded) {
      if (!confirm(
        'You have files selected but not uploaded yet.\n\n' +
        'Click OK to save the guide WITHOUT these files.\n' +
        'Click Cancel to go back and click "Upload Files Now" first.'
      )) return;
    }
    productForm.submit();
  };

})();
