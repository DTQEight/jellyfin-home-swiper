/* Jellyfin 12.x (React UI) Home Swiper — adapted v12e */
(function () {
  'use strict';
  var ID = 'jf-swiper';
  var DBG = 'jf-swiper-debug';
  var state = { items: [], idx: 0, timer: null, paused: false, booted: false, hostInfo: '' };

  function dbg(msg) {
    try {
      var d = document.getElementById(DBG);
      if (!d) { d = document.createElement('div'); d.id = DBG; d.style.display = 'none'; document.body.appendChild(d); }
      d.textContent = msg + ' | ' + state.hostInfo + ' @' + new Date().toLocaleTimeString();
    } catch (e) {}
  }

  function api() {
    var a = window.ApiClient;
    return a && a.getCurrentUserId && a.getCurrentUserId() ? a : null;
  }

  function token() {
    var a = api(), t = '';
    if (a) {
      try { if (typeof a.accessToken === 'function') t = a.accessToken() || ''; } catch (e) {}
      if (!t) { try { t = a._accessToken || ''; } catch (e) {} }
    }
    if (!t) {
      try {
        var raw = localStorage.getItem('jellyfin_credentials') || sessionStorage.getItem('jellyfin_credentials');
        if (raw) {
          var c = JSON.parse(raw);
          var s = (c.Servers || [])[0] || {};
          t = s.AccessToken || s.accessToken || '';
        }
      } catch (e) {}
    }
    return t;
  }

  function base() {
    var a = api(), b = '';
    try { b = (a.serverAddress && a.serverAddress()) || a._serverAddress || ''; } catch (e) {}
    return b || location.origin;
  }

  function imgUrl(id, type, tag, q) {
    var u = base() + '/Items/' + id + '/Images/' + type;
    if (tag) u += '?tag=' + encodeURIComponent(tag);
    return u + (u.indexOf('?') > -1 ? '&' : '?') + q;
  }

  function injectCss() {
    if (document.getElementById(ID + '-css')) return;
    var s = document.createElement('style');
    s.id = ID + '-css';
    s.textContent = [
      '#' + ID + '{position:relative;width:calc(100% - 24px);max-width:1600px;margin:8px auto 20px;height:clamp(240px,38vh,440px);overflow:hidden;border-radius:14px;background:#111;box-shadow:0 8px 30px rgba(0,0,0,.45);}',
      '#' + ID + ' .jfs-slide{position:absolute;inset:0;opacity:0;transition:opacity .8s ease;background-size:cover;background-position:center 20%;}',
      '#' + ID + ' .jfs-slide.on{opacity:1;}',
      '#' + ID + ' .jfs-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.88) 0%,rgba(0,0,0,.55) 45%,rgba(0,0,0,.1) 100%),linear-gradient(0deg,rgba(0,0,0,.85) 0%,transparent 45%);}',
      '#' + ID + ' .jfs-body{position:absolute;left:4%;bottom:12%;max-width:52%;z-index:3;color:#fff;}',
      '#' + ID + ' .jfs-logo{max-width:320px;max-height:110px;object-fit:contain;margin-bottom:10px;filter:drop-shadow(0 3px 8px rgba(0,0,0,.7));}',
      '#' + ID + ' .jfs-title{font-size:clamp(20px,2.4vw,38px);font-weight:800;line-height:1.15;margin:0 0 8px;text-shadow:0 2px 10px rgba(0,0,0,.8);}',
      '#' + ID + ' .jfs-meta{font-size:13px;opacity:.85;margin-bottom:10px;}',
      '#' + ID + ' .jfs-overview{font-size:13px;line-height:1.5;opacity:.8;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:14px;}',
      '#' + ID + ' .jfs-btns{display:flex;gap:10px;}',
      '#' + ID + ' .jfs-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 20px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;border:0;}',
      '#' + ID + ' .jfs-play{background:#fff;color:#111;}',
      '#' + ID + ' .jfs-info{background:rgba(255,255,255,.18);color:#fff;backdrop-filter:blur(4px);}',
      '#' + ID + ' .jfs-nav{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;border:0;cursor:pointer;background:rgba(0,0,0,.45);color:#fff;font-size:20px;z-index:4;opacity:0;transition:opacity .3s;}',
      '#' + ID + ':hover .jfs-nav{opacity:1;}',
      '#' + ID + ' .jfs-prev{left:14px;}',
      '#' + ID + ' .jfs-next{right:14px;}',
      '#' + ID + ' .jfs-dots{position:absolute;right:4%;bottom:14%;z-index:4;display:flex;gap:8px;}',
      '#' + ID + ' .jfs-dot{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.35);cursor:pointer;transition:all .3s;}',
      '#' + ID + ' .jfs-dot.on{background:#fff;width:22px;border-radius:5px;}',
      '@media(max-width:720px){#' + ID + '{height:clamp(200px,32vh,320px);border-radius:0;margin:0 0 10px;}#' + ID + ' .jfs-body{max-width:88%;left:5%;bottom:8%;}#' + ID + ' .jfs-overview{display:none;}#' + ID + ' .jfs-dots{right:5%;bottom:8%;}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function describe(el) {
    if (!el) return 'none';
    var c = (el.className && typeof el.className === 'string') ? el.className.split(' ')[0] : '';
    return el.tagName.toLowerCase() + (c ? '.' + c.slice(0, 24) : '') + '(' + el.clientHeight + '/' + el.scrollHeight + ')';
  }

  // 12.4 React 前端仍保留 .homeSectionsContainer / main
  function findHost() {
    var sec = document.querySelector('.homeSectionsContainer');
    if (sec && sec.parentNode) {
      state.hostInfo = 'host=sections';
      return { mode: 'before', el: sec };
    }
    var main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (main) { state.hostInfo = 'host=main'; return { mode: 'prepend', el: main }; }
    var root = document.getElementById('reactRoot');
    if (root) { state.hostInfo = 'host=reactRoot'; return { mode: 'prepend', el: root }; }
    state.hostInfo = 'host=none';
    return null;
  }

  function isHome() {
    var h = (location.hash || '').replace(/^#/, '');
    return h === '' || h === '/' || h.indexOf('/home') === 0;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function build() {
    var box = document.createElement('div');
    box.id = ID;
    var html = '';
    state.items.forEach(function (it, i) {
      var bd = (it.BackdropImageTags && it.BackdropImageTags[0]) || '';
      var hasLogo = it.ImageTags && it.ImageTags.Logo;
      var logo = hasLogo ? imgUrl(it.Id, 'Logo', it.ImageTags.Logo, 'maxHeight=140') : '';
      var meta = [];
      if (it.ProductionYear) meta.push(it.ProductionYear);
      if (it.OfficialRating) meta.push(it.OfficialRating);
      if (it.CommunityRating) meta.push('★ ' + Number(it.CommunityRating).toFixed(1));
      if (it.RunTimeTicks) meta.push(Math.round(it.RunTimeTicks / 600000000) + ' 分钟');
      html += '<div class="jfs-slide' + (i === 0 ? ' on' : '') + '" style="background-image:url(\'' + imgUrl(it.Id, 'Backdrop', bd, 'maxWidth=1920') + '\')">'
        + '<div class="jfs-shade"></div>'
        + '<div class="jfs-body">'
        + (logo ? '<img class="jfs-logo" src="' + logo + '" alt="">' : '<h2 class="jfs-title">' + esc(it.Name) + '</h2>')
        + (logo ? '<div class="jfs-meta">' + meta.map(esc).join(' · ') + '</div>' : '')
        + (it.Overview ? '<div class="jfs-overview">' + esc(it.Overview) + '</div>' : '')
        + '<div class="jfs-btns">'
        + '<a class="jfs-btn jfs-play" href="#/details?id=' + it.Id + '">▶ 播放</a>'
        + '<a class="jfs-btn jfs-info" href="#/details?id=' + it.Id + '">详情</a>'
        + '</div></div></div>';
    });
    html += '<button class="jfs-nav jfs-prev" aria-label="上一张">‹</button>'
      + '<button class="jfs-nav jfs-next" aria-label="下一张">›</button>'
      + '<div class="jfs-dots">' + state.items.map(function (_, i) {
        return '<div class="jfs-dot' + (i === 0 ? ' on' : '') + '" data-i="' + i + '"></div>';
      }).join('') + '</div>';
    box.innerHTML = html;
    box.addEventListener('mouseenter', function () { state.paused = true; });
    box.addEventListener('mouseleave', function () { state.paused = false; });
    var prev = box.querySelector('.jfs-prev'), next = box.querySelector('.jfs-next');
    if (prev) prev.addEventListener('click', function (e) { e.stopPropagation(); go(state.idx - 1); });
    if (next) next.addEventListener('click', function (e) { e.stopPropagation(); go(state.idx + 1); });
    Array.prototype.forEach.call(box.querySelectorAll('.jfs-dot'), function (d) {
      d.addEventListener('click', function () { go(parseInt(d.getAttribute('data-i'), 10)); });
    });
    return box;
  }

  function place() {
    if (!state.items.length) return;
    injectCss();
    var h = findHost();
    if (!h) { dbg('no host items=' + state.items.length); return; }
    var el = document.getElementById(ID) || build();
    if (h.mode === 'before') {
      if (!(el.parentNode === h.el.parentNode && el.nextSibling === h.el)) {
        h.el.parentNode.insertBefore(el, h.el);
      }
    } else if (el.parentNode !== h.el) {
      h.el.insertBefore(el, h.el.firstChild);
    }
    el.style.display = isHome() ? '' : 'none';
    dbg('placed items=' + state.items.length + ' slides=' + el.querySelectorAll('.jfs-slide').length + ' parent=' + describe(el.parentNode));
  }

  function go(n) {
    var box = document.getElementById(ID);
    if (!box) return;
    var slides = box.querySelectorAll('.jfs-slide');
    var dots = box.querySelectorAll('.jfs-dot');
    if (!slides.length) return;
    state.idx = (n + slides.length) % slides.length;
    for (var i = 0; i < slides.length; i++) {
      slides[i].classList.toggle('on', i === state.idx);
      if (dots[i]) dots[i].classList.toggle('on', i === state.idx);
    }
  }

  function startTimer() {
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(function () {
      if (!state.paused && isHome() && state.items.length > 1) go(state.idx + 1);
    }, 8000);
  }

  function accept(res) {
    var list = (res && res.Items) || [];
    state.items = list.filter(function (i) { return i.BackdropImageTags && i.BackdropImageTags.length; });
    dbg('fetched total=' + list.length + ' withBackdrop=' + state.items.length);
    if (state.items.length) { place(); startTimer(); }
  }

  function rest(uid) {
    var tk = token();
    var url = base() + '/Items?Recursive=true&IncludeItemTypes=Movie,Series&SortBy=DateCreated&SortOrder=Descending'
      + '&Limit=10&ImageTypeLimit=1&EnableImageTypes=Backdrop,Logo'
      + '&Fields=Overview,ProductionYear,CommunityRating,OfficialRating,RunTimeTicks'
      + '&userId=' + encodeURIComponent(uid) + (tk ? '&api_key=' + encodeURIComponent(tk) : '');
    var headers = {};
    if (tk) { headers['X-Emby-Token'] = tk; headers['Authorization'] = 'MediaBrowser Token="' + tk + '"'; }
    dbg('REST token=' + tk.length);
    fetch(url, { credentials: 'same-origin', headers: headers }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(accept).catch(function (e) { dbg('REST error: ' + (e && e.message)); });
  }

  function load() {
    var a = api();
    if (!a) { dbg('no ApiClient'); return; }
    var uid = a.getCurrentUserId();
    var opts = {
      Recursive: true, IncludeItemTypes: 'Movie,Series', SortBy: 'DateCreated', SortOrder: 'Descending',
      Limit: 10, ImageTypeLimit: 1, EnableImageTypes: 'Backdrop,Logo',
      Fields: 'Overview,ProductionYear,CommunityRating,OfficialRating,RunTimeTicks'
    };
    dbg('calling getItems');
    var p = null;
    try { p = a.getItems(uid, opts); } catch (e) { dbg('getItems threw ' + e.message); }
    if (p && p.then) {
      p.then(accept).catch(function (e) { dbg('getItems err ' + (e && e.message)); rest(uid); });
      return;
    }
    rest(uid);
  }

  function watch() {
    setInterval(function () {
      if (!isHome()) {
        var b = document.getElementById(ID);
        if (b) b.style.display = 'none';
        return;
      }
      place();
    }, 1500);
    window.addEventListener('hashchange', function () {
      var b = document.getElementById(ID);
      if (!b) { if (isHome()) place(); return; }
      b.style.display = isHome() ? '' : 'none';
      if (isHome()) place();
    });
  }

  function boot() {
    if (state.booted) return;
    if (!api()) { dbg('waiting ApiClient'); setTimeout(boot, 700); return; }
    state.booted = true;
    dbg('boot');
    load();
    watch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
