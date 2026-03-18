// Product form upload logic
var pdfUploaded = false;

function initProductForm() {
  var pdfInput = document.getElementById('pdf_file');
  if (!pdfInput) return;

  var formAction = document.getElementById('productForm').action;

  // ── Step 1: file chosen → show "Upload PDF Now" button ──────────────────
  pdfInput.addEventListener('change', function() {
    if (!this.files || !this.files[0]) return;
    var f    = this.files[0];
    var size = (f.size / 1024 / 1024).toFixed(1);

    document.getElementById('pdfLabelText').innerHTML =
      '<i class="fas fa-file-pdf text-red-500 mr-1"></i>' + f.name + ' (' + size + ' MB)';
    document.getElementById('pdfLabel').style.borderColor = '#2563eb';
    document.getElementById('pdfLabel').style.background  = '#eff6ff';

    document.getElementById('uploadFileName').textContent = f.name;
    document.getElementById('uploadPercent').textContent  = '0%';
    document.getElementById('uploadBar').style.width      = '0%';
    document.getElementById('uploadBar').className        = 'bg-blue-600 h-4 rounded-full transition-all duration-300';
    document.getElementById('uploadStatus').textContent   = 'Ready — click "Upload PDF Now"';
    document.getElementById('uploadProgressWrap').classList.remove('hidden');

    var upBtn = document.getElementById('uploadNowBtn');
    upBtn.classList.remove('hidden');
    upBtn.disabled  = false;
    upBtn.className = 'w-full mt-3 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md cursor-pointer';
    document.getElementById('uploadNowText').textContent = 'Upload PDF Now';

    pdfUploaded = false;
  });

  // ── Step 2: Upload Now ───────────────────────────────────────────────────
  window.startUpload = function() {
    var pdfFile = document.getElementById('pdf_file').files[0];
    if (!pdfFile) { alert('Please choose a PDF file first.'); return; }

    var form     = document.getElementById('productForm');
    var upBtn    = document.getElementById('uploadNowBtn');
    var xhr      = new XMLHttpRequest();
    var formData = new FormData(form);

    upBtn.disabled  = true;
    upBtn.className = 'w-full mt-3 bg-gray-400 text-white py-3 rounded-xl font-bold cursor-not-allowed';
    document.getElementById('uploadNowText').textContent = 'Uploading…';
    document.getElementById('uploadStatus').textContent  = 'Starting upload…';

    xhr.upload.addEventListener('progress', function(e) {
      if (!e.lengthComputable) return;
      var pct    = Math.round((e.loaded / e.total) * 100);
      var loaded = (e.loaded / 1024 / 1024).toFixed(1);
      var total  = (e.total  / 1024 / 1024).toFixed(1);
      document.getElementById('uploadBar').style.width     = pct + '%';
      document.getElementById('uploadPercent').textContent = pct + '%';
      document.getElementById('uploadStatus').textContent  =
        pct < 100 ? pct + '%  —  ' + loaded + ' MB of ' + total + ' MB' : '⏳ Saving on server…';
    });

    xhr.addEventListener('load', function() {
      var resp = null;
      try { resp = JSON.parse(xhr.responseText); } catch(e) {}

      if (xhr.status < 400 && resp && resp.success) {
        document.getElementById('uploadBar').style.width     = '100%';
        document.getElementById('uploadPercent').textContent = '100%';
        document.getElementById('uploadBar').className       = 'bg-green-500 h-4 rounded-full transition-all';
        document.getElementById('uploadStatus').textContent  = '✅ Uploaded & saved! Redirecting…';
        upBtn.className = 'w-full mt-3 bg-green-600 text-white py-3 rounded-xl font-bold cursor-default';
        document.getElementById('uploadNowText').textContent = '✅ Done';
        pdfUploaded = true;
        setTimeout(function() { window.location.href = resp.redirect || '/admin/products'; }, 1500);
      } else {
        var msg = (resp && resp.message) ? resp.message : 'Server error (HTTP ' + xhr.status + ')';
        document.getElementById('uploadStatus').textContent = '❌ ' + msg;
        document.getElementById('uploadBar').className      = 'bg-red-500 h-4 rounded-full';
        upBtn.disabled  = false;
        upBtn.className = 'w-full mt-3 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 cursor-pointer';
        document.getElementById('uploadNowText').textContent = 'Retry Upload';
      }
    });

    xhr.addEventListener('error', function() {
      document.getElementById('uploadStatus').textContent = '❌ Network error — retry.';
      document.getElementById('uploadBar').className      = 'bg-red-500 h-4 rounded-full';
      upBtn.disabled  = false;
      upBtn.className = 'w-full mt-3 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 cursor-pointer';
      document.getElementById('uploadNowText').textContent = 'Retry Upload';
    });

    xhr.open('POST', formAction);
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.timeout = 600000;
    xhr.send(formData);
  };

  // ── Save Guide button ────────────────────────────────────────────────────
  window.saveGuide = function() {
    var hasPdf = document.getElementById('pdf_file').files && document.getElementById('pdf_file').files[0];
    if (hasPdf && !pdfUploaded) {
      if (!confirm('PDF selected but not uploaded yet.\n\nCancel = go back and click "Upload PDF Now"\nOK = save without PDF')) return;
    }
    document.getElementById('productForm').submit();
  };
}

document.addEventListener('DOMContentLoaded', initProductForm);
