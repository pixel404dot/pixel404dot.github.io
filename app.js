(() => {
  const SETUP_KEY = "kana-line-setup";
  const STATS_KEY = "kana-line-stats";
  const SESS_KEY = "kana-line-sessions";
  const THEME_KEY = "kana-line-theme";
  const PRESETS = [0, 3, 5, 8, 10, 15];

  const defaultSetup = () => ({
    script: "mixed",
    rows: [...KANA.FIRST5],
    mode: "mixed",
    length: 20,
    timer: 0,
    customOpen: false,
    customDraft: "12",
  });

  let setup = loadSetup();
  let view = "setup";
  let route = location.hash.replace("#", "") || "/";
  let questions = [];
  let answers = [];
  let qIndex = 0;
  let verdict = null;
  let typed = "";
  let leftMs = 0;
  let timerId = null;
  let tickStarted = 0;

  function loadSetup() {
    try {
      const raw = JSON.parse(localStorage.getItem(SETUP_KEY) || "null");
      if (!raw) return defaultSetup();
      return {
        ...defaultSetup(),
        ...raw,
        rows: Array.isArray(raw.rows) ? raw.rows : [...KANA.FIRST5],
        timer: Number(raw.timer) > 0 ? Math.min(120, Math.round(raw.timer)) : 0,
      };
    } catch {
      return defaultSetup();
    }
  }
  function saveSetup() {
    localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
  }
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function speak(text) {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = 0.85;
    const ja = speechSynthesis.getVoices().find((v) => v.lang.startsWith("ja"));
    if (ja) u.voice = ja;
    speechSynthesis.speak(u);
  }
  function same(a, b) {
    return a.length === b.length && a.every((x) => b.includes(x));
  }
  function esc(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

function buildQuiz() {
    const pool = KANA.pool(setup.script, setup.rows);
    if (!pool.length) return [];
    const target = setup.length === "all" ? pool.length : setup.length;
    const picked = [];
    const base = shuffle(pool);
    while (picked.length < target) picked.push(...shuffle(base));
    return picked.slice(0, target).map((glyph, i) => {
      const kind =
        setup.mode === "mixed"
          ? Math.random() < 0.5
            ? "read"
            : "write"
          : setup.mode;
      const q = { id: `${glyph.script}-${glyph.kana}-${i}`, glyph, kind };
      if (kind === "write") {
        const sameScript = pool.filter(
          (g) => g.script === glyph.script && g.kana !== glyph.kana,
        );
        const others = sameScript.length >= 3 ? sameScript : pool.filter((g) => g.kana !== glyph.kana);
        const distract = shuffle(others).slice(0, 3).map((g) => g.kana);
        q.choices = shuffle([glyph.kana, ...distract]).slice(0, 4);
      }
      return q;
    });
  }

  function summary() {
    const script =
      setup.script === "mixed" ? "Mixed" : setup.script === "hiragana" ? "Hiragana" : "Katakana";
    const mode =
      setup.mode === "mixed"
        ? "mixed test"
        : setup.mode === "read"
          ? "type the reading"
          : "choose the character";
    const t = setup.timer > 0 ? ` · ${setup.timer}s each` : "";
    return `${script} · ${setup.rows.length} line${setup.rows.length === 1 ? "" : "s"} · ${mode}${t}`;
  }

  function startTimer() {
    stopTimer();
    if (!(setup.timer > 0) || verdict) return;
    tickStarted = Date.now();
    leftMs = setup.timer * 1000;
    timerId = setInterval(() => {
      leftMs = Math.max(0, setup.timer * 1000 - (Date.now() - tickStarted));
      paintTimer();
      if (leftMs <= 0) {
        stopTimer();
        if (!verdict) grade("", true);
      }
    }, 50);
  }
  function stopTimer() {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }
  function paintTimer() {
    const bar = document.getElementById("timer-bar");
    const sec = document.getElementById("timer-sec");
    const wrap = document.getElementById("timer-wrap");
    if (!bar || !sec) return;
    const ratio = setup.timer > 0 ? leftMs / (setup.timer * 1000) : 1;
    bar.style.width = `${Math.max(ratio * 100, 0)}%`;
    sec.textContent = verdict ? "0" : String(Math.ceil(leftMs / 1000));
    wrap.classList.toggle("urgent", !verdict && ratio <= 0.25);
  }

  function persist(ans) {
    const score = ans.filter((a) => a.correct).length;
    try {
      const sessions = JSON.parse(localStorage.getItem(SESS_KEY) || "[]");
      sessions.unshift({
        script: setup.script,
        lines: setup.rows.join(","),
        mode: setup.mode,
        score,
        total: ans.length,
        created_at: new Date().toISOString(),
      });
      localStorage.setItem(SESS_KEY, JSON.stringify(sessions.slice(0, 20)));
      const stats = JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
      for (const a of ans) {
        const key = `${a.question.glyph.script}:${a.question.glyph.kana}`;
        const prev = stats[key] || {
          kana: a.question.glyph.kana,
          script: a.question.glyph.script,
          correct: 0,
          attempts: 0,
        };
        prev.attempts += 1;
        if (a.correct) prev.correct += 1;
        stats[key] = prev;
      }
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch {}
  }

  function startDrill(qs) {
    if (!qs.length) return;
    questions = qs;
    answers = [];
    qIndex = 0;
    verdict = null;
    typed = "";
    view = "quiz";
    route = "/";
    render();
    startTimer();
  }

  function grade(given, timedOut = false) {
    if (verdict) return;
    const q = questions[qIndex];
    const correct = timedOut
      ? false
      : q.kind === "read"
        ? KANA.matchRomaji(q.glyph, given)
        : given === q.glyph.kana;
    verdict = { question: q, given, correct, timedOut };
    stopTimer();
    if (correct) speak(q.glyph.kana);
    renderQuizBody();
    if (correct) setTimeout(() => advance(), 750);
  }

  function advance() {
    if (!verdict) return;
    answers = [...answers, verdict];
    if (qIndex + 1 >= questions.length) {
      persist(answers);
      view = "results";
      verdict = null;
      render();
      return;
    }
    qIndex += 1;
    verdict = null;
    typed = "";
    render();
    startTimer();
  }

  function setRoute(next) {
    route = next || "/";
    if (route === "/chart") view = "chart";
    else if (route === "/progress") view = "progress";
    else if (view === "quiz" || view === "results") {
      /* stay */
    } else view = "setup";
    if (route === "/" && view !== "quiz" && view !== "results") view = "setup";
    location.hash = `#${route === "/" ? "/" : route}`;
    render();
  }

  window.addEventListener("hashchange", () => {
    const next = location.hash.replace("#", "") || "/";
    if (next !== route) {
      if (next === "/chart" || next === "/progress") {
        stopTimer();
        view = next.slice(1);
        route = next;
        render();
      } else if (next === "/" || next === "") {
        stopTimer();
        view = "setup";
        route = "/";
        render();
      }
    }
  });

  document.getElementById("theme-btn").addEventListener("click", () => {
    const dark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#14110e" : "#f3ead8");
    document.getElementById("theme-btn").textContent = dark ? "☀" : "☾";
  });

  function navActive() {
    document.querySelectorAll("[data-nav]").forEach((el) => {
      const n = el.getAttribute("data-nav");
      el.classList.toggle(
        "active",
        (n === "drill" && (route === "/" || route === "")) ||
          route === `/${n}`,
      );
    });
    document.getElementById("theme-btn").textContent =
      document.documentElement.classList.contains("dark") ? "☀" : "☾";
  }

  function render() {
    navActive();
    const root = document.getElementById("app");
    if (view === "setup") root.innerHTML = setupHTML();
    else if (view === "quiz") root.innerHTML = quizHTML();
    else if (view === "results") root.innerHTML = resultsHTML();
    else if (view === "chart") root.innerHTML = chartHTML();
    else if (view === "progress") root.innerHTML = progressHTML();
    bind();
    if (view === "quiz") paintTimer();
  }

  function setupHTML() {
    const custom =
      setup.customOpen || (setup.timer > 0 && !PRESETS.includes(setup.timer));
    const groups = [
      { id: "basic", label: "Basic lines", note: "Gojūon — あいうえお" },
      { id: "dakuten", label: "Voiced marks", note: "Dakuten & handakuten" },
      { id: "yoon", label: "Combinations", note: "Contracted sounds" },
    ];
    return `
      <section class="hero">
        <p class="kicker">Gojūon drill</p>
        <h1>Practice by the line.</h1>
        <p class="muted">Pick hiragana, katakana, or a proper mixed test. Start from the first five lines — あかさたな — or choose any row you want.</p>
      </section>
      <section class="section">
        <h2>Script</h2>
        <div class="grid-3">
          ${[
            ["hiragana", "ひらがな", "Hiragana", "The rounded script"],
            ["katakana", "カタカナ", "Katakana", "The angular script"],
            ["mixed", "混ぜる", "Mixed", "Both in one drill"],
          ]
            .map(
              ([id, ja, en, blurb]) => `
            <button class="card ${setup.script === id ? "active" : ""}" data-act="script" data-v="${id}">
              <div class="ja">${ja}</div><div class="en">${en}</div><p class="muted">${blurb}</p>
            </button>`,
            )
            .join("")}
        </div>
      </section>
      <section class="section">
        <div class="row-head">
          <div>
            <h2>Lines</h2>
            <p class="muted">${setup.rows.length} selected · ${setup.script === "mixed" ? "hiragana + katakana of the selected lines" : setup.script}</p>
          </div>
          <div class="chips">
            <button class="chip ${same(setup.rows, KANA.FIRST5) ? "accent" : ""}" data-act="preset" data-v="first5">First 5 · あかさたな</button>
            <button class="chip ${same(setup.rows, KANA.BASIC) ? "accent" : ""}" data-act="preset" data-v="basic">All basic</button>
            <button class="chip ${setup.rows.length === 0 ? "accent" : ""}" data-act="preset" data-v="clear">Clear</button>
          </div>
        </div>
        ${groups
          .map((g) => {
            const rows = KANA.ROWS.filter((r) => r.group === g.id);
            const ids = rows.map((r) => r.id);
            const allOn = ids.every((id) => setup.rows.includes(id));
            return `
            <div class="row-head" style="margin-top:1.25rem">
              <div><p><strong>${g.label}</strong></p><p class="muted" style="font-size:.8rem">${g.note}</p></div>
              <button class="linkish" data-act="group" data-v="${g.id}">${allOn ? "Deselect" : "Select all"}</button>
            </div>
            <div class="rows">
              ${rows
                .map((r) => {
                  const on = setup.rows.includes(r.id);
                  return `<button class="row-btn ${on ? "active" : ""}" data-act="row" data-v="${r.id}">
                    ${on ? '<span class="check">✓</span>' : ""}
                    <div class="lbl">${r.label}</div>
                    <div class="kana">${setup.script === "katakana" ? r.kata : r.hira}</div>
                    ${setup.script === "mixed" ? `<div class="muted" style="font-family:var(--serif);font-size:.85rem">${r.kata}</div>` : ""}
                  </button>`;
                })
                .join("")}
            </div>`;
          })
          .join("")}
      </section>
      <section class="section">
        <h2>Test style</h2>
        <div class="grid-3">
          ${[
            ["read", "Type the reading", "See kana, write romaji"],
            ["write", "Choose the character", "See romaji, tap the kana"],
            ["mixed", "Mixed test", "Both directions, shuffled"],
          ]
            .map(
              ([id, t, b]) => `
            <button class="card ${setup.mode === id ? "active" : ""}" data-act="mode" data-v="${id}">
              <div class="en">${t}</div><p class="muted">${b}</p>
            </button>`,
            )
            .join("")}
        </div>
      </section>
      <section class="section split">
        <div>
          <h2>Length</h2>
          <div class="chips">
            ${[10, 20, 40, "all"]
              .map(
                (n) =>
                  `<button class="pill ${setup.length === n ? "active" : ""}" data-act="length" data-v="${n}">${n === "all" ? "All unique" : n}</button>`,
              )
              .join("")}
          </div>
        </div>
        <div>
          <h2>Timer</h2>
          <p class="muted">Seconds for each question</p>
          <div class="chips" style="margin-top:.5rem">
            ${PRESETS.map(
              (s) =>
                `<button class="pill ${!custom && setup.timer === s ? "active" : ""}" data-act="timer" data-v="${s}">${s === 0 ? "Off" : s + "s"}</button>`,
            ).join("")}
            <button class="pill ${custom ? "active" : ""}" data-act="timer-custom">Custom</button>
          </div>
          ${
            custom
              ? `<div class="custom-row"><input id="custom-sec" type="number" min="1" max="120" value="${esc(setup.customDraft || setup.timer || 12)}" /><span class="muted">seconds (1–120)</span></div>`
              : ""
          }
        </div>
      </section>
      <div class="actions">
        <button class="btn ghost" data-act="reset">Reset first 5 mixed</button>
        <button class="btn xl" data-act="start" ${setup.rows.length ? "" : "disabled"}>Start drill</button>
      </div>
    `;
  }

  function quizHTML() {
    const q = questions[qIndex];
    if (!q) return `<p>No questions.</p><button class="btn" data-act="home">Back</button>`;
    return `
      <div class="quiz">
        <div class="quiz-top">
          <button class="linkish" data-act="exit">Exit</button>
          <span class="muted">${esc(summary())}</span>
          <span>${qIndex + 1} / ${questions.length}</span>
        </div>
        <div class="bar"><span style="width:${Math.max((qIndex / questions.length) * 100, 4)}%"></span></div>
        ${
          setup.timer > 0
            ? `<div class="timer" id="timer-wrap"><div class="bar"><span id="timer-bar"></span></div><div class="sec" id="timer-sec">${Math.ceil(leftMs / 1000) || setup.timer}</div></div>`
            : ""
        }
        <div id="quiz-body">${quizBodyHTML()}</div>
      </div>
    `;
  }

  function quizBodyHTML() {
    const q = questions[qIndex];
    const show = q.kind === "read" ? q.glyph.kana : q.glyph.romaji;
    return `
      <div class="prompt ${verdict ? (verdict.correct ? "ok" : "bad") : ""}">
        <p class="kicker">${q.kind === "read" ? "Read this" : "Find this reading"}</p>
        <div class="glyph">${esc(show)}</div>
        <button class="hear" data-act="hear">Hear</button>
        ${
          verdict
            ? `<div class="mt ${verdict.correct ? "ok" : "bad"}">${verdict.correct ? "Correct" : verdict.timedOut ? "Time’s up" : "Not quite"}</div>
               <p style="font-family:var(--serif);font-size:1.25rem;margin:.4rem 0">${esc(q.glyph.kana)} · ${esc(q.glyph.romaji)}</p>
               <p class="muted">${q.glyph.script === "hiragana" ? "Hiragana · ひらがな" : "Katakana · カタカナ"}</p>`
            : ""
        }
      </div>
      ${
        !verdict && q.kind === "read"
          ? `<form id="read-form" class="mt"><input id="romaji" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Type romaji — shi, tsu, fu…" value="${esc(typed)}" /><button class="btn block mt" type="submit">Check</button></form>`
          : ""
      }
      ${
        !verdict && q.kind === "write"
          ? `<div class="choices">${(q.choices || [])
              .map((c) => `<button class="choice" data-act="pick" data-v="${esc(c)}">${esc(c)}</button>`)
              .join("")}</div>`
          : ""
      }
      ${
        verdict
          ? `<button class="btn block mt ${verdict.correct ? "moss" : "ink"}" data-act="next">${qIndex + 1 >= questions.length ? "See results" : "Next"}</button>`
          : ""
      }
    `;
  }

  function renderQuizBody() {
    const el = document.getElementById("quiz-body");
    if (!el) return render();
    el.innerHTML = quizBodyHTML();
    bindQuiz();
    paintTimer();
  }

  function resultsHTML() {
    const score = answers.filter((a) => a.correct).length;
    const total = answers.length;
    const pct = total ? Math.round((score / total) * 100) : 0;
    const missed = answers.filter((a) => !a.correct);
    return `
      <div class="results">
        <div class="prompt">
          <p class="kicker">Drill complete</p>
          <div class="score">${pct}%</div>
          <p class="muted">${score} of ${total} correct</p>
          <p class="muted mt">${esc(summary())}</p>
          <p class="ok mt">Saved on this device.</p>
        </div>
        ${
          missed.length
            ? `<section class="section" style="text-align:left"><h2>Missed</h2>
              <div class="miss"><ul>${missed
                .map(
                  (m) => `<li>
                    <button class="tile" data-act="speak" data-v="${esc(m.question.glyph.kana)}">${esc(m.question.glyph.kana)}</button>
                    <div><strong>${esc(m.question.glyph.romaji)}</strong> <span class="muted">${m.question.glyph.script}</span>
                    <div class="muted">${m.timedOut ? "Ran out of time" : `You answered <span class="bad">${esc(m.given || "—")}</span>`}</div></div>
                  </li>`,
                )
                .join("")}</ul></div></section>`
            : `<p class="ok mt">Clean run. Every character held.</p>`
        }
        <div class="actions" style="justify-content:center">
          <button class="btn ghost" data-act="retry" ${missed.length ? "" : "disabled"}>Retry missed</button>
          <button class="btn ink" data-act="again">New drill</button>
          <button class="btn ghost" data-act="home">Change lines</button>
        </div>
        <section class="section" style="text-align:left"><h2>All answers</h2>
          <div class="grid-ans">${answers
            .map(
              (a) =>
                `<button class="ans ${a.correct ? "ok" : "no"}" data-act="speak" data-v="${esc(a.question.glyph.kana)}">${esc(a.question.glyph.kana)}</button>`,
            )
            .join("")}</div>
        </section>
      </div>
    `;
  }

  function chartHTML() {
    const script = setup.chartScript || "hiragana";
    const groups = [
      { id: "basic", label: "Basic lines", note: "Gojūon — あいうえお" },
      { id: "dakuten", label: "Voiced marks", note: "Dakuten & handakuten" },
      { id: "yoon", label: "Combinations", note: "Contracted sounds" },
    ];
    return `
      <section class="hero">
        <p class="kicker">Reference</p>
        <h1>Gojūon chart</h1>
        <p class="muted">Tap any character to hear it.</p>
        <div class="chips mt">
          <button class="pill ${script === "hiragana" ? "active" : ""}" data-act="chart-script" data-v="hiragana">ひらがな</button>
          <button class="pill ${script === "katakana" ? "active" : ""}" data-act="chart-script" data-v="katakana">カタカナ</button>
        </div>
      </section>
      ${groups
        .map((g) => {
          const rows = KANA.ROWS.filter((r) => r.group === g.id);
          return `<section class="section"><h2>${g.label}</h2><p class="muted">${g.note}</p>
            ${rows
              .map((r) => {
                const chars = g.id === "yoon"
                  ? (script === "katakana" ? r.kata : r.hira).match(/.{1,2}/g) || []
                  : Array.from(script === "katakana" ? r.kata : r.hira);
                const pads = Array.from({ length: Math.max(0, 5 - chars.length) });
                return `<div class="chart-row"><div class="chart-lab">${r.label}</div>
                  <div class="chart-cells">${chars
                    .map(
                      (c, i) =>
                        `<button class="cell" data-act="speak" data-v="${esc(c)}"><b>${esc(c)}</b><span>${esc(r.readings[i] || "")}</span></button>`,
                    )
                    .join("")}${pads.map(() => "<div></div>").join("")}</div></div>`;
              })
              .join("")}
          </section>`;
        })
        .join("")}
    `;
  }

  function progressHTML() {
    let stats = {};
    let sessions = [];
    try {
      stats = JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
      sessions = JSON.parse(localStorage.getItem(SESS_KEY) || "[]");
    } catch {}
    const weak = Object.values(stats)
      .filter((s) => s.attempts > 0)
      .sort((a, b) => a.correct / a.attempts - b.correct / b.attempts)
      .slice(0, 16);
    return `
      <section class="hero">
        <p class="kicker">Progress</p>
        <h1>Your weakest kana</h1>
        <p class="muted">Saved on this device from every drill.</p>
      </section>
      <section class="section">
        <h2>Needs review</h2>
        ${
          weak.length === 0
            ? `<div class="prompt"><p style="font-family:var(--serif);font-size:1.5rem">まだ</p><p class="muted">No stats yet. Run a mixed test on the first five lines.</p><a class="btn mt" href="#/" data-link>Start a drill</a></div>`
            : `<div class="stat-grid">${weak
                .map((s) => {
                  const rate = Math.round((s.correct / s.attempts) * 100);
                  return `<button class="stat" data-act="speak" data-v="${esc(s.kana)}"><span class="tile">${esc(s.kana)}</span><span><strong>${rate}%</strong><div class="muted" style="font-size:.75rem">${s.correct}/${s.attempts} · ${s.script}</div></span></button>`;
                })
                .join("")}</div>`
        }
      </section>
      <section class="section">
        <h2>Recent drills</h2>
        ${
          sessions.length === 0
            ? `<p class="muted">Finish a drill to see it here.</p>`
            : `<div class="miss"><ul>${sessions
                .map((s) => {
                  const rate = Math.round((s.score / s.total) * 100);
                  const when = s.created_at
                    ? new Date(s.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "";
                  return `<li><div><strong style="text-transform:capitalize">${esc(s.script)} · ${esc(s.mode)}</strong><div class="muted">${String(s.lines || "").split(",").filter(Boolean).length} lines · ${esc(when)}</div></div><div style="font-family:var(--serif);font-size:1.6rem">${rate}%</div></li>`;
                })
                .join("")}</ul></div>`
        }
      </section>
    `;
  }

  function bind() {
    document.querySelectorAll("[data-link]").forEach((a) => {
      a.onclick = (e) => {
        e.preventDefault();
        const href = a.getAttribute("href") || "#/";
        setRoute(href.replace("#", "") || "/");
      };
    });
    document.querySelectorAll("[data-act]").forEach((el) => {
      el.onclick = (e) => {
        const act = el.getAttribute("data-act");
        const v = el.getAttribute("data-v");
        handle(act, v, e);
      };
    });
    const custom = document.getElementById("custom-sec");
    if (custom) {
      custom.oninput = () => {
        setup.customDraft = custom.value;
        const n = Number(custom.value);
        if (n > 0) setup.timer = Math.min(120, Math.round(n));
        saveSetup();
      };
    }
    bindQuiz();
  }

  function bindQuiz() {
    const form = document.getElementById("read-form");
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const input = document.getElementById("romaji");
        typed = input ? input.value : "";
        grade(typed);
      };
      const input = document.getElementById("romaji");
      if (input) {
        input.focus();
        input.oninput = () => {
          typed = input.value;
        };
      }
    }
  }

  function handle(act, v) {
    if (act === "script") setup.script = v;
    else if (act === "mode") setup.mode = v;
    else if (act === "length") setup.length = v === "all" ? "all" : Number(v);
    else if (act === "timer") {
      setup.customOpen = false;
      setup.timer = Number(v);
    } else if (act === "timer-custom") {
      setup.customOpen = true;
      const n = Number(setup.customDraft) || 12;
      setup.timer = n;
      setup.customDraft = String(n);
    } else if (act === "row") {
      setup.rows = setup.rows.includes(v)
        ? setup.rows.filter((r) => r !== v)
        : [...setup.rows, v];
    } else if (act === "preset") {
      setup.rows =
        v === "first5" ? [...KANA.FIRST5] : v === "basic" ? [...KANA.BASIC] : [];
    } else if (act === "group") {
      const ids = KANA.ROWS.filter((r) => r.group === v).map((r) => r.id);
      const all = ids.every((id) => setup.rows.includes(id));
      setup.rows = all
        ? setup.rows.filter((id) => !ids.includes(id))
        : [...new Set([...setup.rows, ...ids])];
    } else if (act === "reset") {
      setup = defaultSetup();
    } else if (act === "start") {
      saveSetup();
      startDrill(buildQuiz());
      return;
    } else if (act === "exit" || act === "home") {
      stopTimer();
      view = "setup";
      route = "/";
    } else if (act === "hear") speak(questions[qIndex].glyph.kana);
    else if (act === "pick") grade(v);
    else if (act === "next") {
      advance();
      return;
    } else if (act === "again") {
      startDrill(buildQuiz());
      return;
    } else if (act === "retry") {
      const missed = answers
        .filter((a) => !a.correct)
        .map((a, i) => ({ ...a.question, id: a.question.id + "-r" + i }));
      startDrill(missed);
      return;
    } else if (act === "speak") speak(v);
    else if (act === "chart-script") setup.chartScript = v;
    saveSetup();
    render();
  }

  document.getElementById("theme-btn").textContent =
    document.documentElement.classList.contains("dark") ? "☀" : "☾";
  const initial = location.hash.replace("#", "") || "/";
  if (initial === "/chart") {
    view = "chart";
    route = "/chart";
  } else if (initial === "/progress") {
    view = "progress";
    route = "/progress";
  }
  render();
})();
