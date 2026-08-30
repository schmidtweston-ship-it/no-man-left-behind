(function () {
  "use strict";

  var TEAM = "4826";
  var OPEN = "nmlb-v1-desk-open";
  var pin = "";

  function $(id) {
    return document.getElementById(id);
  }

  function show(id) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) {
      screens[i].hidden = screens[i].id !== id;
    }
    window.scrollTo(0, 0);
  }

  function renderDots() {
    var n = pin.length;
    var s = "";
    for (var i = 0; i < Math.max(4, n); i++) s += i < n ? "•" : "○";
    $("pin-dots").textContent = s;
  }

  function checkPin() {
    if (!pin) return;
    if (pin.length < TEAM.length) return;
    if (pin === TEAM) {
      sessionStorage.setItem(OPEN, "1");
      pin = "";
      $("door-err").hidden = true;
      show("screen-desk");
      loadSongs();
      return;
    }
    $("door-err").hidden = false;
    $("screen-door").classList.remove("shake");
    void $("screen-door").offsetWidth;
    $("screen-door").classList.add("shake");
    pin = "";
    renderDots();
  }

  function loadSongs() {
    var ul = $("desk-list");
    var empty = $("desk-empty");
    ul.innerHTML = "";
    empty.hidden = true;
    fetch("songs.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("songs");
        return r.json();
      })
      .then(function (data) {
        var rows = Array.isArray(data) ? data : [];
        if (!rows.length) {
          empty.hidden = false;
          return;
        }
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i] || {};
          var li = document.createElement("li");
          var title = row.title || row.song || "Song";
          var artist = row.artist || "";
          var src = row.src || row.file || row.mp3 || "";
          li.textContent = artist ? title + " — " + artist : title;
          if (src) {
            var w = document.createElement("span");
            w.className = "when";
            w.textContent = src;
            li.appendChild(w);
          }
          ul.appendChild(li);
        }
      })
      .catch(function () {
        empty.hidden = false;
        empty.textContent = "Could not load songs.json.";
      });
  }

  function bind() {
    document.querySelectorAll("[data-digit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $("door-err").hidden = true;
        if (pin.length >= 8) return;
        pin += btn.getAttribute("data-digit");
        renderDots();
        if (pin.length === TEAM.length) checkPin();
      });
    });
    $("pin-del").addEventListener("click", function () {
      pin = pin.slice(0, -1);
      $("door-err").hidden = true;
      renderDots();
    });
    $("pin-go").addEventListener("click", checkPin);
  }

  function start() {
    bind();
    renderDots();
    if (sessionStorage.getItem(OPEN) === "1") {
      show("screen-desk");
      loadSongs();
    } else {
      show("screen-door");
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }

  start();
})();
