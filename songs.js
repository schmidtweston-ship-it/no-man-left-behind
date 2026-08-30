(function () {
  "use strict";

  var STORE = "nmlb-v1";
  var SONGS_REQ = "nmlb-v1-songs-requested";
  var OPEN = "nmlb-v1-open";
  var DEFAULTS = { doorCode: "7391", westonNumber: "", dadName: "Dad" };

  var pin = "";
  var pendingSong = null;

  function $(id) {
    return document.getElementById(id);
  }

  function load() {
    var data = Object.assign({}, DEFAULTS);
    try {
      var raw = localStorage.getItem(STORE);
      if (raw) Object.assign(data, JSON.parse(raw));
    } catch (e) {}
    if (!data.doorCode) data.doorCode = "7391";
    if (!data.dadName) data.dadName = "Dad";
    if (!data.westonNumber) data.westonNumber = "";
    return data;
  }

  function save(partial) {
    var data = Object.assign(load(), partial);
    localStorage.setItem(STORE, JSON.stringify(data));
    return data;
  }

  function loadRequested() {
    try {
      var raw = localStorage.getItem(SONGS_REQ);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveRequested(item) {
    var list = loadRequested();
    list.unshift(item);
    if (list.length > 50) list = list.slice(0, 50);
    localStorage.setItem(SONGS_REQ, JSON.stringify(list));
  }

  function show(id) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) {
      screens[i].hidden = screens[i].id !== id;
    }
    window.scrollTo(0, 0);
  }

  function isIOS() {
    var ua = navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function digitsOnly(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function normalizePhone(raw) {
    var trimmed = String(raw || "").trim();
    if (!trimmed) return "";
    var d = digitsOnly(trimmed);
    if (d.length === 10) return "+1" + d;
    if (d.length === 11 && d.charAt(0) === "1") return "+" + d;
    if (trimmed.charAt(0) === "+" && d.length >= 10 && d.length <= 15) return "+" + d;
    if (d.length >= 10 && d.length <= 15) return "+" + d;
    return "";
  }

  function smsUrl(number, body) {
    if (!body) return "sms:" + number;
    var enc = encodeURIComponent(body);
    return isIOS() ? "sms:" + number + "&body=" + enc : "sms:" + number + "?body=" + enc;
  }

  function openSms(number, body) {
    window.location.href = smsUrl(number, body);
  }

  function requestBody(song, artist) {
    var s = "Song request: " + song;
    if (artist) s += " — " + artist;
    return s;
  }

  function goHome() {
    var data = load();
    $("hello").textContent = "Hi " + data.dadName + ".";
    show("screen-home");
  }

  function renderDots() {
    var n = pin.length;
    var s = "";
    for (var i = 0; i < Math.max(4, n); i++) s += i < n ? "•" : "○";
    $("pin-dots").textContent = s;
  }

  function checkPin() {
    var code = load().doorCode;
    if (!pin) return;
    if (pin.length < code.length) return;
    if (pin === code) {
      sessionStorage.setItem(OPEN, "1");
      pin = "";
      $("door-err").hidden = true;
      goHome();
      return;
    }
    $("door-err").hidden = false;
    $("screen-door").classList.remove("shake");
    void $("screen-door").offsetWidth;
    $("screen-door").classList.add("shake");
    pin = "";
    renderDots();
  }

  function renderRequested() {
    var list = loadRequested();
    var ul = $("request-list");
    ul.innerHTML = "";
    if (!list.length) {
      var empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "Nothing yet.";
      ul.appendChild(empty);
      return;
    }
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var li = document.createElement("li");
      var line = item.song || item.text || "";
      if (item.artist) line += " — " + item.artist;
      li.textContent = line;
      if (item.at) {
        var w = document.createElement("span");
        w.className = "when";
        w.textContent = new Date(item.at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        });
        li.appendChild(w);
      }
      ul.appendChild(li);
    }
  }

  function sendRequest(song, artist) {
    saveRequested({ song: song, artist: artist, at: Date.now() });
    renderRequested();
    $("song-name").value = "";
    $("song-artist").value = "";
    var data = load();
    if (!data.westonNumber) {
      pendingSong = { song: song, artist: artist };
      $("weston-number").value = "";
      $("number-err").hidden = true;
      show("screen-number");
      return;
    }
    openSms(data.westonNumber, requestBody(song, artist));
  }

  function handleSend() {
    var song = ($("song-name").value || "").trim();
    var artist = ($("song-artist").value || "").trim();
    if (!song) {
      $("request-err").hidden = false;
      return;
    }
    $("request-err").hidden = true;
    sendRequest(song, artist);
  }

  function renderMade(rows) {
    var ul = $("made-list");
    var empty = $("made-empty");
    ul.innerHTML = "";
    if (!rows || !rows.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i] || {};
      var title = row.title || row.song || "Song";
      var artist = row.artist || "";
      var src = row.src || row.file || row.mp3 || "";
      var li = document.createElement("li");
      li.className = "song-row";
      var h = document.createElement("h3");
      h.textContent = title;
      li.appendChild(h);
      if (artist) {
        var a = document.createElement("p");
        a.className = "artist";
        a.textContent = artist;
        li.appendChild(a);
      }
      if (src) {
        var audio = document.createElement("audio");
        audio.setAttribute("controls", "");
        audio.setAttribute("preload", "metadata");
        audio.setAttribute("playsinline", "");
        audio.setAttribute("controlslist", "nodownload");
        audio.src = src;
        audio.setAttribute("aria-label", "Play " + title);
        li.appendChild(audio);
      }
      ul.appendChild(li);
    }
  }

  function loadMade() {
    $("made-empty").hidden = true;
    $("made-list").innerHTML = "";
    fetch("songs.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("songs");
        return r.json();
      })
      .then(function (data) {
        renderMade(Array.isArray(data) ? data : []);
      })
      .catch(function () {
        renderMade([]);
      });
  }

  function bind() {
    document.querySelectorAll("[data-digit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $("door-err").hidden = true;
        if (pin.length >= 8) return;
        pin += btn.getAttribute("data-digit");
        renderDots();
        var code = load().doorCode;
        if (pin.length === code.length) checkPin();
      });
    });
    $("pin-del").addEventListener("click", function () {
      pin = pin.slice(0, -1);
      $("door-err").hidden = true;
      renderDots();
    });
    $("pin-go").addEventListener("click", checkPin);

    $("btn-request").addEventListener("click", function () {
      $("song-name").value = "";
      $("song-artist").value = "";
      $("request-err").hidden = true;
      renderRequested();
      show("screen-request");
    });
    $("btn-made").addEventListener("click", function () {
      show("screen-made");
      loadMade();
    });
    $("btn-setup").addEventListener("click", function () {
      var data = load();
      $("setup-code").value = data.doorCode;
      $("setup-number").value = data.westonNumber;
      $("setup-name").value = data.dadName;
      $("setup-msg").hidden = true;
      show("screen-setup");
    });

    $("request-back").addEventListener("click", goHome);
    $("made-back").addEventListener("click", goHome);
    $("number-back").addEventListener("click", goHome);
    $("setup-back").addEventListener("click", goHome);

    $("request-send").addEventListener("click", handleSend);

    $("number-save").addEventListener("click", function () {
      var n = normalizePhone($("weston-number").value);
      if (!n) {
        $("number-err").hidden = false;
        return;
      }
      save({ westonNumber: n });
      $("number-err").hidden = true;
      if (pendingSong) {
        var p = pendingSong;
        pendingSong = null;
        openSms(n, requestBody(p.song, p.artist));
        show("screen-request");
        return;
      }
      goHome();
    });

    $("setup-save").addEventListener("click", function () {
      var code = digitsOnly($("setup-code").value);
      var numberRaw = $("setup-number").value.trim();
      var number = numberRaw ? normalizePhone(numberRaw) : "";
      var name = ($("setup-name").value || "").trim() || "Dad";
      if (!code || code.length < 4) {
        $("setup-msg").hidden = false;
        $("setup-msg").textContent = "Door code needs at least 4 digits.";
        return;
      }
      if (numberRaw && !number) {
        $("setup-msg").hidden = false;
        $("setup-msg").textContent = "Need a real phone number, or leave it blank.";
        return;
      }
      save({ doorCode: code, westonNumber: number, dadName: name });
      $("setup-msg").hidden = false;
      $("setup-msg").textContent = "Saved on this phone.";
    });
  }

  function start() {
    bind();
    renderDots();
    if (sessionStorage.getItem(OPEN) === "1") goHome();
    else show("screen-door");
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }

  start();
})();
