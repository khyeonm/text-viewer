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
    html += '<span class="stat"><b>' + allLines.length.toLocaleString() + '</b> lines</span>';
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
      html += '<td class="line-num">' + (i + 1) + '</td>';
      html += '<td class="line-content">' + lineHtml + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';

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
  }

  window.AutoPipePlugin = {
    render: function(container, fileUrl, filename) {
      rootEl = container;
      rootEl.innerHTML = '<div class="ap-loading">Loading...</div>';
      allLines = []; wordWrap = true; searchText = '';

      var ext = getExt(filename);
      rootEl.setAttribute('data-ext', ext);

      fetch(fileUrl)
        .then(function(resp) {
          rootEl.setAttribute('data-size', resp.headers.get('content-length') || '0');
          return resp.text();
        })
        .then(function(data) {
          rootEl.setAttribute('data-size', String(data.length));
          allLines = data.split('\n');
          // Limit to 10000 lines for performance
          if (allLines.length > 10000) allLines = allLines.slice(0, 10000);
          render();
        })
        .catch(function(err) {
          rootEl.innerHTML = '<p style="color:red;padding:16px;">Error loading file: ' + err.message + '</p>';
        });
    },
    destroy: function() { allLines = []; rootEl = null; }
  };
})();
