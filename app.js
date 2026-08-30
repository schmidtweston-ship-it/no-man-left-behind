(function () {
  "use strict";

  var STORE = "nmlb-v1";
  var REQUESTS = "nmlb-v1-requests";
  var GEO = "nmlb-v1-geo";
  var OPEN = "nmlb-v1-open";
  var DEFAULTS = { doorCode: "7391", westonNumber: "", dadName: "Dad" };

  var pin = "";
  var pendingTalk = false;
  var pendingNeed = "";
  var pendingAsk = "";
  var rec = null;
  var listening = false;

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

  function loadRequests() {
    try {
      var raw = localStorage.getItem(REQUESTS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveRequest(text) {
    var list = loadRequests();
    list.unshift({ text: text, at: Date.now() });
    if (list.length > 50) list = list.slice(0, 50);
    localStorage.setItem(REQUESTS, JSON.stringify(list));
  }

  function loadGeo() {
    try {
      var raw = localStorage.getItem(GEO);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveGeo(obj) {
    localStorage.setItem(GEO, JSON.stringify(obj));
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

  function needNumberThen(kind, extra) {
    var data = load();
    if (data.westonNumber) return true;
    pendingTalk = kind === "talk";
    pendingNeed = kind === "need" ? extra || "" : "";
    pendingAsk = kind === "ask" ? extra || "" : "";
    $("weston-number").value = "";
    $("number-err").hidden = true;
    show("screen-number");
    return false;
  }

  function afterNumberSaved() {
    if (pendingTalk) {
      pendingTalk = false;
      openSms(load().westonNumber, "Hey");
      show("screen-home");
      return;
    }
    if (pendingNeed) {
      var t = pendingNeed;
      pendingNeed = "";
      finishNeed(t);
      return;
    }
    if (pendingAsk) {
      var q = pendingAsk;
      pendingAsk = "";
      show("screen-ask");
      sendQuestionSms(q);
      return;
    }
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

  function goHome() {
    var data = load();
    $("hello").textContent = "Hi " + data.dadName + ".";
    show("screen-home");
  }

  function talkToWeston() {
    if (!needNumberThen("talk")) return;
    openSms(load().westonNumber, "Hey");
  }

  function isTimeQ(q) {
    return /\b(what'?s?\s+the\s+time|what\s+time|current\s+time|time\s+is\s+it|tell\s+me\s+the\s+time)\b/i.test(q);
  }

  function isDateQ(q) {
    return /\b(what'?s?\s+the\s+date|what\s+day|today'?s\s+date|what'?s\s+today|current\s+date|what\s+date)\b/i.test(q);
  }

  function isWeatherQ(q) {
    return /\b(weather|temperature|forecast|raining|rain|snow|how hot|how cold|degrees|humid)\b/i.test(q);
  }

  function formatTime() {
    return new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function formatDate() {
    return new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }

  function setAnswer(text) {
    var el = $("ask-answer");
    el.hidden = false;
    el.textContent = text;
  }

  var WMO = {
    0: "clear",
    1: "mostly clear",
    2: "partly cloudy",
    3: "overcast",
    45: "foggy",
    48: "foggy",
    51: "light drizzle",
    53: "drizzle",
    55: "drizzle",
    61: "light rain",
    63: "rain",
    65: "heavy rain",
    71: "light snow",
    73: "snow",
    75: "heavy snow",
    80: "showers",
    81: "showers",
    82: "heavy showers",
    95: "thunderstorms",
    96: "thunderstorms",
    99: "thunderstorms"
  };

  function weatherLine(data, place) {
    var t = Math.round(data.current.temperature_2m);
    var w = WMO[data.current.weather_code] || "outside";
    var unit = data.current_units && data.current_units.temperature_2m ? data.current_units.temperature_2m : "°";
    var deg = String(unit).indexOf("F") >= 0 ? "°" : unit;
    var where = place ? " in " + place : "";
    return t + deg + " and " + w + where + ".";
  }

  function fetchWeather(lat, lon, place) {
    var url =
      "https://api.open-meteo.com/v1/forecast?latitude=" +
      encodeURIComponent(lat) +
      "&longitude=" +
      encodeURIComponent(lon) +
      "&current=temperature_2m,weather_code&temperature_unit=fahrenheit";
    setAnswer("Checking weather…");
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("weather");
        return r.json();
      })
      .then(function (data) {
        setAnswer(weatherLine(data, place));
      })
      .catch(function () {
        setAnswer("Weather isn’t loading. Try again.");
      });
  }

  function weatherFromCity(city) {
    var name = String(city || "").trim();
    if (!name) {
      setAnswer("Type a city.");
      return;
    }
    setAnswer("Checking weather…");
    var g =
      "https://geocoding-api.open-meteo.com/v1/search?name=" +
      encodeURIComponent(name) +
      "&count=1&language=en&format=json";
    fetch(g)
      .then(function (r) {
        if (!r.ok) throw new Error("geo");
        return r.json();
      })
      .then(function (data) {
        if (!data.results || !data.results.length) {
          setAnswer("I can’t find that city.");
          return;
        }
        var hit = data.results[0];
        var place = hit.name + (hit.admin1 ? ", " + hit.admin1 : "");
        saveGeo({ lat: hit.latitude, lon: hit.longitude, place: place, source: "city" });
        return fetchWeather(hit.latitude, hit.longitude, place);
      })
      .catch(function () {
        setAnswer("Weather isn’t loading. Try again.");
      });
  }

  function askWeather() {
    var cached = loadGeo();
    if (cached && cached.lat != null && cached.lon != null) {
      $("ask-city-wrap").hidden = true;
      fetchWeather(cached.lat, cached.lon, cached.place || "");
      return;
    }
    if (cached && cached.denied) {
      $("ask-city-wrap").hidden = false;
      setAnswer("Type a city for the weather.");
      return;
    }
    if (!navigator.geolocation) {
      saveGeo({ denied: true });
      $("ask-city-wrap").hidden = false;
      setAnswer("Type a city for the weather.");
      return;
    }
    setAnswer("Need your location for weather.");
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        saveGeo({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          place: "",
          source: "geo"
        });
        $("ask-city-wrap").hidden = true;
        fetchWeather(pos.coords.latitude, pos.coords.longitude, "");
      },
      function () {
        saveGeo({ denied: true });
        $("ask-city-wrap").hidden = false;
        setAnswer("Type a city for the weather.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }

  function sendQuestionSms(q) {
    setAnswer("I’ll send that to Weston.");
    if (!needNumberThen("ask", q)) return;
    openSms(load().westonNumber, q);
  }

  function handleAsk() {
    var q = ($("ask-text").value || "").trim();
    $("ask-city-wrap").hidden = true;
    if (!q) {
      setAnswer("Type a question first.");
      return;
    }
    var time = isTimeQ(q);
    var date = isDateQ(q);
    if (time && date) {
      setAnswer(formatTime() + "\n" + formatDate());
      return;
    }
    if (time) {
      setAnswer(formatTime());
      return;
    }
    if (date) {
      setAnswer(formatDate());
      return;
    }
    if (isWeatherQ(q)) {
      askWeather();
      return;
    }
    sendQuestionSms(q);
  }

  function finishNeed(text) {
    saveRequest(text);
    renderNeeds();
    $("need-text").value = "";
    if (!needNumberThen("need", text)) return;
    openSms(load().westonNumber, "Request: " + text);
  }

  function handleNeed() {
    var t = ($("need-text").value || "").trim();
    if (!t) return;
    finishNeed(t);
  }

  function renderNeeds() {
    var list = loadRequests();
    var ul = $("need-list");
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
      var when = new Date(item.at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
      li.textContent = item.text;
      var w = document.createElement("span");
      w.className = "when";
      w.textContent = when;
      li.appendChild(w);
      ul.appendChild(li);
    }
  }

  function setupMic() {
    var Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    var btn = $("ask-mic");
    if (!Ctor) {
      btn.hidden = true;
      return;
    }
    btn.hidden = false;
    rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      var said = ev.results && ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript;
      if (said) {
        var box = $("ask-text");
        box.value = box.value ? box.value + " " + said : said;
      }
    };
    rec.onend = function () {
      listening = false;
      btn.classList.remove("on");
    };
    rec.onerror = function () {
      listening = false;
      btn.classList.remove("on");
    };
    btn.addEventListener("click", function () {
      if (!rec) return;
      try {
        if (listening) {
          rec.stop();
          listening = false;
          btn.classList.remove("on");
          return;
        }
        rec.start();
        listening = true;
        btn.classList.add("on");
      } catch (e) {}
    });
  }

  function bind() {
    document.querySelectorAll("[data-digit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $("door-err").hidden = true;
        if (pin.length >= 12) return;
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

    $("btn-talk").addEventListener("click", talkToWeston);
    $("btn-ask").addEventListener("click", function () {
      $("ask-text").value = "";
      $("ask-answer").hidden = true;
      $("ask-city-wrap").hidden = true;
      show("screen-ask");
    });
    $("btn-need").addEventListener("click", function () {
      renderNeeds();
      show("screen-need");
    });
    $("btn-setup").addEventListener("click", function () {
      var data = load();
      $("setup-code").value = data.doorCode;
      $("setup-number").value = data.westonNumber;
      $("setup-name").value = data.dadName;
      $("setup-msg").hidden = true;
      show("screen-setup");
    });

    $("number-back").addEventListener("click", goHome);
    $("ask-back").addEventListener("click", goHome);
    $("need-back").addEventListener("click", goHome);
    $("setup-back").addEventListener("click", goHome);

    $("number-save").addEventListener("click", function () {
      var n = normalizePhone($("weston-number").value);
      if (!n) {
        $("number-err").hidden = false;
        return;
      }
      save({ westonNumber: n });
      $("number-err").hidden = true;
      afterNumberSaved();
    });

    $("ask-send").addEventListener("click", handleAsk);
    $("ask-city-go").addEventListener("click", function () {
      weatherFromCity($("ask-city").value);
    });
    $("need-send").addEventListener("click", handleNeed);

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
    setupMic();
    renderDots();
    if (sessionStorage.getItem(OPEN) === "1") goHome();
    else show("screen-door");
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }

  start();
})();
