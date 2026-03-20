// AutoPipe Plugin: text-viewer
// Syntax-highlighted text viewer with line numbers

(function() {
  var rootEl = null;
  var allLines = [];
  var wordWrap = true;
  var searchText = '';
  var searchMatches = 0;

  var EXT_LANG = {
    py: 'python', r: 'r', R: 'r', sh: 'bash', json: 'json',
    yaml: 'yaml', yml: 'yaml', xml: 'xml', md: 'markdown',
    toml: 'ini', ini: 'ini', cfg: 'ini', nf: 'groovy', smk: 'python',
    txt: 'plaintext', log: 'plaintext'
  };

  function getExt(filename) {
    var parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlightSearch(line, term) {
    if (!term) return escapeHtml(line);
    var escaped = escapeHtml(line);
    var termEsc = escapeHtml(term);
    var lower = escaped.toLowerCase();
    var termLower = termEsc.toLowerCase();
    var result = '';
    var idx = 0;
    var count = 0;
    while (true) {
      var found = lower.indexOf(termLower, idx);
      if (found < 0) { result += escaped.substring(idx); break; }
      result += escaped.substring(idx, found);
      result += '<span class="search-match">' + escaped.substring(found, found + termEsc.length) + '</span>';
      count++;
      idx = found + termEsc.length;
    }
    searchMatches += count;
    return result;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function render() {
    if (!rootEl) return;
    searchMatches = 0;
    var ext = rootEl.getAttribute('data-ext') || '';
    var lang = EXT_LANG[ext] || 'plaintext';
    var fileSize = rootEl.getAttribute('data-size') || '0';

    var html = '<div class="text-plugin">';

    // Summary
    html += '<div class="text-summary">';
    html += '<span class="stat"><b>' + _totalLines.toLocaleString() + '</b> lines</span>';
    html += '<span class="stat"><b>' + formatSize(parseInt(fileSize, 10)) + '</b></span>';
    html += '<span class="stat">Language: <b>' + lang + '</b></span>';
    html += '</div>';

    // Controls
    html += '<div class="text-controls">';
    html += '<input type="text" id="textSearch" placeholder="Search in file..." value="' + searchText.replace(/"/g, '&quot;') + '">';
    html += '<span class="match-count" id="textMatchCount"></span>';
    html += '<button id="textWrapBtn" class="' + (wordWrap ? 'active' : '') + '">Word Wrap</button>';
    html += '</div>';

    // Code
    html += '<div class="text-code-wrap ' + (wordWrap ? 'text-wrap-on' : 'text-wrap-off') + '">';
    html += '<table class="text-code-table"><tbody>';
    for (var i = 0; i < allLines.length; i++) {
      var lineHtml = highlightSearch(allLines[i], searchText);
      var hasMatch = searchText && allLines[i].toLowerCase().indexOf(searchText.toLowerCase()) >= 0;
      html += '<tr' + (hasMatch ? ' class="highlight-line"' : '') + '>';
      html += '<td class="line-num">' + (currentPage * PAGE_SIZE + i + 1) + '</td>';
      html += '<td class="line-content">' + lineHtml + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';

    // Pagination
    var totalPages = Math.max(1, Math.ceil(_totalLines / PAGE_SIZE));
    if (totalPages > 1) {
      html += '<div class="text-pagination" style="display:flex;align-items:center;gap:4px;padding:8px 0;">';
      html += '<button data-page="prev"' + (currentPage <= 0 ? ' disabled' : '') + '>&laquo; Prev</button>';
      var startP = Math.max(0, currentPage - 3);
      var endP = Math.min(totalPages, startP + 7);
      if (startP > 0) html += '<button data-page="0">1</button><span>...</span>';
      for (var p = startP; p < endP; p++) {
        html += '<button data-page="' + p + '"' + (p === currentPage ? ' class="current"' : '') + '>' + (p + 1) + '</button>';
      }
      if (endP < totalPages) html += '<span>...</span><button data-page="' + (totalPages - 1) + '">' + totalPages + '</button>';
      html += '<button data-page="next"' + (currentPage >= totalPages - 1 ? ' disabled' : '') + '>Next &raquo;</button>';
      html += '<span style="font-size:12px;color:#888">Lines ' + (currentPage * PAGE_SIZE + 1) + '-' + Math.min((currentPage + 1) * PAGE_SIZE, _totalLines) + ' of ' + _totalLines.toLocaleString() + '</span>';
      html += '</div>';
    }

    html += '</div>';
    rootEl.innerHTML = html;

    // Update match count
    var mc = rootEl.querySelector('#textMatchCount');
    if (mc && searchText) mc.textContent = searchMatches + ' matches';

    // Events
    var si = rootEl.querySelector('#textSearch');
    if (si) si.addEventListener('input', function() { searchText = this.value; render(); });
    var wb = rootEl.querySelector('#textWrapBtn');
    if (wb) wb.addEventListener('click', function() { wordWrap = !wordWrap; render(); });
    var pbs = rootEl.querySelectorAll('.text-pagination button');
    for (var pi = 0; pi < pbs.length; pi++) {
      pbs[pi].addEventListener('click', function() {
        var pg = this.getAttribute('data-page');
        var tp = Math.ceil(_totalLines / PAGE_SIZE);
        if (pg === 'prev') { if (currentPage > 0) _loadPage(currentPage - 1); }
        else if (pg === 'next') { if (currentPage < tp - 1) _loadPage(currentPage + 1); }
        else { _loadPage(parseInt(pg, 10)); }
      });
    }
  }

  var _totalLines = 0;
  var _currentFilename = '';
  var PAGE_SIZE = 500;

  function _fetchPage(filename, page) {
    return fetch('/data/' + encodeURIComponent(filename) + '?page=' + page + '&page_size=' + PAGE_SIZE)
      .then(function(resp) { return resp.json(); });
  }

  var currentPage = 0;

  function _loadPage(page) {
    if (!rootEl) return;
    rootEl.innerHTML = '<div class="ap-loading">Loading...</div>';

    _fetchPage(_currentFilename, page).then(function(data) {
      if (data.error) {
        rootEl.innerHTML = '<p style="color:red;padding:16px;">Error: ' + data.error + '</p>';
        return;
      }
      _totalLines = data.total || _totalLines;
      currentPage = page;
      allLines = [];
      if (data.rows) {
        for (var i = 0; i < data.rows.length; i++) {
          var row = data.rows[i];
          allLines.push(Array.isArray(row) ? row.join('\t') : row);
        }
      }
      render();
    }).catch(function(err) {
      rootEl.innerHTML = '<p style="color:red;padding:16px;">Error: ' + err.message + '</p>';
    });
  }

  window.AutoPipePlugin = {
    render: function(container, fileUrl, filename) {
      rootEl = container;
      rootEl.innerHTML = '<div class="ap-loading">Loading...</div>';
      allLines = []; wordWrap = true; searchText = '';
      currentPage = 0;

      var ext = getExt(filename);
      rootEl.setAttribute('data-ext', ext);
      _currentFilename = filename;
      _loadPage(0);
    },
    destroy: function() { allLines = []; rootEl = null; }
  };
})();
