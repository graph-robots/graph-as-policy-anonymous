/* GaP site — reveals, video management, interactive graph with node inspector */
(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ── scroll reveals ──────────────────────────────────────────────────── */
const revIO = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add("in"); revIO.unobserve(e.target); }
}), { threshold: 0.12 });
$$(".reveal").forEach(el => revIO.observe(el));

/* ── video autoplay management (all videos loop while visible) ───────── */
const vidIO = new IntersectionObserver(es => es.forEach(e => {
  const v = e.target;
  if (e.isIntersecting) v.play().catch(() => {});
  else v.pause();
}), { threshold: 0.3 });
$$("video[data-autoplay]").forEach(v => vidIO.observe(v));
$$(".bcard .bmedia video").forEach(v => vidIO.observe(v));   // benchmark cards loop when visible

/* ── crate view tabs ─────────────────────────────────────────────────── */
const crateVid = $("#crate-video");
$$(".btab").forEach(b => b.addEventListener("click", () => {
  $$(".btab").forEach(x => x.classList.remove("active"));
  b.classList.add("active");
  crateVid.poster = b.dataset.p;
  crateVid.src = b.dataset.v;
  crateVid.play().catch(() => {});
}));

/* ── results tabs ────────────────────────────────────────────────────── */
$$(".rtab").forEach(b => b.addEventListener("click", () => {
  $$(".rtab").forEach(x => x.classList.remove("active"));
  b.classList.add("active");
  $$(".rpanel").forEach(p => p.hidden = p.id !== b.dataset.t);
}));

/* ── bibtex copy ─────────────────────────────────────────────────────── */
$("#bib-copy")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#bib-text").textContent);
    $("#bib-copy").textContent = "✓ copied";
    setTimeout(() => $("#bib-copy").textContent = "⧉ copy", 1600);
  } catch {}
});

/* ── prompt typing loop ──────────────────────────────────────────────── */
const PROMPT = "Pack all the grocery items into the basket.";
const typed = $("#ptyped");
if (typed && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let i = 0, dir = 1;
  const step = () => {
    typed.textContent = PROMPT.slice(0, i);
    if (dir > 0 && i >= PROMPT.length) { dir = 0; setTimeout(() => { dir = 1; i = 0; step(); }, 6000); return; }
    i += dir;
    setTimeout(step, 42 + Math.random() * 40);
  };
  step();
} else if (typed) typed.textContent = PROMPT;

/* ── graph explorer with node inspector ──────────────────────────────── */
const PAL = {
  tool:        ["#cfe3f7", "#2c6fb0"],
  script:      ["#d6efd6", "#3f8f47"],
  subgraph:    ["#e8e0f5", "#7a5bb0"],
  router:      ["#fde7c4", "#c8841a"],
  noop:        ["#ececec", "#9a9a9a"],
  end_success: ["#d6efd6", "#2f7d36"],
  end_failure: ["#f7d6d6", "#b03434"],
};
const TYPE_NAMES = {
  tool: "tool call (MORSL service)", script: "synthesized script",
  router: "router — dynamic dispatch", noop: "exit marker",
  end_success: "terminal · success", end_failure: "terminal · failure",
  subgraph: "nested subgraph",
};
const EDGE = { ctrl: "#5a5a66", ok: "#2e7d32", fail: "#c0392b" };
const NS = "http://www.w3.org/2000/svg";
const mk = (t, at, parent) => {
  const el = document.createElementNS(NS, t);
  for (const k in at) el.setAttribute(k, at[k]);
  if (parent) parent.appendChild(el);
  return el;
};
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function showDetail(n) {
  const panel = $("#node-detail");
  const [fill, stroke] = PAL[n.type] || PAL.tool;
  let h = `<div class="detail-head">
    <span class="nchip" style="background:${fill};border-color:${stroke};color:#1c1c22">${esc(n.label)}</span>
    <span class="tchip">${TYPE_NAMES[n.type] || n.type}</span>`;
  if (n.lane) h += `<span class="tchip">subgraph: ${esc(n.lane)}</span>`;
  h += `<button class="btn btn-mini detail-close" id="detail-close">✕ close</button></div>`;

  if (n.tool) h += `<h4>tool</h4><div class="kv"><span class="k">service</span><span class="v">${esc(n.tool)}</span></div>`;
  if (n.script) h += `<h4>script</h4><div class="kv"><span class="k">file</span><span class="v">${esc(n.script)}</span></div>`;

  if (n.inputs && Object.keys(n.inputs).length) {
    h += `<h4>execution inputs</h4><div class="kv">`;
    for (const [k, v] of Object.entries(n.inputs)) {
      const val = (v && typeof v === "object" && "$ref" in v)
        ? `<span class="ref">$ref → ${esc(v["$ref"])}</span>`
        : esc(JSON.stringify(v));
      h += `<span class="k">${esc(k)}</span><span class="v">${val}</span>`;
    }
    h += `</div>`;
  }
  if (n.router) {
    h += `<h4>routing</h4><div class="kv">`;
    h += `<span class="k">router_field</span><span class="v">${esc(n.router.router_field ?? "")}</span>`;
    for (const [lbl, dst] of Object.entries(n.router.mapping || {}))
      h += `<span class="k">on “${esc(lbl)}”</span><span class="v">→ ${esc(dst)}</span>`;
    h += `</div>`;
  }
  if (n.type.startsWith("end")) {
    h += `<p class="hint">Terminal state: execution stops here and the outcome is reported${n.type === "end_failure" ? " as a failure — every red route in the graph converges on this node." : " as a success."}</p>`;
  }
  if (n.type === "noop") {
    h += `<p class="hint">Marks the subgraph's exit: control returns to the top level, where the macro routes decide the next subgraph.</p>`;
  }
  if (n.code) h += `<h4>code — ${esc(n.script || "")}</h4><pre>${esc(n.code)}</pre>`;

  panel.innerHTML = h;
  panel.classList.add("open");
  $("#detail-close").addEventListener("click", () => {
    panel.classList.remove("open");
    $$(".g-node.sel").forEach(x => x.classList.remove("sel"));
  });
}

async function buildGraph() {
  const holder = $("#graph-svg-holder");
  if (!holder) return;
  const g = await (await fetch("assets/data/packing_graph.json")).json();
  const svg = mk("svg", { viewBox: `0 0 ${g.w} ${g.h}`, role: "img" }, holder);

  const defs = mk("defs", {}, svg);
  for (const [id, col] of [["ah-ctrl", EDGE.ctrl], ["ah-ok", EDGE.ok], ["ah-fail", EDGE.fail]]) {
    const m = mk("marker", { id, viewBox: "0 0 10 10", refX: 8.4, refY: 5,
      markerWidth: 7.5, markerHeight: 7.5, orient: "auto-start-reverse" }, defs);
    mk("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: col }, m);
  }

  const items = [];
  for (const ln of g.lanes) {
    const grp = mk("g", { class: "gv" }, svg);
    mk("rect", { class: "g-lane", x: ln.x, y: ln.y, width: ln.w, height: ln.h, rx: 14 }, grp);
    const t = mk("text", { class: "g-lane-t", x: ln.x + 14, y: ln.y + 24 }, grp);
    t.textContent = ln.title;
    items.push([ln.order, grp]);
  }

  const trim = (x1, y1, x2, y2, hw, hh) => {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const tx = Math.abs(dx) > 0.01 ? (hw + 5) / (Math.abs(dx) / L) : 1e9;
    const ty = Math.abs(dy) > 0.01 ? (hh + 5) / (Math.abs(dy) / L) : 1e9;
    const t = Math.min(tx, ty);
    return [x1 + dx / L * t, y1 + dy / L * t];
  };

  for (const e of g.edges) {
    let el;
    if (e.kind === "ctrl") {
      const [sx, sy] = trim(e.x1, e.y1, e.x2, e.y2, g.nodeW / 2, g.nodeH / 2);
      const [ex, ey] = trim(e.x2, e.y2, e.x1, e.y1, g.nodeW / 2, g.nodeH / 2);
      el = mk("path", { class: "g-edge gv", d: `M ${sx} ${sy} L ${ex} ${ey}`,
        stroke: EDGE.ctrl, "stroke-width": 2.2, "marker-end": "url(#ah-ctrl)" }, svg);
    } else {
      el = mk("path", { class: "g-edge gv",
        d: `M ${e.x1} ${e.y1} Q ${e.cx} ${e.cy} ${e.x2} ${e.y2}`,
        stroke: EDGE[e.kind], "stroke-width": 2.6,
        "marker-end": `url(#ah-${e.kind})` }, svg);
      if (e.label) { el.dataset.label = e.label; el.dataset.kind = e.kind; }
    }
    items.push([e.order, el]);
  }

  const tip = $("#graph-tip");
  for (const n of g.nodes) {
    const [fill, stroke] = PAL[n.type] || PAL.tool;
    const grp = mk("g", { class: "g-node gv", tabindex: 0, role: "button",
      "aria-label": `Inspect node ${n.label}` }, svg);
    mk("rect", { x: n.x - g.nodeW / 2, y: n.y - g.nodeH / 2, width: g.nodeW,
      height: g.nodeH, rx: 9, fill, stroke }, grp);
    const nm = mk("text", { class: "nm", x: n.x, y: n.y + (n.sub ? -3 : 5) }, grp);
    nm.textContent = n.label;
    if (n.sub) {
      const sb = mk("text", { class: "sb", x: n.x, y: n.y + 16 }, grp);
      const short = n.sub.split("/").pop();
      sb.textContent = `(${short.length > 24 ? short.slice(0, 23) + "…" : short})`;
    }
    grp.addEventListener("mousemove", ev => {
      tip.hidden = false;
      tip.innerHTML = `<b>${esc(n.label)}</b><br>${TYPE_NAMES[n.type] || n.type}<br><span style="opacity:.7">click to inspect ↓</span>`;
      tip.style.left = Math.min(ev.clientX + 16, innerWidth - 330) + "px";
      tip.style.top = (ev.clientY + 18) + "px";
    });
    grp.addEventListener("mouseleave", () => tip.hidden = true);
    const open = () => {
      $$(".g-node.sel", svg).forEach(x => x.classList.remove("sel"));
      grp.classList.add("sel");
      showDetail(n);
    };
    grp.addEventListener("click", open);
    grp.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); open(); } });
    items.push([n.order, grp]);
  }

  $$("path[data-label]", svg).forEach(p => {
    p.addEventListener("mousemove", ev => {
      tip.hidden = false;
      const col = p.dataset.kind === "fail" ? "#e08a7c" : "#9fd4a2";
      tip.innerHTML = `<b style="color:${col}">${esc(p.dataset.label)}</b><br>${p.dataset.kind === "fail" ? "failure route" : "success route"}`;
      tip.style.left = Math.min(ev.clientX + 16, innerWidth - 330) + "px";
      tip.style.top = (ev.clientY + 18) + "px";
    });
    p.addEventListener("mouseleave", () => tip.hidden = true);
  });

  items.sort((a, b) => a[0] - b[0]);
  let played = false;
  const play = () => {
    items.forEach(([, el]) => el.classList.remove("on"));
    items.forEach(([, el], i) => setTimeout(() => el.classList.add("on"), 120 + i * 55));
  };
  const gio = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting && !played) { played = true; play(); gio.disconnect(); }
  }), { threshold: 0.25 });
  gio.observe($("#graph-artifact"));
  $("#graph-replay")?.addEventListener("click", play);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    items.forEach(([, el]) => el.classList.add("on"));
    played = true;
  }
}
buildGraph().catch(console.error);
})();
