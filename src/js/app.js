/**
 * Site application — gate, router, tiers, RSVP, guestbook, maps, games, Connie.
 * Data and SETTINGS are imported; this module wires the interactive behaviour.
 */
import { SETTINGS } from "../config/settings.js";
import { store, lstore } from "./storage.js";
import { parseCsv, CLOUD, cloudGet, cloudPost } from "./cloud.js";
import { ACCESS, tierHasCatering } from "./tier.js";
import { QUIZ } from "../data/quiz.js";
import { KB, SYN } from "../data/concierge-kb.js";
import { PARTY } from "../data/party.js";
import { HUNT } from "../data/hunt.js";
import { XW_WORDS } from "../data/crossword.js";
import { DIET_OPTS } from "../data/diet-opts.js";
import { RSVP_EVENTS } from "../data/rsvp-events.js";
import {
  buildStoryPins,
  buildStoryLines,
  buildMaps,
} from "../data/maps/map-config.js";

export function boot() {
  /* ---------- tier access (from ./tier.js) ---------- */
  let TIER = null;

  /* ---- RSVP config + state ---- */
  let RSVP_STATE = null;   /* the currently loaded RSVP, if any */

  /* storage: imported from ./storage.js */
  let NAME = "Guest";   /* set at the gate; personalises the whole site */

  /* ---------- router ---------- */
  function show(route){
    if(!route) route = "home";
    /* Unknown hashes (e.g. placeholder links awaiting real URLs) are
       ignored rather than bouncing the user to Home. */
    if(!ACCESS.full.includes(route)) return;
    const allowed = ACCESS[TIER] || ["home"];
    if(!allowed.includes(route)){
      route = "home";
      try{ history.replaceState(null,"","#home"); }catch(e){}
    }
    document.querySelectorAll(".page").forEach(p=>p.classList.remove("visible"));
    const el = document.getElementById("page-"+route);
    if(el){ el.classList.remove("visible"); void el.offsetWidth; el.classList.add("visible"); }
    document.querySelectorAll("nav.links a").forEach(a=>{
      a.classList.toggle("active", a.getAttribute("href") === "#"+route);
    });
    try{ navSet(false); }catch(e){
      document.getElementById("nav-links").classList.remove("open");
      document.getElementById("menu-btn").setAttribute("aria-expanded","false");
    }
    if(document.activeElement && document.activeElement.closest && document.activeElement.closest(".ngroup")) document.activeElement.blur();
    if(MAPS[route]) setTimeout(()=>{ try{ initMapFor(route); }catch(e){} }, 80);
    if(route === "games") setTimeout(()=>{ try{ gamesInit(); }catch(e){} }, 60);
    if(route === "rsvp") setTimeout(()=>{ try{ rsvpInit(); }catch(e){} }, 40);
    window.scrollTo(0,0);
  }
  window.addEventListener("hashchange", ()=>{ if(TIER) show(location.hash.replace("#","")); });
  /* iOS Safari often swallows hash-link taps inside a transformed / overflow
     drawer — route explicitly so Keepsakes → In-Flight Entertainment etc. work. */
  document.querySelectorAll("nav.links a[href^='#']").forEach(a=>{
    a.addEventListener("click", e=>{
      const route = (a.getAttribute("href")||"").replace(/^#/,"");
      if(!route) return;
      e.preventDefault();
      navSet(false);
      if(location.hash.replace(/^#/,"") === route) show(route);
      else location.hash = route;
    });
  });

  /* ---------- mobile drawer + accordion nav ---------- */
  function navSet(open){
    document.getElementById("nav-links").classList.toggle("open", open);
    document.getElementById("nav-veil").classList.toggle("show", open);
    document.getElementById("menu-btn").classList.toggle("is-open", open);
    document.getElementById("menu-btn").setAttribute("aria-expanded", open);
    document.body.classList.toggle("nav-locked", open);
    if(!open) document.querySelectorAll(".ngroup.m-open").forEach(g=>g.classList.remove("m-open"));
  }
  document.getElementById("menu-btn").addEventListener("click", ()=>{
    navSet(!document.getElementById("nav-links").classList.contains("open"));
  });
  document.getElementById("nav-veil").addEventListener("click", ()=>navSet(false));
  const drawerClose = document.getElementById("drawer-close");
  if(drawerClose) drawerClose.addEventListener("click", ()=>navSet(false));
  addEventListener("keydown", e=>{ if(e.key==="Escape") navSet(false); });
  /* in the drawer, tapping a group header opens it (and closes the rest) */
  const mobileNav = ()=>matchMedia("(max-width:1024px)").matches;
  document.querySelectorAll(".ngroup-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if(!mobileNav()) return;
      const g = btn.closest(".ngroup"), was = g.classList.contains("m-open");
      document.querySelectorAll(".ngroup.m-open").forEach(x=>x.classList.remove("m-open"));
      if(!was) g.classList.add("m-open");
    });
  });
  /* desktop dropdowns: a clicked-open menu keeps :focus-within, which
     used to leave it stuck open while hovering the next one. Moving the
     mouse to a different group (or off the menu) now releases it. */
  document.querySelectorAll(".ngroup").forEach(g=>{
    g.addEventListener("mouseenter", ()=>{
      const ae = document.activeElement;
      if(ae && ae.closest && ae.closest(".ngroup") && ae.closest(".ngroup") !== g) ae.blur();
    });
    g.addEventListener("mouseleave", ()=>{
      if(mobileNav()) return;
      const ae = document.activeElement;
      if(ae && ae.closest && ae.closest(".ngroup") === g) ae.blur();
    });
  });

  /* ---------- tier filtering ---------- */
  function applyTier(tier){
    TIER = tier;
    document.querySelectorAll("[data-tier]").forEach(el=>{
      const tiers = el.dataset.tier.split(/\s+/);
      if(!tiers.includes(tier)) el.remove();
    });
    /* prune dropdown groups left empty by tier filtering */
    document.querySelectorAll(".nmenu").forEach(m=>{
      if(!m.querySelector("a")){ const g=m.closest(".ngroup"); if(g) g.remove(); }
    });
  }

  /* ---------- password gate ---------- */
  const gate = document.getElementById("gate");
  function norm(s){ return (s||"").toLowerCase().replace(/\s+/g,""); }
  function matchTier(input){
    const p = SETTINGS.passwords, n = norm(input);
    if(!n) return null;                       /* empty input never unlocks */
    for(const t of ["full","vinko","afterparty"]){
      if(norm(p[t]) && n === norm(p[t])) return t;   /* blank setting = tier disabled */
    }
    return null;
  }
  function unlock(tier, quiet){
    applyTier(tier);
    gate.style.display = "none";
    document.getElementById("site-header").style.display = "";
    document.getElementById("site-main").style.display = "";
    document.getElementById("site-footer").style.display = "";
    document.getElementById("chat-fab").style.display = "flex";
    show(location.hash.replace("#","") || "home");
    personalise();
    if(NAME && NAME !== "Guest") toast((quiet ? "Welcome back, " : "Welcome, ") + NAME + " 🌸");
    if(!quiet) petalsBurst(90);
    /* one-time nudge so nobody misses the concierge */
    if(store.get("km-nudge") !== "seen"){
      setTimeout(()=>{
        if(!document.getElementById("chat-panel").classList.contains("open"))
          document.getElementById("chat-nudge").classList.add("show");
      }, 4000);
    }
  }
  function tryPassword(){
    const tier = matchTier(document.getElementById("pw").value);
    if(tier){
      /* the NAME personalises greetings, the dashboard, games and the concierge */
      NAME = document.getElementById("gname").value.trim() || "Guest";
      lstore.set("km-name", NAME);
      store.set("km-tier", tier);
      unlock(tier);
    } else {
      document.getElementById("pw-err").textContent = "That's not quite it — check your invitation. Capitals and spaces don't matter.";
      document.getElementById("pw").select();
    }
  }
  /* the <form> submit covers button taps AND the phone keyboard's Go/Return key */
  document.getElementById("gate-form").addEventListener("submit", e=>{ e.preventDefault(); tryPassword(); });
  document.getElementById("pw").addEventListener("input", ()=>{ document.getElementById("pw-err").textContent=""; });
  NAME = lstore.get("km-name") || "Guest";
  const savedTier = store.get("km-tier");
  if(savedTier && ACCESS[savedTier]) unlock(savedTier, true);

  /* ---------- countdown ---------- */
  const W = SETTINGS.weddingDate;
  const target = new Date(W.year, W.month-1, W.day, W.hour, W.minute, 0);
  const cd = document.getElementById("countdown");
  const pad = n => String(n).padStart(2,"0");
  function tick(){
    let diff = target - new Date();
    if(diff < 0) diff = 0;
    const d = Math.floor(diff/86400000), h = Math.floor(diff/3600000)%24,
          m = Math.floor(diff/60000)%60, s = Math.floor(diff/1000)%60;
    cd.innerHTML = cell(d,"Days")+cell(pad(h),"Hours")+cell(pad(m),"Minutes")+cell(pad(s),"Seconds");
    const cf = document.getElementById("cd-fact");
    if(cf && d !== tick.lastD){ tick.lastD = d; cf.textContent = "✦ " + daysFact(d); }
  }
  function cell(n,l){ return '<div class="cd-cell"><div class="cd-num">'+n+'</div><div class="cd-lab">'+l+'</div></div>'; }
  tick(); setInterval(tick,1000);
  /* easter egg: click the countdown for the "sleeps" translation */
  cd.addEventListener("click", ()=>{
    const sleeps = Math.max(0, Math.ceil((target - new Date())/86400000));
    toast("That's " + sleeps + " sleeps. 😴 Not that anyone's counting.");
  });

  /* ---------- add-to-calendar (.ics) ---------- */
  document.getElementById("ics-btn").addEventListener("click", ()=>{
    function dt(y,mo,d,h,mi){ return y+pad(mo)+pad(d)+"T"+pad(h)+pad(mi)+"00"; }
    const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//KM Wedding//EN",
      "BEGIN:VEVENT","UID:km-wedding-2027@stalbans",
      "DTSTART;TZID=Europe/London:"+dt(W.year,W.month,W.day,W.hour,W.minute),
      "DTEND;TZID=Europe/London:"+dt(W.year,W.month,W.day,23,30),
      "SUMMARY:Kazimir & Megan — May 2027",
      "LOCATION:St Albans\\, England",
      "DESCRIPTION:Celebrations in St Albans — details at the wedding website.",
      "END:VEVENT","END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics],{type:"text/calendar"}));
    a.download = "Kazimir-and-Megan.ics";
    a.click(); URL.revokeObjectURL(a.href);
  });

  /* ---------- settings wiring ---------- */
  const em = document.getElementById("contact-email");
  em.textContent = SETTINGS.contactEmail; em.href = "mailto:"+SETTINGS.contactEmail;
  document.getElementById("whatsapp-link").href = SETTINGS.whatsappLink;
  const vy = document.getElementById("vyshyvanka-code");
  if(vy) vy.textContent = SETTINGS.vyshyvankaCode;
  if(SETTINGS.spotifyLink){
    const sc = document.getElementById("spotify-card"); if(sc) sc.style.display = "";
    document.getElementById("spotify-link").href = SETTINGS.spotifyLink;
  }

  /* ---------- live clock on the departure board ---------- */
  const bc = document.getElementById("board-clock");
  if(bc){ setInterval(()=>{ const n=new Date(); bc.textContent = pad(n.getHours())+":"+pad(n.getMinutes())+":"+pad(n.getSeconds()); },1000); }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg){
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>t.classList.remove("show"), 3200);
  }

  /* ---------- petals & emoji confetti ---------- */
  const canvas = document.getElementById("petals"), ctx = canvas.getContext("2d");
  canvas.style.pointerEvents = "none";
  canvas.style.visibility = "hidden";
  let petals = [];
  function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; }
  resize(); addEventListener("resize", resize);
  const COLS = ["#93A8D8","#A9BCE4","#C3CFEC","#9AA98B","#F0E4CA"];
  const GOLD = ["#B3945C","#CBB78D","#D9C08B","#F0E4CA"];
  function reduced(){ return matchMedia("(prefers-reduced-motion: reduce)").matches; }

  /* ---------- small polish: reveal-on-scroll + header shadow ----------
     Cards drift up softly the first time they scroll into view. The
     class is only ever ADDED here (never in the HTML), so with
     reduced-motion on, or without JS, everything is simply visible. */
  (function(){
    if(reduced() || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(es=>{
      es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } });
    }, {rootMargin:"0px 0px -8% 0px", threshold:.06});
    document.querySelectorAll(".fun-card,.game-card,.wo-card,.acc,.fest-day,.board,.gb-form")
      .forEach(el=>{ el.classList.add("rev"); io.observe(el); });
  })();
  addEventListener("scroll", ()=>{
    const h = document.getElementById("site-header");
    if(h) h.classList.toggle("scrolled", scrollY > 8);
  }, {passive:true});

  function petalsBurst(n, palette){
    if(reduced()) return;
    const cols = palette || COLS;
    for(let i=0;i<n;i++){
      petals.push({ kind:"petal", x:Math.random()*canvas.width, y:-20-Math.random()*canvas.height*0.5,
        r:4+Math.random()*6, vy:1+Math.random()*2.2, vx:-.6+Math.random()*1.2,
        rot:Math.random()*Math.PI, vr:-.03+Math.random()*.06,
        c:cols[(Math.random()*cols.length)|0] });
    }
    ensureLoop();
  }
  function emojiBurst(chars, n){
    if(reduced()) return;
    for(let i=0;i<n;i++){
      petals.push({ kind:"emoji", ch:chars[(Math.random()*chars.length)|0],
        x:Math.random()*canvas.width, y:-30-Math.random()*canvas.height*0.4,
        r:16+Math.random()*12, vy:1.4+Math.random()*2.4, vx:-.7+Math.random()*1.4,
        rot:Math.random()*Math.PI, vr:-.04+Math.random()*.08 });
    }
    ensureLoop();
  }
  let rafOn = false;
  function ensureLoop(){
    if(!rafOn){
      rafOn = true;
      canvas.style.visibility = "visible";
      requestAnimationFrame(loop);
    }
  }
  function loop(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    petals = petals.filter(p=>p.y < canvas.height+40);
    if(!petals.length){
      rafOn = false;
      canvas.style.visibility = "hidden";
      return;
    }   /* idle: hide canvas so it can never steal taps on phones */
    for(const p of petals){
      p.x += p.vx + Math.sin(p.y/40)*.5; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      if(p.kind==="emoji"){ ctx.font = p.r+"px serif"; ctx.textAlign="center"; ctx.globalAlpha=.95; ctx.fillText(p.ch,0,0); }
      else { ctx.fillStyle = p.c; ctx.globalAlpha = .85;
        ctx.beginPath(); ctx.ellipse(0,0,p.r,p.r*.6,0,0,Math.PI*2); ctx.fill(); }
      ctx.restore();
    }
    requestAnimationFrame(loop);
  }

  /* ---------- easter eggs ---------- */
  /* 1. the wax seal */
  document.getElementById("seal-btn").addEventListener("click", ()=>{
    location.hash = "#home"; petalsBurst(120);
  });
  /* 2. type "budmo" anywhere */
  let typed = "";
  addEventListener("keydown", e=>{
    if(e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    typed = (typed + (e.key||"").toLowerCase()).slice(-5);
    if(typed === "budmo"){ petalsBurst(70, GOLD); emojiBurst(["🥂"],14); toast("Будьмо! 🥂 (The correct reply is: Гей!)"); typed=""; }
  });
  /* 3. Kiko's paw in the footer */
  let pawCount = 0;
  document.getElementById("paw-btn").addEventListener("click", ()=>{
    pawCount++;
    emojiBurst(["🐾"], 10);
    toast(pawCount < 3 ? "Woof. Kiko has inspected this website and approves."
                       : "Kiko says that's enough attention. (It is never enough attention.)");
  });
  /* 4. the button that says not to press it */
  const myst = document.getElementById("mystery-btn");
  if(myst){
    let pressed = 0;
    myst.addEventListener("click", ()=>{
      pressed++;
      if(pressed === 1){
        document.body.classList.add("disco");
        emojiBurst(["🪩","💃","🕺"], 18);
        toast("You had ONE job. 🪩 Welcome to the (very brief) disco.");
        setTimeout(()=>document.body.classList.remove("disco"), 3800);
        myst.textContent = "You pressed the button";
      } else {
        emojiBurst(["🪩"], 8);
        toast("The button forgives you. The button always knew.");
      }
    });
  }

  /* ---------- quiz ✏️ EDIT the questions here ---------- */
  
  const quizEl = document.getElementById("quiz");
  let qi = 0, score = 0;
  function renderQuiz(){
    if(!quizEl) return;
    if(qi >= QUIZ.length){
      if(score===QUIZ.length){ petalsBurst(60,GOLD); emojiBurst(["🏆"],6); }
      quizEl.innerHTML = '<div class="quiz-q">You scored '+score+' / '+QUIZ.length+'</div>'+
        '<p>'+(score===QUIZ.length ? "Perfect — you clearly deserve a seat at the top table." :
          score>0 ? "Respectable. Revise before the celebrations; there may be spot checks." :
          "Oh dear. Come and get to know us better — we're delightful.")+'</p>'+
        '<button class="btn ghost" id="quiz-again" type="button">Play again</button>';
      document.getElementById("quiz-again").addEventListener("click",()=>{qi=0;score=0;renderQuiz();});
      return;
    }
    const item = QUIZ[qi];
    quizEl.innerHTML = '<div class="quiz-q">'+(qi+1)+'. '+item.q+'</div>'+
      '<div class="quiz-opts">'+item.opts.map((o,i)=>'<button type="button" data-i="'+i+'">'+o+'</button>').join("")+'</div>'+
      '<div class="quiz-fb" id="quiz-fb"></div>';
    quizEl.querySelectorAll(".quiz-opts button").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const i = +btn.dataset.i;
        quizEl.querySelectorAll(".quiz-opts button").forEach(b=>b.disabled=true);
        if(i === item.right){ btn.classList.add("right"); score++; document.getElementById("quiz-fb").textContent = item.yes; petalsBurst(24); }
        else { btn.classList.add("wrong"); quizEl.querySelectorAll(".quiz-opts button")[item.right].classList.add("right");
               document.getElementById("quiz-fb").textContent = item.no; }
        setTimeout(()=>{ qi++; renderQuiz(); }, 1900);
      });
    });
  }
  renderQuiz();

  /* ============================================================
     THE WEDDING CONCIERGE (Connie)
     Prefers OpenAI via POST /api/connie (key stays server-side).
     Falls back to the offline keyword KB in concierge-kb.js if the
     API is offline, unconfigured, or errors. Edit that file for facts.
     ============================================================ */
  
  const FALLBACK = "I'm Connie, and I only know what's written on this website — but I know all of it. Try me on trains, taxis, airports, hotels, parking, timings, what to wear, the food, the Ukrainian celebration, day trips to London or Europe, the guestbook, or the games. For anything I can't answer, the humans check their email (Contact page) more often than they'd like to admit.";

  /* Offline keyword engine — used when AI is unavailable. */
  const chatHistory = [];
  let chatBusy = false;

  function expandQuery(q){
    let extra = [];
    const low = " "+q.toLowerCase()+" ";
    for(const term in SYN){
      if(low.indexOf(" "+term+" ")>=0 || low.indexOf(term)>=0) extra = extra.concat(SYN[term]);
    }
    return q + " " + extra.join(" ");
  }
  function scoreEntry(e, words, rxEsc){
    if(e.t && !e.t.includes(TIER)) return 0;
    let s = 0;
    for(const k of e.k){
      /* whole-word (or phrase) match; longer keywords weigh more */
      if(new RegExp("(^|[^a-z])"+rxEsc(k)+"($|[^a-z])").test(words)) s += k.length + (k.indexOf(" ")>=0 ? 4 : 0);
    }
    return s;
  }
  function answerOffline(q){
    const rxEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const words = " " + expandQuery(q).toLowerCase() + " ";
    const ranked = KB.map(e=>({e, s:scoreEntry(e, words, rxEsc)}))
                     .filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
    if(!ranked.length) return FALLBACK;
    return ranked[0].e.a;
  }

  async function answerAi(q){
    const res = await fetch("/api/connie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: q,
        history: chatHistory.slice(-12),
        tier: TIER || null,
        name: NAME || null,
      }),
    });
    let data = null;
    try { data = await res.json(); } catch (_) { /* ignore */ }
    if(!res.ok){
      const err = new Error(data?.error || "Connie AI unavailable");
      err.code = data?.code || "HTTP_"+res.status;
      throw err;
    }
    if(!data?.reply) throw new Error("Empty Connie reply");
    return data.reply;
  }

  const fab = document.getElementById("chat-fab"), panel = document.getElementById("chat-panel"),
        log = document.getElementById("chat-log"), input = document.getElementById("chat-input"),
        veil = document.getElementById("chat-veil"),
        sendBtn = document.getElementById("chat-send");
  function addMsg(text, who){
    const d = document.createElement("div");
    d.className = "msg "+who; d.textContent = text;
    log.appendChild(d); log.scrollTop = log.scrollHeight;
    return d;
  }
  function setChatBusy(on){
    chatBusy = on;
    if(input) input.disabled = on;
    if(sendBtn) sendBtn.disabled = on;
  }
  async function send(qText){
    const q = (qText !== undefined ? qText : input.value).trim();
    if(!q || chatBusy) return;
    addMsg(q, "user"); input.value = "";
    setChatBusy(true);
    const thinking = addMsg("Connie is thinking…", "bot thinking");
    try {
      const reply = await answerAi(q);
      thinking.classList.remove("thinking");
      thinking.textContent = reply;
      chatHistory.push({ role: "user", content: q }, { role: "assistant", content: reply });
    } catch (_) {
      /* AI missing or failed — keyword KB still works offline */
      thinking.classList.remove("thinking");
      thinking.textContent = answerOffline(q);
    } finally {
      setChatBusy(false);
      try { input.focus(); } catch (_) {}
    }
  }
  function setChatOpen(on){
    panel.classList.toggle("open", on);
    fab.setAttribute("aria-expanded", on ? "true" : "false");
    if(veil) veil.classList.toggle("show", on);
    document.body.classList.toggle("chat-open", on);
    if(on){
      document.getElementById("chat-nudge").classList.remove("show");
      store.set("km-nudge","seen");
      seedChat();
      setTimeout(()=>{ try{ input.focus(); }catch(e){} }, 50);
    }
  }
  function openChat(){ setChatOpen(true); }
  function closeChat(){ setChatOpen(false); }
  function seedChat(){
    if(log.childElementCount) return;
    addMsg("Hello"+(NAME && NAME!=="Guest" ? ", "+NAME : "")+"! I'm Connie 🌸 — your Concierge for Nuptials, Networking, Itineraries & Events. I know this whole website inside out, so ask me anything: trains, hotels, timings, dress codes, the Ukrainian traditions, day trips, even what a 'Spoons' is.", "bot");
    const chips = document.getElementById("chat-chips");
    const starters = TIER==="afterparty"
      ? ["Last trains home?","Where's the after party?","What should I wear?"]
      : TIER==="vinko"
      ? ["What is the pre-wedding celebration?","What should I wear?","Which airport?"]
      : ["Which airport?","Last trains home?","What should I wear?"];
    chips.innerHTML = "";
    starters.forEach(s=>{
      const b = document.createElement("button"); b.type="button"; b.textContent = s;
      b.addEventListener("click", ()=>send(s));
      chips.appendChild(b);
    });
  }
  fab.addEventListener("click", e=>{
    e.preventDefault();
    e.stopPropagation();
    setChatOpen(!panel.classList.contains("open"));
  });
  document.querySelectorAll(".open-chat").forEach(b=>b.addEventListener("click", e=>{
    e.preventDefault();
    openChat();
  }));
  document.getElementById("nudge-close").addEventListener("click", ()=>{
    document.getElementById("chat-nudge").classList.remove("show");
    store.set("km-nudge","seen");
  });
  document.getElementById("chat-close").addEventListener("click", closeChat);
  if(veil) veil.addEventListener("click", closeChat);
  document.getElementById("chat-send").addEventListener("click", ()=>send());
  input.addEventListener("keydown", e=>{ if(e.key==="Enter") send(); });

  /* (storage wrappers `store` and `lstore` live near the top, by the router) */

  /* ============================================================
     LIVE WEATHER — Open-Meteo, free, no key. St Albans 51.755,-0.336
     ============================================================ */
  /* ---- countdown fun facts: one per day, computed from days-left ---- */
  function daysFact(d){
    if(d <= 0) return "It's today. IT'S TODAY.";
    const facts = [
      d + " sleeps. Kiko has been informed and is pacing herself.",
      "The ISS will orbit Earth about " + (d*16).toLocaleString() + " more times before we say \"I do\".",
      "A snail leaving the Cathedral now (no breaks) would reach Hatfield House " + Math.max(1, Math.floor(d*1.44/12)) + " times over. Be more snail.",
      Math.floor(d/7) + " more Saturdays to rehearse your dance moves. Use them wisely.",
      "That's " + (d*86400).toLocaleString() + " seconds, each one measurably closer to cake.",
      "A Roman legion marching from Verulamium (30km/day) would cover " + (d*30).toLocaleString() + " km by the big day — " + (d*30 > 3800 ? "Rome and back, with sightseeing" : "most of the way to Rome and back") + ".",
      "The Normans took ~11 years to raise the Cathedral tower. We only need " + d + " more days. Amateurs.",
      "Enough time to walk the Camino de Santiago " + (d/35).toFixed(1) + " more times. Megan has personally verified the maths.",
      "Roughly " + Math.max(1, Math.round(d/30.4)) + " months of Wedding Workouts. The dance floor will know.",
      "Elizabeth I waited 25 years at Hatfield to become queen. You can manage " + d + " days for the party."
    ];
    return facts[d % facts.length];
  }
  const WXC = {0:["☀️","Clear skies"],1:["🌤","Mostly clear"],2:["⛅","Partly cloudy"],3:["☁️","Overcast"],
    45:["🌫","Fog"],48:["🌫","Freezing fog"],51:["🌦","Light drizzle"],53:["🌦","Drizzle"],55:["🌧","Heavy drizzle"],
    61:["🌧","Light rain"],63:["🌧","Rain"],65:["🌧","Heavy rain"],66:["🌧","Freezing rain"],67:["🌧","Freezing rain"],
    71:["🌨","Light snow"],73:["🌨","Snow"],75:["❄️","Heavy snow"],77:["🌨","Snow grains"],
    80:["🌦","Light showers"],81:["🌦","Showers"],82:["⛈","Heavy showers"],85:["🌨","Snow showers"],86:["🌨","Snow showers"],
    95:["⛈","Thunderstorm"],96:["⛈","Thunder & hail"],99:["⛈","Thunder & hail"]};
  function wx(){
    const mini = document.getElementById("wx-mini"), card = document.getElementById("wx-card");
    fetch("https://api.open-meteo.com/v1/forecast?latitude=51.755&longitude=-0.336&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FLondon")
      .then(r=>r.json()).then(d=>{
        const c = d.current, day = d.daily;
        const [ico,txt] = WXC[c.weather_code] || ["🌡","Weather"];
        if(mini) mini.textContent = ico+" "+Math.round(c.temperature_2m)+"°C · "+txt;
        if(card) card.innerHTML =
          '<div class="wx-big">'+ico+'</div>'+
          '<div><div class="wx-temp">'+Math.round(c.temperature_2m)+'°C</div>'+
          '<div class="wx-meta">'+txt+' · feels like '+Math.round(c.apparent_temperature)+'° · wind '+Math.round(c.wind_speed_10m)+' km/h</div>'+
          '<div class="wx-meta">Today: '+Math.round(day.temperature_2m_min[0])+'–'+Math.round(day.temperature_2m_max[0])+'°C · rain chance '+day.precipitation_probability_max[0]+'%</div></div>'+
          '<div class="wx-src">live · refreshes every 15 min · open-meteo.com</div>';
      }).catch(()=>{
        if(mini) mini.textContent = "🌦 the skies are being coy — live weather appears once the site is online";
        if(card) card.innerHTML = '<div class="wx-meta">Live St Albans weather appears here when the site is online — it fetches from open-meteo.com, free and key-less, refreshed every 15 minutes.</div>';
      });
  }
  wx(); setInterval(wx, 15*60*1000);

  /* ============================================================
     MAPS ✏️ EDIT the pin lists. One generic Leaflet factory serves
     every map; each initialises lazily on first visit to its page.
     cat: venue | sight | pub | stay | rail  (colours in MAP_COLS)
     ============================================================ */
  const MAP_COLS = {venue:"#B3945C", sight:"#6B82B8", pub:"#7C8B6E", stay:"#C08A72", rail:"#41507A", guest:"#93A8D8", journey:"#B3945C",
                    from:"#B3945C", home:"#A2543F", travel:"#6B82B8", hm:"#7C8B6E",
                    culture:"#7C8B6E", kids:"#C08A72", food:"#B3945C", date:"#A2543F"};
  
  
  
  
  /* The About Us story map: pins come straight from SETTINGS.storyMap
     (place, coords, category, memory, optional photo). Dotted gold arcs
     are drawn automatically from every "from" pin to the "home" pin. */
  const STORY_PINS = buildStoryPins(SETTINGS.storyMap);
  const STORY_LINES = buildStoryLines(STORY_PINS);
  const MAPS = buildMaps(STORY_PINS, STORY_LINES);
  
  const mapRefs = {};
  function initMapFor(route){
    const cfg = MAPS[route]; if(!cfg) return;
    /* the atlas re-pulls live data every visit so new RSVPs show up */
    if(cfg.atlas && (mapRefs[route]!==undefined)){ try{ atlasCloudRefresh(); }catch(e){} }
    if(mapRefs[route]){ mapRefs[route].invalidateSize(); return; }
    const el = document.getElementById(cfg.el); if(!el) return;
    if(typeof L === "undefined"){
      el.outerHTML = '<p class="note">This map loads when you\'re online — the leaderboard below still works.</p>';
      mapRefs[route] = null;
      /* the leaderboard doesn't need the map — build it anyway */
      if(cfg.atlas) atlasCloudRefresh();
      return;
    }
    const map = L.map(cfg.el,{scrollWheelZoom:false, worldCopyJump:true}).setView(cfg.center, cfg.zoom);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(map);
    (cfg.lines||[]).forEach(pts=>L.polyline(pts,{color:"#B3945C",weight:2,dashArray:"2 8",opacity:.85}).addTo(map));
    function drop(p){
      /* optional photo in the popup — only from local flat image names,
         and it quietly removes itself if the file isn't uploaded yet */
      const photo = (p.img && /^images[_\/][\w.\-]+$/.test(p.img))
        ? "<img src='"+esc(p.img)+"' alt='"+esc(p.n)+"' loading='lazy' onerror='this.remove()' style='width:100%;max-width:220px;margin:.45rem 0 .2rem;border:1px solid #D8D2C2;display:block'>"
        : "";
      L.circleMarker([p.lat,p.lng],{radius:9,color:"#fff",weight:2,fillColor:MAP_COLS[p.cat]||"#6B82B8",fillOpacity:.95})
        .addTo(map)
        .bindPopup("<strong>"+esc(p.n)+"</strong>"+photo+"<br>"+esc(p.d||"")+"<br><a target=_blank rel=noopener href='https://maps.google.com/?q="+encodeURIComponent(p.n)+"'>Google Maps →</a>");
    }
    cfg.pins.forEach(drop);
    if(cfg.atlas){
      atlasMap = map;
      atlasDrop = drop;
      atlasCloudRefresh();
    }
    mapRefs[route] = map;
  }

  /* ---- Guest Atlas: live from RSVP addresses (cloud) ---- */
  const ST_ALBANS = {lat:51.7527, lng:-0.3394};
  let atlasMap = null, atlasDrop = null, atlasMarkers = [];
  function haversineMiles(a, b){
    const R = 3958.8, toR = x=>x*Math.PI/180;
    const dLat = toR(b.lat-a.lat), dLng = toR(b.lng-a.lng);
    const s = Math.sin(dLat/2)**2 + Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLng/2)**2;
    return Math.round(2*R*Math.asin(Math.sqrt(s)));
  }
  function atlasRenderRows(rows){
    /* only households that are actually attending get a pin/rank */
    const people = rows
      .filter(r=>isFinite(r.lat) && isFinite(r.lng) && r.attending!=="no")
      .map(r=>{
        const place = [r.city, r.country].filter(Boolean).join(", ") || "Somewhere lovely";
        const miles = haversineMiles(ST_ALBANS, {lat:r.lat, lng:r.lng});
        return {name:r.name||"Guests", place, lat:r.lat, lng:r.lng, miles};
      })
      .sort((a,b)=>b.miles-a.miles);

    const boardWrap = document.getElementById("atlas-board-wrap");
    const empty = document.getElementById("atlas-empty");
    if(!people.length){
      if(empty) empty.style.display = "";
      if(boardWrap) boardWrap.style.display = "none";
      return;
    }
    if(empty) empty.style.display = "none";

    /* drop pins */
    if(atlasMap && atlasDrop){
      atlasMarkers.forEach(m=>{ try{ atlasMap.removeLayer(m); }catch(e){} });
      atlasMarkers = [];
      people.forEach((p,i)=>{
        const leader = i===0 ? " 🏆 furthest so far" : "";
        const m = L.circleMarker([p.lat,p.lng],{radius:9,color:"#fff",weight:2,
          fillColor: i===0 ? "#B3945C" : "#6B82B8", fillOpacity:.95})
          .addTo(atlasMap)
          .bindPopup("<strong>"+esc(p.name)+"</strong>"+leader+"<br>"+esc(p.place)+
                     "<br>"+p.miles.toLocaleString()+" miles to St Albans");
        atlasMarkers.push(m);
      });
    }

    /* leaderboard */
    const tbl = document.getElementById("atlas-board");
    if(tbl && boardWrap){
      boardWrap.style.display = "";
      tbl.querySelectorAll("tr:not(:first-child)").forEach(r=>r.remove());
      people.slice(0,15).forEach((p,i)=>{
        const tr = document.createElement("tr");
        [i+1, p.name, p.place, p.miles.toLocaleString()].forEach(v=>{
          const td=document.createElement("td"); td.textContent=v; tr.appendChild(td);
        });
        if(i===0) tr.style.fontWeight = "600";
        tbl.appendChild(tr);
      });
    }
  }
  function atlasCloudRefresh(){
    if(!CLOUD){
      const empty = document.getElementById("atlas-empty");
      if(empty){ empty.textContent = "The live map switches on once the site's cloud is connected."; empty.style.display=""; }
      return Promise.resolve();
    }
    return cloudGet("atlas").then(rows=>{ if(Array.isArray(rows)) atlasRenderRows(rows); }).catch(()=>{});
  }

  /* shared naive CSV parser (handles quoted commas) — used by the
     guest list, the Guest Atlas, the live wall and the leaderboard */
  /* cloud: imported from ./cloud.js (parseCsv, CLOUD, cloudGet, cloudPost) */
  /* ============================================================
     GUEST LIST — loaded from SETTINGS.guests, or (if set) a published
     Google Sheet CSV. The Guest Dashboard page was removed; this list
     still powers RSVP name-matching and the concierge. See DEV NOTES.
     ============================================================ */
  let GUESTS_LIVE = SETTINGS.guests || [];
  function findGuest(name){
    return GUESTS_LIVE.find(g => norm(g.name) === norm(name));
  }
  /* dashRender is retained as a harmless no-op so the many call sites
     (personalise, guest-sheet load) don't need surgery. */
  function dashRender(){ /* dashboard removed — nothing to render */ }
  /* Optional live guest list from a published Google Sheet (CSV).
     Publish: File → Share → Publish to web → CSV. Columns with a
     header row: name,rsvp,table,note                               */
  if(SETTINGS.guestSheetCsv){
    fetch(SETTINGS.guestSheetCsv).then(r=>r.text()).then(txt=>{
      const parsed = parseCsv(txt).filter(g=>g.name);
      if(parsed.length){ GUESTS_LIVE = parsed; }
    }).catch(()=>{ /* sheet unreachable: SETTINGS.guests stays in force */ });
  }

  /* one-time hello line + tab-title wink + RSVP petal send-off */
  function personalise(){
    const loc = document.querySelector("#page-home .hero-loc");
    if(loc && !document.getElementById("hello-line")){
      const h = new Date().getHours();
      const tod = h<12 ? "Good morning" : h<18 ? "Good afternoon" : "Good evening";
      const p = document.createElement("p");
      p.id = "hello-line";
      p.style.cssText = "text-align:center;font-style:italic;color:var(--ink-soft);margin-top:.55rem";
      p.textContent = (NAME && NAME!=="Guest") ? tod+", "+NAME+" — we're so glad you're here." : tod+" — we're so glad you're here.";
      loc.insertAdjacentElement("afterend", p);
    }
    dashRender();
    huntRefresh();
  }
  let oldTitle = document.title;
  document.addEventListener("visibilitychange", ()=>{
    if(document.hidden){ oldTitle = document.title; document.title = "🌸 the countdown misses you…"; }
    else document.title = oldTitle;
  });
  /* ============================================================
     RSVP — a slick inline form that saves to the cloud, is
     tier-aware, remembers each household by the gate NAME, shows
     on the dashboard, and can be edited any time.
     (config + RSVP_STATE are declared earlier, near TIER)
     ============================================================ */
  let rsvpReady = false;
  function rsvpInit(){
    if(rsvpReady) return; 
    const form = document.getElementById("rsvp-form"); if(!form) return;
    rsvpReady = true;

    if(!CLOUD){
      document.getElementById("rsvp-fallback").style.display = "";
      document.getElementById("rsvp-fields").style.display = "none";
      return;
    }

    const tier = TIER || "full";
    const events = RSVP_EVENTS[tier] || RSVP_EVENTS.full;
    const catering = tierHasCatering(tier);

    /* ---- build the event tick-boxes for this tier ---- */
    const evWrap = document.getElementById("r-events");
    evWrap.className = "rsvp-events";
    evWrap.innerHTML = "";
    events.forEach(ev=>{
      const l = document.createElement("label"); l.className = "rsvp-check";
      l.innerHTML = '<input type="checkbox" data-ev="'+ev.k+'"> <span>'+ev.label+'</span>';
      evWrap.appendChild(l);
    });
    /* a single-event tier: pre-tick it and hide the "which" question */
    if(events.length === 1){
      evWrap.querySelector("input").checked = true;
      document.getElementById("r-events-fs").style.display = "none";
    }

    /* ---- guest rows react to the party-size selector ---- */
    const sizeSel = document.getElementById("r-size");
    /* Rebuild the per-guest rows. `prefill` (optional) supplies saved
       guest data when loading an existing RSVP; otherwise whatever is
       currently typed in the DOM is preserved across size changes. */
    function buildGuestRows(prefill){
      const n = +sizeSel.value || 1;
      const host = document.getElementById("r-guests");
      const existing = prefill || readGuestRows();    /* keep what's typed */
      host.innerHTML = "";
      for(let i=0;i<n;i++){
        const g = existing[i] || {};
        const row = document.createElement("div"); row.className = "rsvp-guest";
        let diet = "";
        if(catering){
          diet = '<div class="rsvp-diet"><div class="rsvp-diet-lab">Dietary needs (tick any)</div><div class="rsvp-diet-grid">';
          DIET_OPTS.forEach((d,di)=>{
            const on = g.diet && g.diet.indexOf(d)>=0 ? " checked" : "";
            diet += '<label class="rsvp-check"><input type="checkbox" data-diet="'+di+'"'+on+'> <span>'+d+'</span></label>';
          });
          const otherOn = g.dietOther ? g.dietOther : "";
          diet += '</div><input class="rsvp-other-in" data-diet-other placeholder="Other dietary needs (optional)" value="'+esc(otherOn)+'"></div>';
        }
        row.innerHTML =
          '<h5>Guest '+(i+1)+(i===0?' (lead)':'')+'</h5>'+
          '<div class="rsvp-guest-top">'+
            '<label class="rsvp-l">Full name<input type="text" data-gname value="'+esc(g.name||(i===0?document.getElementById("r-name").value:""))+'" placeholder="Name"></label>'+
            '<label class="rsvp-child"><input type="checkbox" data-gchild'+(g.child?" checked":"")+'> Child</label>'+
          '</div>'+ diet;
        host.appendChild(row);
      }
    }
    function readGuestRows(){
      return [...document.querySelectorAll("#r-guests .rsvp-guest")].map(row=>{
        const diet = [...row.querySelectorAll("[data-diet]:checked")].map(c=>DIET_OPTS[+c.dataset.diet]);
        const other = row.querySelector("[data-diet-other]");
        return {
          name: (row.querySelector("[data-gname]")||{}).value ? row.querySelector("[data-gname]").value.trim() : "",
          child: !!(row.querySelector("[data-gchild]")||{}).checked,
          diet: diet,
          dietOther: other ? other.value.trim() : ""
        };
      });
    }
    /* NB: wrap in an arrow — passing buildGuestRows directly would hand
       it the change Event as `prefill` and wipe the typed rows */
    sizeSel.addEventListener("change", ()=>buildGuestRows());
    /* keep guest 1's name synced with the lead-name field */
    document.getElementById("r-name").addEventListener("input", function(){
      const first = document.querySelector("#r-guests [data-gname]");
      if(first && !first.dataset.touched) first.value = this.value;
    });
    document.addEventListener("input", e=>{ if(e.target.matches("#r-guests [data-gname]")) e.target.dataset.touched="1"; });

    /* ---- accept / decline toggle ---- */
    let attending = null;
    document.querySelectorAll("#r-attending .rsvp-opt").forEach(btn=>{
      btn.setAttribute("aria-pressed","false");
      btn.addEventListener("click", ()=>{
        attending = btn.dataset.attend;
        document.querySelectorAll("#r-attending .rsvp-opt").forEach(b=>{
          const on = b===btn;
          b.classList.toggle("on", on);
          b.setAttribute("aria-pressed", on);          /* screen readers hear the choice */
        });
        document.getElementById("rsvp-ifyes").style.display = attending==="yes" ? "" : "none";
        if(attending==="yes" && !document.querySelector("#r-guests .rsvp-guest")) buildGuestRows();
      });
    });

    /* ---- prefill from an existing RSVP (or just the gate name) ---- */
    document.getElementById("r-name").value = (NAME && NAME!=="Guest") ? NAME : "";
    function applyLoaded(d){
      RSVP_STATE = d;
      if(!d){ buildGuestRows(); return; }
      document.getElementById("r-name").value = d.name || NAME;
      attending = (d.attending==="no") ? "no" : "yes";
      document.querySelectorAll("#r-attending .rsvp-opt").forEach(b=>{
        const on = b.dataset.attend===attending;
        b.classList.toggle("on", on); b.setAttribute("aria-pressed", on);
      });
      document.getElementById("rsvp-ifyes").style.display = attending==="yes" ? "" : "none";
      document.getElementById("r-email").value = d.email || "";
      document.getElementById("r-mobile").value = d.mobile || "";
      document.getElementById("r-address").value = d.address || "";
      if(d.party_size){ sizeSel.value = Math.min(6, Math.max(1, +d.party_size)); }
      buildGuestRows(d.guests || []);                 /* prefill saved guests */
      events.forEach(ev=>{
        const box = evWrap.querySelector('[data-ev="'+ev.k+'"]');
        if(box) box.checked = !!d[ev.k];
      });
      document.getElementById("r-activities").checked = !!d.activities;
      document.getElementById("r-travelafter").checked = !!d.travelling_after;
      showSaved(d);
    }

    buildGuestRows();

    /* fetch this household's existing RSVP by their gate name */
    function loadForName(){
      if(!CLOUD || !NAME || NAME==="Guest") return;
      cloudGet("rsvp", {name: NAME}).then(d=>{ if(d) applyLoaded(d); }).catch(()=>{});
    }
    loadForName();

    /* ---- submit ---- */
    document.getElementById("r-submit").addEventListener("click", ()=>{
      const err = document.getElementById("r-err"); err.textContent = "";
      const name = document.getElementById("r-name").value.trim();
      if(!name){ err.textContent = "Please add the lead guest's full name."; return; }
      if(!attending){ err.textContent = "Please let us know if you can make it."; return; }

      const payload = { action:"rsvp", name:name, attending:attending };
      if(attending === "yes"){
        payload.email = document.getElementById("r-email").value.trim();
        payload.mobile = document.getElementById("r-mobile").value.trim();
        payload.address = document.getElementById("r-address").value.trim();
        payload.party_size = +sizeSel.value || 1;
        payload.guests = readGuestRows();
        /* gentle validation: every party member needs a name (the sheet
           is only useful if we know who's coming), and the email should
           at least look like one if provided */
        if(payload.guests.some(g=>!g.name)){
          err.textContent = "Please add a name for every member of your party.";
          return;
        }
        if(payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)){
          err.textContent = "That email doesn't look quite right — mind checking it?";
          return;
        }
        events.forEach(ev=>{
          const box = evWrap.querySelector('[data-ev="'+ev.k+'"]');
          payload[ev.k] = !!(box && box.checked);
        });
        payload.activities = document.getElementById("r-activities").checked;
        payload.travelling_after = document.getElementById("r-travelafter").checked;
      }

      const btn = document.getElementById("r-submit"); const was = btn.textContent;
      btn.disabled = true; btn.textContent = "Sending…";
      cloudPost(payload)
        .then(()=>{
          petalsBurst(60, typeof GOLD!=="undefined"?GOLD:null);
          toast(attending==="yes" ? "RSVP received — thank you! 💛" : "Thank you for letting us know 🕊");
          RSVP_STATE = rsvpObjFromPayload(payload);
          showSaved(RSVP_STATE);
          dashRsvpRender();
          /* refresh the atlas if it's built */
          try{ atlasCloudRefresh(); }catch(e){}
        })
        .catch(()=>{ err.textContent = "Hmm — that didn't send. Check your connection and try again."; })
        .finally(()=>{ btn.disabled=false; btn.textContent=was; });
    });

    /* edit button on the saved banner reopens the form */
    document.getElementById("rsvp-edit").addEventListener("click", ()=>{
      document.getElementById("rsvp-saved").style.display = "none";
      document.getElementById("rsvp-fields").style.display = "";
      document.getElementById("rsvp-fields").scrollIntoView({behavior:"smooth", block:"start"});
    });

    function showSaved(d){
      document.getElementById("rsvp-fields").style.display = "none";
      const box = document.getElementById("rsvp-saved"); box.style.display = "";
      document.getElementById("rsvp-saved-body").innerHTML = rsvpSummaryHtml(d, events);
    }
  }

  /* HTML-escape for anything user-supplied that lands in innerHTML.
     Covers &, ", ', < and > so it's safe in text AND attribute contexts —
     if you add features, run guest text through this (or use textContent). */
  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function rsvpObjFromPayload(p){
    const o = Object.assign({}, p);
    ["pre_wedding","ceremony","breakfast","evening","afterparty","activities","travelling_after"].forEach(k=>{ o[k]=!!p[k]; });
    return o;
  }
  function rsvpSummaryHtml(d, events){
    if(!d) return "";
    if(d.attending === "no"){
      return '<p class="rsvp-summary">You\'ve let us know you sadly can\'t make it. We\'ll miss you — thank you for replying.</p>';
    }
    const evList = (events||RSVP_EVENTS.full).filter(ev=>d[ev.k]).map(ev=>ev.label.split(" — ")[0]);
    const g = (d.guests||[]).filter(x=>x && x.name);
    let s = '<div class="rsvp-summary">';
    s += '<strong>'+esc(d.name)+'</strong> — joyfully attending 💛<br>';
    if(g.length){
      s += 'Party of '+g.length+': '+g.map(x=>esc(x.name)+(x.child?" (child)":"")).join(", ")+'<br>';
      const diets = [];
      g.forEach(x=>{ (x.diet||[]).forEach(dd=>{ if(diets.indexOf(dd)<0) diets.push(dd); }); if(x.dietOther) diets.push(x.dietOther); });
      if(diets.length) s += 'Dietary: '+diets.map(esc).join(", ")+'<br>';
    }
    if(evList.length) s += 'Coming to: '+evList.join(" · ")+'<br>';
    if(d.city||d.country) s += 'From: '+esc([d.city,d.country].filter(Boolean).join(", "))+'<br>';
    s += '</div>';
    return s;
  }

  /* dashboard RSVP card */
  function dashRsvpRender(){
    const body = document.getElementById("dash-rsvp-body"); if(!body) return;
    const load = (RSVP_STATE && norm(RSVP_STATE.name)===norm(NAME)) ? Promise.resolve(RSVP_STATE)
      : (CLOUD && NAME!=="Guest" ? cloudGet("rsvp",{name:NAME}).catch(()=>null) : Promise.resolve(null));
    load.then(d=>{
      if(d){ RSVP_STATE = d; body.innerHTML = rsvpSummaryHtml(d, RSVP_EVENTS[TIER]||RSVP_EVENTS.full); }
      else body.innerHTML = '<p class="rsvp-summary">We haven\'t heard from you yet — <a href="#rsvp">send your RSVP</a> and it\'ll appear here.</p>';
    });
  }

  /* ============================================================
     GUESTBOOK & PHOTO WALL
     ============================================================ */
  const GB_PIN = {memory:"📌", advice:"💡", wish:"🕊"};
  const GB_KIND = {memory:"a memory", advice:"advice", wish:"a wish"};
  /* --- storage strategy (see DEVELOPER-NOTES.md) ---
     Permanent wall: wall.json next to this file (falls back to
     SETTINGS.guestbookWall if absent). Grows to hundreds of
     entries without touching this code; photos are files in
     images_, never base64. Local pins: compressed to ~900px JPEG
     before touching localStorage; capped at the 20 most recent. */
  let WALL = SETTINGS.guestbookWall || [];
  let gbShown = {before:60, after:60};               /* photo batch per wall */
  let gbActive = "before";                            /* which wall's tab is open */
  /* priority: live Google Sheet → wall.json → SETTINGS list.
     With guestbookCsv set, a Form response appears on the wall on
     the next page load — no redeploy, no email round-trip.       */
  /* priority: LIVE CLOUD → live Google Sheet CSV → wall.json → SETTINGS */
  function gbCloudRefresh(){
    return cloudGet("guestbook").then(rows=>{
      if(Array.isArray(rows)){ WALL = rows; gbRender(); }
    });
  }
  if(CLOUD){
    gbCloudRefresh().catch(wallJson);
    /* keep the wall fresh while someone is actually looking at it */
    setInterval(()=>{
      const pg = document.getElementById("page-guestbook");
      if(pg && pg.classList.contains("visible") && !document.hidden) gbCloudRefresh().catch(()=>{});
    }, 60000);
  } else if(SETTINGS.guestbookCsv){
    fetch(SETTINGS.guestbookCsv).then(r=>r.text()).then(t=>{
      const rows = parseCsv(t).filter(e=>e.text || e.img);
      if(rows.length){ WALL = rows.reverse(); gbRender(); }   /* newest first */
      else wallJson();
    }).catch(wallJson);
  } else wallJson();
  function wallJson(){
    fetch("wall.json").then(r => r.ok ? r.json() : Promise.reject())
      .then(j => { if(Array.isArray(j) && j.length){ WALL = j; gbRender(); } })
      .catch(()=>{ /* no wall.json — SETTINGS list stays in force */ });
  }
  function shrinkImage(file, maxDim, quality){        /* canvas downscale → JPEG dataURL */
    return new Promise((res, rej)=>{
      const img = new Image(), u = URL.createObjectURL(file);
      img.onload = ()=>{
        const sc = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width*sc));
        c.height = Math.max(1, Math.round(img.height*sc));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        res(c.toDataURL("image/jpeg", quality));
      };
      img.onerror = rej; img.src = u;
    });
  }
  function gbLocal(){ try{ return JSON.parse(lstore.get("km-guestbook")||"[]"); }catch(e){ return []; } }
  const IMG_OK = /^(https:\/\/|images[\/_]|data:image\/)/;
  function gbPhase(e){ return (e && e.phase==="after") ? "after" : "before"; }
  function isPhotoOnly(e){ return e && e.img && IMG_OK.test(e.img) && (!e.text || !e.text.trim()); }

  /* the ordered photo list per wall (locals first), used by the lightbox */
  let gbPhotos = {before:[], after:[]};

  function gbRender(){
    if(!document.getElementById("gb-mosaic-before")) return;
    const locals = gbLocal();
    ["before","after"].forEach(phase=>{
      const notesHost = document.getElementById("gb-notes-"+phase);
      const mosHost   = document.getElementById("gb-mosaic-"+phase);
      notesHost.innerHTML = ""; mosHost.innerHTML = "";

      const localHere = locals.filter(e=>gbPhase(e)===phase);
      const cloudHere = WALL.filter(e=>gbPhase(e)===phase);

      /* --- notes (text entries): locals first, then the wall --- */
      const addNote = (e,local)=>{
        const d = document.createElement("div");
        d.className = "gb-note "+(e.type||"memory")+(local?" gb-local":"");
        const pin = document.createElement("span"); pin.className="pin"; pin.textContent = GB_PIN[e.type]||"📌"; d.appendChild(pin);
        const k = document.createElement("div"); k.className="kind"; k.textContent = (GB_KIND[e.type]||"a note")+(local?" · on this device":""); d.appendChild(k);
        if(e.img && IMG_OK.test(e.img)){
          const im = document.createElement("img"); im.src=e.img; im.alt="Guestbook photo"; im.loading="lazy"; im.onerror=()=>im.remove(); d.appendChild(im);
        }
        const t = document.createElement("p"); t.textContent = e.text; d.appendChild(t);
        const w = document.createElement("div"); w.className="who"; w.textContent = "— "+(e.who||"Anonymous"); d.appendChild(w);
        notesHost.appendChild(d);
      };
      localHere.filter(e=>!isPhotoOnly(e)).forEach(e=>addNote(e,true));
      cloudHere.filter(e=>!isPhotoOnly(e)).forEach(e=>addNote(e,false));

      /* --- mosaic (every entry that has a photo) --- */
      const photoList = localHere.filter(e=>e.img&&IMG_OK.test(e.img)).map(e=>({e,local:true}))
        .concat(cloudHere.filter(e=>e.img&&IMG_OK.test(e.img)).map(e=>({e,local:false})));
      gbPhotos[phase] = photoList;
      const shown = photoList.slice(0, gbShown[phase]);
      shown.forEach((it,idx)=>{
        const b = document.createElement("button"); b.type="button";
        b.className = "gb-tile"+(it.local?" gb-local":"");
        const im = document.createElement("img"); im.src=it.e.img; im.loading="lazy";
        im.alt = (it.e.who? it.e.who+"'s photo":"Guestbook photo");
        im.onerror = ()=>{ b.remove(); };
        b.appendChild(im);
        b.addEventListener("click", ()=>gbOpenLightbox(phase, idx));
        mosHost.appendChild(b);
      });

      /* headings / counts / empties */
      const hasPhotos = photoList.length>0;
      const mh = document.getElementById("gb-mos-h-"+phase);
      const hint = document.getElementById("gb-mos-hint-"+phase);
      if(mh) mh.style.display = hasPhotos ? "" : "none";
      if(hint) hint.style.display = hasPhotos ? "" : "none";
      const cnt = document.getElementById("gb-count-"+phase);
      if(cnt) cnt.textContent = hasPhotos ? "· "+photoList.length+" photo"+(photoList.length>1?"s":"") : "";
      const more = document.querySelector('.gb-more[data-more="'+phase+'"]');
      if(more) more.style.display = photoList.length > gbShown[phase] ? "" : "none";
      if(phase==="after"){
        const empty = document.getElementById("gb-after-empty");
        if(empty) empty.style.display = (hasPhotos || notesHost.children.length) ? "none" : "";
      }
    });
  }
  gbRender();
  document.querySelectorAll(".gb-more").forEach(btn=>{
    btn.addEventListener("click", ()=>{ const p = btn.dataset.more; gbShown[p]+=60; gbRender(); });
  });

  /* ---- lightbox ---- */
  let lbPhase="before", lbIdx=0;
  function gbOpenLightbox(phase, idx){
    lbPhase=phase; lbIdx=idx; gbShowLb();
    const lb = document.getElementById("gb-lightbox"); lb.hidden=false;
  }
  function gbShowLb(){
    const list = gbPhotos[lbPhase]; if(!list||!list.length) return;
    lbIdx = (lbIdx+list.length)%list.length;
    const it = list[lbIdx];
    document.getElementById("gb-lb-img").src = it.e.img;
    document.getElementById("gb-lb-cap").textContent =
      (it.e.who? "— "+it.e.who : "") + (it.e.text? "  ·  "+it.e.text : "");
  }
  (function(){
    const lb=document.getElementById("gb-lightbox"); if(!lb) return;
    const close=()=>{ lb.hidden=true; document.getElementById("gb-lb-img").src=""; };
    document.getElementById("gb-lb-close").addEventListener("click", close);
    document.getElementById("gb-lb-prev").addEventListener("click", ()=>{ lbIdx--; gbShowLb(); });
    document.getElementById("gb-lb-next").addEventListener("click", ()=>{ lbIdx++; gbShowLb(); });
    lb.addEventListener("click", e=>{ if(e.target===lb) close(); });
    document.addEventListener("keydown", e=>{
      if(lb.hidden) return;
      if(e.key==="Escape") close();
      else if(e.key==="ArrowLeft"){ lbIdx--; gbShowLb(); }
      else if(e.key==="ArrowRight"){ lbIdx++; gbShowLb(); }
    });
  })();

  /* ---- upload: supports selecting several photos at once ---- */
  let gbPhotoQueue = [];                              /* array of dataURLs */
  document.getElementById("gb-photo").addEventListener("change", function(){
    const files = [...(this.files||[])]; if(!files.length){ gbPhotoQueue=[]; return; }
    Promise.all(files.slice(0,30).map(f=>shrinkImage(f, CLOUD?1400:900, CLOUD?.82:.78).catch(()=>null)))
      .then(arr=>{
        gbPhotoQueue = arr.filter(Boolean);
        toast(gbPhotoQueue.length>1 ? gbPhotoQueue.length+" photos ready 📸" : "Photo ready 📸");
      });
  });

  function gbCurrentPhase(){ return gbActive; }

  document.getElementById("gb-pin").addEventListener("click", ()=>{
    const who = document.getElementById("gb-who").value.trim() || (NAME!=="Guest" ? NAME : "");
    const text = document.getElementById("gb-text").value.trim();
    let type = document.getElementById("gb-type").value;
    const phase = gbCurrentPhase();
    const photos = gbPhotoQueue.slice();
    if(!text && !photos.length){ toast("Add a few words or a photo first."); return; }
    if(!text && photos.length) type = "photo";        /* photo-only entries */

    /* build one entry per photo (so each becomes a mosaic tile); if there's
       text but no photo, a single note; text+photos → text rides the first. */
    const entries = [];
    if(photos.length){
      photos.forEach((img,i)=>entries.push({who, type, text:(i===0?text:""), img, phase}));
    } else {
      entries.push({who, type, text, img:undefined, phase});
    }

    if(CLOUD){
      const btn = document.getElementById("gb-pin"); btn.disabled=true; const was=btn.textContent; btn.textContent="Pinning…";
      WALL = entries.concat(WALL); gbRender(); petalsBurst(30);
      Promise.all(entries.map(en=>cloudPost({action:"guestbook", who, type:en.type, text:en.text, photo:en.img||"", phase})))
        .then(()=>{
          toast(entries.length>1 ? "Pinned to the wall — everyone can see them 🎉" : "Pinned to the wall — everyone can see it 🎉");
          document.getElementById("gb-text").value="";
          gbPhotoQueue=[]; document.getElementById("gb-photo").value="";
          gbCloudRefresh().catch(()=>{});
        })
        .catch(()=>{
          WALL = WALL.filter(e=>entries.indexOf(e)<0); gbRender();
          toast("Hmm — the wall didn't answer. Check your connection and try again?");
        })
        .finally(()=>{ btn.disabled=false; btn.textContent=was; });
      return;
    }
    /* offline: keep the most recent pins on this device (photos are heavy) */
    const list = gbLocal();
    entries.forEach(en=>list.unshift(en));
    while(list.length > 20) list.pop();
    if(!lstore.set("km-guestbook", JSON.stringify(list))){
      list.forEach(x=>{ x.img=undefined; });          /* drop photos, retry */
      if(!lstore.set("km-guestbook", JSON.stringify(list))){ toast("This browser's storage is full."); return; }
      toast("Storage was tight — pinned without the photo. Email it to us instead!");
    }
    gbPhotoQueue=[]; document.getElementById("gb-photo").value="";
    document.getElementById("gb-text").value="";
    gbRender(); petalsBurst(30);
    toast("Pinned on this device! Tap 'Email it to us' to make it permanent for everyone.");
  });

  /* submit to the wall: Google Form when configured, otherwise mailto */
  if(CLOUD){
    document.getElementById("gb-mail").style.display = "none";
    const note = document.getElementById("gb-form-help");
    if(note) note.innerHTML = "How the wall works: pin words or photos and they appear here for <em>every</em> guest, live — before the wedding and long after. Photos are tucked safely away for the couple too.";
  }
  if(SETTINGS.guestbookFormUrl) document.getElementById("gb-mail").textContent = "Submit to the wall";
  document.getElementById("gb-mail").addEventListener("click", ()=>{
    if(SETTINGS.guestbookFormUrl){ window.open(SETTINGS.guestbookFormUrl, "_blank", "noopener"); return; }
    const who = document.getElementById("gb-who").value.trim() || NAME;
    const text = document.getElementById("gb-text").value.trim() || "(they pinned it first — text is on their device)";
    const type = document.getElementById("gb-type").value;
    const phase = gbCurrentPhase();
    location.href = "mailto:"+SETTINGS.contactEmail+"?subject="+encodeURIComponent("Guestbook ("+phase+"): "+GB_KIND[type]+" from "+who)+
      "&body="+encodeURIComponent(text+"\n\n— "+who+"\n(photo attached separately if there was one)");
  });

  /* ============================================================
     PLAYLISTS
     ============================================================ */
  function spotifyEmbed(url){
    const m = (url||"").match(/(playlist|album|track)\/([A-Za-z0-9]+)/);
    return m ? "https://open.spotify.com/embed/"+m[1]+"/"+m[2] : null;
  }
  (function(){
    const shared = document.getElementById("pl-shared");
    if(shared){
      const emb = spotifyEmbed(SETTINGS.sharedPlaylist);
      shared.innerHTML = emb
        ? '<div class="pl-embed"><iframe src="'+emb+'" loading="lazy" allow="encrypted-media" title="Shared playlist"></iframe></div>'+
          '<div class="btn-row" style="justify-content:flex-start"><a class="btn primary" target="_blank" rel="noopener" href="'+SETTINGS.sharedPlaylist+'">Open in Spotify to add songs</a></div>'
        : '<div class="pl-embed"><div class="pl-placeholder">The collaborative playlist link goes in SETTINGS.sharedPlaylist —<br>make one in Spotify (⋯ → Invite collaborators) and paste it in.</div></div>';
    }
    const grid = document.getElementById("pl-grid");
    if(grid){
      grid.innerHTML = "";
      (SETTINGS.playlists||[]).forEach(p=>{
        const emb = spotifyEmbed(p.url);
        const d = document.createElement("div"); d.className = "pl-embed";
        d.innerHTML = emb
          ? '<iframe src="'+emb+'" loading="lazy" allow="encrypted-media" title="'+p.title+'"></iframe>'
          : '<div class="pl-placeholder"><strong>'+p.title+'</strong>coming soon — paste a Spotify link into SETTINGS.playlists</div>';
        grid.appendChild(d);
      });
    }
  })();
  function songList(){ try{ return JSON.parse(lstore.get("km-songs")||"[]"); }catch(e){ return []; } }
  function songRender(){
    const el = document.getElementById("song-list"); if(!el) return;
    el.innerHTML = ""; songList().forEach(t=>{ const c=document.createElement("span"); c.textContent="🎵 "+t; el.appendChild(c); });
  }
  songRender();
  document.getElementById("song-add").addEventListener("click", ()=>{
    const v = document.getElementById("song-in").value.trim(); if(!v) return;
    const l = songList(); l.push(v); lstore.set("km-songs", JSON.stringify(l));
    document.getElementById("song-in").value = ""; songRender(); emojiBurst(["🎵","🎶"],8);
    if(CLOUD){
      cloudPost({action:"song", name: NAME, song: v})
        .then(()=>toast("Request delivered straight to the DJ booth 🎶"))
        .catch(()=>toast("Saved here — we'll try the DJ booth again next time you're online."));
    }
  });
  if(CLOUD){
    document.getElementById("song-mail").style.display = "none";
    const sn = document.querySelector("#song-list + .devnote, .songchips + .devnote");
    if(sn) sn.textContent = "Requests go straight to us the moment you add them (and stay listed here for your own records). The Macarena clause of the terms and conditions applies.";
  }
  if(SETTINGS.songFormUrl) document.getElementById("song-mail").textContent = "Submit my requests";
  document.getElementById("song-mail").addEventListener("click", ()=>{
    const l = songList();
    if(!l.length){ toast("Add a request or two first — the dance floor is counting on you."); return; }
    if(SETTINGS.songFormUrl){
      window.open(SETTINGS.songFormUrl.replace("{song}", encodeURIComponent(l.join("; "))).replace("{name}", encodeURIComponent(NAME)), "_blank", "noopener");
      return;
    }
    location.href = "mailto:"+SETTINGS.contactEmail+"?subject="+encodeURIComponent("Song requests!")+"&body="+encodeURIComponent(l.join("\n"));
  });

  /* ============================================================
     THE BRIDAL PARTY — TOP TRUMPS ✏️ EDIT this list.
     Photos: images_party-1.jpg etc. Stats are 0–100.
     ============================================================ */
  
  (function(){
    const grid = document.getElementById("tp-grid"); if(!grid) return;
    PARTY.forEach((m,i)=>{
      const c = document.createElement("button");
      c.type = "button"; c.className = "tp-card";
      c.innerHTML = '<div class="tp-face">'+
        '<span>'+ (m.name||"?").replace("[NAME]","?").charAt(0) +'</span>'+
        '<img src="'+m.img+'" alt="" onerror="this.remove()"></div>'+
        '<div class="tp-role"></div><h4></h4>';
      c.querySelector(".tp-role").textContent = m.role;
      c.querySelector("h4").textContent = m.name;
      c.addEventListener("click", ()=>tpOpen(m));
      grid.appendChild(c);
    });
  })();
  const tpOv = document.getElementById("tp-overlay");
  function tpOpen(m){
    document.getElementById("tpb-role").textContent = m.role;
    document.getElementById("tpb-name").textContent = m.name;
    const face = document.getElementById("tpb-face");
    face.innerHTML = '<span>'+(m.name||"?").replace("[NAME]","?").charAt(0)+'</span><img src="'+m.img+'" alt="" onerror="this.remove()">';
    const st = document.getElementById("tpb-stats"); st.innerHTML = "";
    m.stats.forEach(([lab,val])=>{
      const d = document.createElement("div"); d.className = "tp-stat";
      d.innerHTML = '<div class="lab"><span></span><span>'+val+'</span></div><div class="bar"><div class="fill"></div></div>';
      d.querySelector(".lab span").textContent = lab;
      d.querySelector(".fill").dataset.w = val;
      st.appendChild(d);
    });
    const fx = document.getElementById("tpb-facts");
    fx.innerHTML = "";
    const p1 = document.createElement("p"); p1.innerHTML = "<strong>Known for:</strong> "; p1.appendChild(document.createTextNode(m.known)); fx.appendChild(p1);
    const p2 = document.createElement("p"); p2.innerHTML = "<strong>Classified intel:</strong> "; p2.appendChild(document.createTextNode(m.fact)); fx.appendChild(p2);
    tpOv.classList.add("open");
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      st.querySelectorAll(".fill").forEach(f=>f.style.width = f.dataset.w+"%");
    }));
  }
  document.getElementById("tp-close").addEventListener("click", ()=>tpOv.classList.remove("open"));
  tpOv.addEventListener("click", e=>{ if(e.target===tpOv) tpOv.classList.remove("open"); });
  addEventListener("keydown", e=>{ if(e.key==="Escape") tpOv.classList.remove("open"); });

  /* ============================================================
     THE RUNAWAY BUS 🚌 (click the bus in the day-of timeline)
     ============================================================ */
  const busEgg = document.getElementById("bus-egg");
  function busGo(){
    const b = document.getElementById("bus-run");
    b.classList.remove("go"); void b.offsetWidth; b.classList.add("go");
    toast("🚌 Beep beep! All aboard for Hatfield House.");
  }
  if(busEgg){
    busEgg.addEventListener("click", busGo);
    busEgg.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); busGo(); } });
  }

  /* ============================================================
     PATRIOT MODE 🇺🇸 — the homesickness protocol (For Americans)
     ============================================================ */
  (function(){
    const btn = document.getElementById("usa-btn");
    const modal = document.getElementById("flag-modal");
    const pledge = document.getElementById("pledge-btn");
    if(!btn || !modal || !pledge) return;
    btn.addEventListener("click", ()=>{
      emojiBurst(["🇺🇸","🦅","🎆","⭐"], 42);
      document.body.classList.add("patriot");
      toast("Deploying freedom…");
      setTimeout(()=>{
        document.body.classList.remove("patriot");
        modal.classList.add("open");
      }, 3200);
    });
    pledge.addEventListener("click", ()=>{
      modal.classList.remove("open");
      emojiBurst(["🎆","🎇","🦅"], 30);
      toast("🦅 God bless. Now back to the phrasebook — it says trousers.");
    });
    modal.addEventListener("click", e=>{ if(e.target===modal) modal.classList.remove("open"); });
  })();

  /* ============================================================
     TABS (Field Guide + Guestbook) — buttons carry data-fgtab /
     data-gbtab; panels are #fgtab-* / #gbtab-* in the same sheet.
     ============================================================ */
  function bindTabs(attr, prefix){
    document.querySelectorAll("["+attr+"]").forEach(b=>{
      b.addEventListener("click", ()=>{
        const bar = b.parentElement, sheet = bar.closest(".sheet");
        bar.querySelectorAll("button").forEach(x=>x.classList.remove("on"));
        b.classList.add("on");
        sheet.querySelectorAll("[id^='"+prefix+"']").forEach(p=>p.classList.remove("on"));
        document.getElementById(prefix + b.getAttribute(attr)).classList.add("on");
      });
    });
  }
  bindTabs("data-fgtab","fgtab-");
  bindTabs("data-gbtab","gbtab-");

  /* guestbook tabs additionally swap which WALL (before/after) shows,
     track the active phase for new pins, and retune the form copy */
  (function(){
    const setPhase = (phase)=>{
      gbActive = phase;
      document.querySelectorAll(".gb-wallwrap").forEach(w=>w.classList.remove("on"));
      const wrap = document.getElementById("gbwall-"+phase); if(wrap) wrap.classList.add("on");
      const title = document.getElementById("gb-form-title");
      const typeWrap = document.getElementById("gb-type-wrap");
      if(phase==="after"){
        if(title) title.textContent = "Add to the after-the-day wall";
        /* after the day, photos are the point — keep the note options but default to photo */
        const sel = document.getElementById("gb-type"); if(sel) sel.value = "photo";
      } else {
        if(title) title.textContent = "Pin something to the wall";
        const sel = document.getElementById("gb-type"); if(sel && sel.value==="photo") sel.value = "memory";
      }
    };
    document.querySelectorAll("[data-gbtab]").forEach(b=>{
      b.addEventListener("click", ()=>setPhase(b.getAttribute("data-gbtab")));
    });
    setPhase("before");
  })();

  /* shared photo album slot (Guestbook → After the day) */
  (function(){
    const slot = document.getElementById("album-slot"); if(!slot) return;
    if(SETTINGS.photoAlbum)
      slot.innerHTML = '<a class="btn primary" style="margin-top:.3rem" target="_blank" rel="noopener" href="'+SETTINGS.photoAlbum+'">Open the shared album</a>';
    else
      slot.innerHTML = '<span class="placeholder">[the shared album link appears here after the wedding — SETTINGS.photoAlbum]</span>';
  })();

  /* ============================================================
     BUDDY BOARD notices (SETTINGS.matchBoard) — render only when
     #match-wall exists on the Stay page. Submit form was removed;
     guests email the couple with subject "Buddy Board" instead.
     ============================================================ */
  (function(){
    const w = document.getElementById("match-wall"); if(!w) return;
    (SETTINGS.matchBoard||[]).forEach(e=>{
      const d = document.createElement("div"); d.className = "gb-note wish";
      const pin = document.createElement("span"); pin.className="pin"; pin.textContent="🤝"; d.appendChild(pin);
      const k = document.createElement("div"); k.className="kind"; k.textContent = e.offer||"notice"; d.appendChild(k);
      const t = document.createElement("p"); t.textContent = e.text; d.appendChild(t);
      const who = document.createElement("div"); who.className="who"; who.textContent = "— "+(e.who||"Anonymous"); d.appendChild(who);
      w.appendChild(d);
    });
  })();

  /* ============================================================
     THE HUNT — six hidden petals. State in localStorage; the HQ
     card on the games page shows progress + the next riddle.
     ============================================================ */
  
  function huntGot(){ try{ return JSON.parse(lstore.get("km-hunt")||"[]"); }catch(e){ return []; } }
  function huntRefresh(){
    const got = huntGot();
    document.querySelectorAll(".hunt-token").forEach(t=>{
      if(got.includes(t.dataset.hunt)) t.classList.add("found");
    });
    const pe = document.getElementById("hunt-petals");
    if(pe){
      pe.innerHTML = "";
      HUNT.forEach(h=>{ const sp=document.createElement("span"); sp.textContent="❀"; if(got.includes(h.id)) sp.classList.add("got"); pe.appendChild(sp); });
    }
    const rid = document.getElementById("hunt-riddle");
    if(rid){
      const next = HUNT.find(h=>!got.includes(h.id));
      rid.textContent = got.length===HUNT.length
        ? "All six found. The codeword is BARVINOK — whisper it at the bar. We'll know what it means."
        : "Next clue: "+ (next ? next.riddle : "");
    }
  }
  document.querySelectorAll(".hunt-token").forEach(t=>{
    t.addEventListener("click", ()=>{
      const got = huntGot();
      if(got.includes(t.dataset.hunt)) { toast("You've already picked this petal 🌸"); return; }
      got.push(t.dataset.hunt);
      lstore.set("km-hunt", JSON.stringify(got));
      t.classList.add("found");
      if(got.length === HUNT.length){
        petalsBurst(120, GOLD); emojiBurst(["🏵","🌸","✨"], 20);
        toast("THE HUNT IS COMPLETE, "+(NAME!=="Guest"?NAME.toUpperCase():"CHAMPION")+"! Codeword: BARVINOK — whisper it at the bar on the night 🏆");
      } else {
        petalsBurst(25);
        const next = HUNT.find(h=>!got.includes(h.id));
        toast("Petal "+got.length+" of "+HUNT.length+" found! "+(next ? "Next: "+next.riddle : ""));
      }
      huntRefresh();
    });
  });

  /* ============================================================
     GAMES — initialised on first visit to #games (gamesInit).
     ============================================================ */
  let gamesReady = false;
  function gamesInit(){
    if(gamesReady) return; gamesReady = true;
    xwInit(); kdInit(); huntRefresh();
  }

  /* ---- The Wedding Crossword ------------------------------------
     Layout hand-verified: every horizontal/vertical run of 2+ cells
     is exactly one of these nine words. Grid 8 rows × 13 cols.   */
  
  const XW_R = 8, XW_C = 13;
  let xwCells = {};                            /* "r,c" -> input */
  function xwEach(w, fn){                      /* iterate a word's cells */
    for(let i=0;i<w.a.length;i++) fn(w.d==="A" ? w.r : w.r+i, w.d==="A" ? w.c+i : w.c, w.a[i], i);
  }
  function xwInit(){
    const grid = document.getElementById("xw"); if(!grid || grid.childElementCount) return;
    const cellPx = matchMedia("(max-width:640px)").matches ? 40 : 34;
    grid.style.gridTemplateColumns = "repeat("+XW_C+", "+cellPx+"px)";
    const used = {}, nums = {};
    XW_WORDS.forEach(w=>{ xwEach(w,(r,c)=>{ used[r+","+c]=true; }); nums[w.r+","+w.c] = w.n; });
    let saved = {}; try{ saved = JSON.parse(lstore.get("km-xw")||"{}"); }catch(e){}
    for(let r=0;r<XW_R;r++) for(let c=0;c<XW_C;c++){
      const cell = document.createElement("div");
      cell.className = "xc" + (used[r+","+c] ? "" : " blk");
      if(used[r+","+c]){
        if(nums[r+","+c]){ const n=document.createElement("span"); n.className="xn"; n.textContent=nums[r+","+c]; cell.appendChild(n); }
        const inp = document.createElement("input");
        inp.maxLength = 1; inp.autocomplete="off"; inp.setAttribute("aria-label","crossword cell");
        inp.value = saved[r+","+c] || "";
        inp.addEventListener("input", ()=>{
          inp.value = inp.value.toUpperCase().replace(/[^A-Z]/g,"");
          cell.classList.remove("ok","bad");
          saved[r+","+c] = inp.value; lstore.set("km-xw", JSON.stringify(saved));
        });
        cell.appendChild(inp);
        xwCells[r+","+c] = inp;
      }
      grid.appendChild(cell);
    }
    const ac = document.getElementById("xw-across"), dn = document.getElementById("xw-down");
    XW_WORDS.forEach(w=>{
      const li = document.createElement("li");
      li.textContent = w.n+". "+w.clue;
      (w.d==="A" ? ac : dn).appendChild(li);
    });
    document.getElementById("xw-check").addEventListener("click", ()=>{
      let all = true;
      XW_WORDS.forEach(w=>xwEach(w,(r,c,ch)=>{
        const inp = xwCells[r+","+c], good = inp.value === ch;
        inp.parentElement.classList.toggle("ok", good && !!inp.value);
        inp.parentElement.classList.toggle("bad", !good && !!inp.value);
        if(!good) all = false;
      }));
      if(all){ petalsBurst(60, GOLD); toast("Crossword complete — top of the class"+(NAME!=="Guest"?", "+NAME:"")+"! 🏆"); }
    });
    document.getElementById("xw-reveal").addEventListener("click", ()=>{
      XW_WORDS.forEach(w=>xwEach(w,(r,c,ch)=>{ const i=xwCells[r+","+c]; i.value=ch; i.parentElement.classList.remove("bad"); i.parentElement.classList.add("ok"); }));
    });
    document.getElementById("xw-clear").addEventListener("click", ()=>{
      Object.values(xwCells).forEach(i=>{ i.value=""; i.parentElement.classList.remove("ok","bad"); });
      lstore.set("km-xw","{}");
    });
  }

  /* ---- Kiko Dash — the runner ------------------------------------
     Chrome-dino homage: Kiko jumps obstacles built from the website
     itself (wax seals, [TIME] placeholder chips, hydrangeas, posts).
     Tap / click / Space / ArrowUp to jump. Local top-5 leaderboard. */
  function kdInit(){
    const cv = document.getElementById("kiko-canvas"); if(!cv || cv.dataset.ready) return;
    cv.dataset.ready = "1";
    const cx = cv.getContext("2d");
    /* draw at device resolution so Kiko is crisp on retina phones */
    const W = 800, H = 220, GY = H-34;                    /* logical size + ground line */
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W*DPR; cv.height = H*DPR; cx.scale(DPR, DPR);
    let run=false, over=false, frame=0, speed=4.4, score=0;
    let ky=GY, kvy=0, obs=[], best = +(lstore.get("km-kd-best")||0);
    /* responsiveness + level machinery:
       grace    — frames left in the obstacle-free level intro
       banner   — the "LEVEL N · NAME" card drawn on the canvas
       jumpBuf  — a press just before landing still jumps (input buffer)
       spawnIn  — frames until the next obstacle (delta-time safe)     */
    let grace=0, banner=null, jumpBuf=0, spawnIn=0, lastT=0;
    document.getElementById("kd-best").textContent = String(best).padStart(3,"0");
    function lb(){ try{ return JSON.parse(lstore.get("km-kd-lb")||"[]"); }catch(e){ return []; } }
    function lbRender(){
      const t = document.getElementById("kd-lb");
      t.querySelectorAll("tr:not(:first-child)").forEach(r=>r.remove());
      lb().forEach((e,i)=>{
        const tr = document.createElement("tr");
        [i+1, e.n, e.s+" m"].forEach(v=>{ const td=document.createElement("td"); td.textContent=v; tr.appendChild(td); });
        t.appendChild(tr);
      });
    }
    lbRender();
    /* ---- levels: a new scene every 250 metres ------------------ */
    const LEVELS = [
      {name:"ST ALBANS",     sky:["#FBF9F2","#EFE9D8"], deco:"cathedral", obstacles:["seal","envelope","hyd"]},
      {name:"PALACE GARDENS",sky:["#EAF1E4","#D9E6CF"], deco:"topiary",   obstacles:["cake","gift","hyd","seal"]},
      {name:"VINKOPLENTINNA",sky:["#E8E2F0","#CFC3E0"], deco:"wreaths",   obstacles:["wreath","flute","envelope"]},
      {name:"AFTER PARTY",   sky:["#252B44","#171C30"], deco:"disco",     obstacles:["flute","cake","gift","seal"]}
    ];
    let level = 0;
    function levelFor(sc){ return Math.min(LEVELS.length-1, Math.floor(sc/250)); }
    function spawn(){
      const kinds = LEVELS[level].obstacles;
      const k = kinds[(Math.random()*kinds.length)|0];
      const w = k==="cake" ? 46 : k==="envelope" ? 52 : k==="flute" ? 18 : k==="wreath" ? 40 : k==="gift" ? 34 : 34;
      const h = k==="flute" ? 52 : k==="cake" ? 48 : k==="wreath" ? 40 : 34;
      obs.push({k, x: W+20, w, h});
    }
    /* ---- Kiko: a small black-and-white Japanese Chin ----------- */
    function drawKiko(){
      const x = 70, y = ky;
      cx.save(); cx.translate(x, y);
      const trot = run && ky>=GY ? Math.sin(frame/2.2)*4 : 0;
      /* plumed tail — her finest feature, held over the back */
      cx.strokeStyle="#fff"; cx.lineWidth=7; cx.lineCap="round";
      cx.beginPath(); cx.moveTo(-14,-16); cx.quadraticCurveTo(-26,-34, -18,-36+Math.sin(frame/3)*3); cx.stroke();
      cx.strokeStyle="#20263B"; cx.lineWidth=2;
      cx.beginPath(); cx.moveTo(-17,-30); cx.quadraticCurveTo(-22,-34,-19,-35); cx.stroke();
      /* small white body */
      cx.fillStyle="#fff"; cx.strokeStyle="#D8D2C2"; cx.lineWidth=1.5;
      cx.beginPath(); cx.ellipse(0,-13,16,10,0,0,7); cx.fill(); cx.stroke();
      /* black saddle patch */
      cx.fillStyle="#20263B";
      cx.beginPath(); cx.ellipse(-4,-18,9,5,.3,0,7); cx.fill();
      /* round flat-faced head */
      cx.fillStyle="#fff";
      cx.beginPath(); cx.arc(14,-24,9,0,7); cx.fill(); cx.stroke();
      /* black ear + eye patches (the classic Chin mask) */
      cx.fillStyle="#20263B";
      cx.beginPath(); cx.ellipse(9,-30,4.5,6,-.5,0,7); cx.fill();       /* left ear  */
      cx.beginPath(); cx.ellipse(19,-30,4.5,6,.5,0,7); cx.fill();       /* right ear */
      cx.beginPath(); cx.ellipse(10,-24,3,3.6,0,0,7); cx.fill();        /* eye patch */
      /* big dark eyes + button nose on the flat face */
      cx.fillStyle="#fff"; cx.beginPath(); cx.arc(10.5,-24.5,1.1,0,7); cx.fill();
      cx.fillStyle="#20263B";
      cx.beginPath(); cx.arc(17,-23.5,1.6,0,7); cx.fill();
      cx.beginPath(); cx.arc(15,-20.5,1.8,0,7); cx.fill();              /* nose */
      /* trotting legs, black-tipped */
      cx.strokeStyle="#fff"; cx.lineWidth=4;
      cx.beginPath(); cx.moveTo(-7,-5); cx.lineTo(-7+trot,3); cx.moveTo(7,-5); cx.lineTo(7-trot,3); cx.stroke();
      cx.strokeStyle="#20263B"; cx.lineWidth=3;
      cx.beginPath(); cx.moveTo(-7+trot,2); cx.lineTo(-7+trot,4); cx.moveTo(7-trot,2); cx.lineTo(7-trot,4); cx.stroke();
      /* her necklace — a fine gold chain around her neck, with both
         wedding rings hung from it, swinging gently as she runs */
      const sway = run ? Math.sin(frame/3.5)*1.4 : 0;
      cx.strokeStyle="#B3945C"; cx.lineWidth=1.4; cx.lineCap="round";
      cx.beginPath(); cx.moveTo(6,-20); cx.quadraticCurveTo(13+sway*.4,-13.5, 20,-19.5); cx.stroke();
      cx.lineWidth=1.8;
      cx.beginPath(); cx.arc(11.2+sway,-10.6,3.1,0,7); cx.stroke();
      cx.beginPath(); cx.arc(15.6+sway,-9.8,3.1,0,7); cx.stroke();
      cx.fillStyle="#F4C64D";                          /* a wink of light on each ring */
      cx.beginPath(); cx.arc(9.6+sway,-12.4,.8,0,7); cx.fill();
      cx.beginPath(); cx.arc(14+sway,-11.6,.8,0,7); cx.fill();
      cx.restore();
    }
    /* ---- wedding-flavoured obstacles ---------------------------- */
    function drawObs(o){
      cx.save(); cx.translate(o.x, GY);
      const dark = level===3;
      if(o.k==="seal"){
        cx.fillStyle="#B3945C"; cx.beginPath(); cx.arc(17,-17,16,0,7); cx.fill();
        cx.fillStyle="#F7F0DE"; cx.font="11px Georgia"; cx.textAlign="center"; cx.fillText("K·M",17,-13);
      } else if(o.k==="envelope"){
        cx.fillStyle="#FFFDF6"; cx.strokeStyle="#B3945C"; cx.lineWidth=2;
        cx.fillRect(0,-32,o.w,30); cx.strokeRect(0,-32,o.w,30);
        cx.beginPath(); cx.moveTo(0,-32); cx.lineTo(o.w/2,-16); cx.lineTo(o.w,-32); cx.stroke();
        cx.fillStyle="#8A7440"; cx.font="9px Georgia"; cx.textAlign="center"; cx.fillText("RSVP", o.w/2, -5);
      } else if(o.k==="hyd"){
        cx.fillStyle="#93A8D8";
        [[8,-10],[20,-8],[14,-20],[26,-18],[20,-30]].forEach(([px,py])=>{ cx.beginPath(); cx.arc(px,py,7,0,7); cx.fill(); });
      } else if(o.k==="cake"){
        cx.fillStyle="#FFFDF6"; cx.strokeStyle="#C9B489"; cx.lineWidth=1.5;
        cx.fillRect(3,-16,40,16); cx.strokeRect(3,-16,40,16);
        cx.fillRect(9,-32,28,16); cx.strokeRect(9,-32,28,16);
        cx.fillRect(15,-46,16,14); cx.strokeRect(15,-46,16,14);
        cx.fillStyle="#93A8D8"; [[8,-16],[23,-16],[38,-16],[14,-32],[32,-32]].forEach(([px,py])=>{cx.beginPath();cx.arc(px,py,2.5,0,7);cx.fill();});
        cx.fillStyle="#B3945C"; cx.fillRect(21,-52,1.6,6); cx.fillRect(25,-52,1.6,6);   /* K & M toppers */
      } else if(o.k==="flute"){
        cx.strokeStyle = dark ? "#F4C64D" : "#8FA3CB"; cx.lineWidth=2;
        cx.beginPath(); cx.moveTo(9,0); cx.lineTo(9,-18); cx.stroke();                   /* stem  */
        cx.beginPath(); cx.moveTo(2,-52); cx.lineTo(4,-18); cx.lineTo(14,-18); cx.lineTo(16,-52); cx.stroke();
        cx.fillStyle = dark ? "rgba(244,198,77,.35)" : "rgba(147,168,216,.35)";
        cx.fillRect(4,-50,11,14);                                                        /* fizz  */
        cx.fillStyle="#fff"; [[6,-52],[10,-55],[14,-52]].forEach(([px,py])=>{cx.beginPath();cx.arc(px,py,1.5,0,7);cx.fill();});
      } else if(o.k==="wreath"){
        cx.strokeStyle="#7C8B6E"; cx.lineWidth=6;
        cx.beginPath(); cx.arc(20,-20,14,0,7); cx.stroke();
        cx.fillStyle="#F4C64D"; [[20,-34],[34,-20],[20,-6],[6,-20]].forEach(([px,py])=>{cx.beginPath();cx.arc(px,py,3,0,7);cx.fill();});
        cx.fillStyle="#93A8D8"; [[30,-30],[10,-30],[30,-10],[10,-10]].forEach(([px,py])=>{cx.beginPath();cx.arc(px,py,2.5,0,7);cx.fill();});
      } else {                                                                            /* gift  */
        cx.fillStyle="#DCE4F4"; cx.strokeStyle="#6B82B8"; cx.lineWidth=1.5;
        cx.fillRect(0,-30,34,30); cx.strokeRect(0,-30,34,30);
        cx.fillStyle="#6B82B8"; cx.fillRect(15,-30,4,30); cx.fillRect(0,-18,34,4);
        cx.beginPath(); cx.arc(13,-32,4,0,7); cx.arc(21,-32,4,0,7); cx.stroke();
      }
      cx.restore();
    }
    /* ---- level scenery behind the action ------------------------ */
    function drawScene(){
      const Lv = LEVELS[level];
      const g = cx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,Lv.sky[0]); g.addColorStop(1,Lv.sky[1]);
      cx.fillStyle=g; cx.fillRect(0,0,W,H);
      const off = (frame*0.6)%W;
      cx.save(); cx.globalAlpha = level===3 ? .5 : .35;
      if(Lv.deco==="cathedral"){
        cx.fillStyle="#8FA3CB";
        for(let i=0;i<3;i++){ const bx=((i*330)-off+W)%W;
          cx.fillRect(bx,GY-70,52,70); cx.fillRect(bx+18,GY-96,16,26);
          cx.beginPath(); cx.moveTo(bx+18,GY-96); cx.lineTo(bx+26,GY-112); cx.lineTo(bx+34,GY-96); cx.fill(); }
      } else if(Lv.deco==="topiary"){
        cx.fillStyle="#7C8B6E";
        for(let i=0;i<5;i++){ const bx=((i*210)-off+W)%W;
          cx.fillRect(bx+13,GY-26,6,26); cx.beginPath(); cx.arc(bx+16,GY-40,15,0,7); cx.fill(); }
      } else if(Lv.deco==="wreaths"){
        cx.strokeStyle="#9AA98B"; cx.lineWidth=4;
        for(let i=0;i<4;i++){ const bx=((i*260)-off+W)%W;
          cx.beginPath(); cx.arc(bx+30,60+(i%2)*30,18,0,7); cx.stroke(); }
        cx.fillStyle="#F4C64D";
        for(let i=0;i<8;i++){ cx.beginPath(); cx.arc((i*137+frame*0.2)%W, 24+(i*31)%70, 1.6, 0, 7); cx.fill(); }
      } else {  /* disco */
        for(let i=0;i<14;i++){
          cx.fillStyle = ["#F4C64D","#93A8D8","#E88AA0","#8FD0B9"][i%4];
          cx.beginPath(); cx.arc((i*97+frame*2)%W, 20+(i*43)%(H-80), 3, 0, 7); cx.fill(); }
      }
      cx.restore();
      cx.strokeStyle = level===3 ? "#4A527A" : "#CBB78D"; cx.lineWidth=2;
      cx.beginPath(); cx.moveTo(0,GY+2); cx.lineTo(W,GY+2); cx.stroke();
    }
    /* each level opens with an on-screen card and a safe stretch:
       no obstacles spawn and Kiko cannot be hit until it fades      */
    const GRACE_FRAMES = 110;                             /* ≈ 1.8 seconds */
    function enterLevel(lv){
      level = lv;
      document.getElementById("kd-level").textContent = "LVL "+(level+1)+" · "+LEVELS[level].name;
      banner = { txt: "LEVEL "+(level+1), sub: LEVELS[level].name, t: GRACE_FRAMES };
      grace = GRACE_FRAMES; obs = []; spawnIn = 20;
    }
    function doJump(){ kvy = -10.8; jumpBuf = 0; }
    function press(){
      if(over){ reset(); return; }
      if(!run){ run = true; enterLevel(0); return; }
      if(ky >= GY-0.5) doJump();
      else jumpBuf = 7;                                   /* buffer a press made just before landing */
    }
    function release(){ if(kvy < -4.2) kvy = -4.2; }      /* let go early = a shorter hop */
    function reset(){ run=false; over=false; frame=0; speed=4.4; score=0; obs=[]; ky=GY; kvy=0;
      grace=0; banner=null; jumpBuf=0; spawnIn=0;
      level=0; document.getElementById("kd-level").textContent = "LVL 1 · ST ALBANS"; paint(); }
    function gameOver(){
      run=false; over=true;
      if(score > best){ best = score; lstore.set("km-kd-best", best); document.getElementById("kd-best").textContent = String(best).padStart(3,"0"); }
      const board = lb(); board.push({n: NAME, s: score});
      board.sort((a,b)=>b.s-a.s); lstore.set("km-kd-lb", JSON.stringify(board.slice(0,5))); lbRender();
      kdCloudSubmit();
      toast(score>60 ? "Kiko made it "+score+"m with the rings! 🏆" : "Kiko tripped at "+score+"m. The rings are fine. Probably.");
    }
    function paint(){
      cx.clearRect(0,0,W,H);
      drawScene();
      obs.forEach(drawObs); drawKiko();
      cx.fillStyle = level===3 ? "#C9D2F0" : "#5B6788"; cx.font="12px Georgia"; cx.textAlign="left";
      if(!run && !over) cx.fillText("Tap or press space — Kiko has the rings and no plan.", 16, 24);
      if(banner && banner.t > 0){                          /* the level card, fading out */
        const a = Math.min(1, banner.t / 28);
        cx.save(); cx.globalAlpha = a; cx.textAlign = "center";
        cx.fillStyle = level===3 ? "rgba(23,28,48,.55)" : "rgba(251,249,242,.72)";
        cx.fillRect(W/2-150, 52, 300, 64);
        cx.strokeStyle = "#B3945C"; cx.lineWidth = 1; cx.strokeRect(W/2-150, 52, 300, 64);
        cx.fillStyle = level===3 ? "#F4C64D" : "#8A6F3F";
        cx.font = "11px Georgia"; cx.fillText(banner.txt, W/2, 74);
        cx.fillStyle = level===3 ? "#C9D2F0" : "#41507A";
        cx.font = "22px Georgia"; cx.fillText(banner.sub, W/2, 100);
        cx.restore();
      }
      if(over){ cx.textAlign="center"; cx.font="20px Georgia"; cx.fillStyle = level===3 ? "#F4C64D" : "#41507A";
        cx.fillText("Paws. "+score+"m — tap to try again", W/2, 90); }
    }
    function loop(now){
      /* delta-time physics: the game runs at the SAME speed on 60Hz
         laptops and 120Hz phones, and inputs land the frame they occur */
      const dt = lastT ? Math.min(2.6, (now - lastT) / 16.667) : 1;
      lastT = now;
      if(run){
        frame += dt;
        if(grace > 0){ grace -= dt; }
        else {
          spawnIn -= dt;
          if(spawnIn <= 0 || (obs.length===0 && frame>30)){
            spawn();
            spawnIn = Math.max(46, 100 - Math.floor(score/8)) * (0.8 + Math.random()*0.45);
          }
        }
        if(banner){ banner.t -= dt; if(banner.t <= 0) banner = null; }
        speed = 4.4 + score/90;
        kvy += 0.58*dt; ky = Math.min(GY, ky + kvy*dt);
        if(jumpBuf > 0){ jumpBuf -= dt; if(ky >= GY-0.5) doJump(); }
        obs.forEach(o=>o.x -= speed*dt);
        obs = obs.filter(o=>o.x > -80);
        score = Math.floor(frame/6);
        const lv = levelFor(score);
        if(lv !== level) enterLevel(lv);                  /* new scene, new card, safe stretch */
        document.getElementById("kd-score").textContent = String(score).padStart(3,"0")+" m";
        if(grace <= 0){
          for(const o of obs){
            const ow = o.w, oh = o.h;
            if(70+14 > o.x+6 && 70-14 < o.x+ow-6 && ky > GY-oh+6){ gameOver(); break; }
          }
        }
        paint();
      }
      requestAnimationFrame(loop);
    }
    paint(); requestAnimationFrame(loop);
    cv.addEventListener("pointerdown", e=>{ e.preventDefault(); press(); });
    cv.addEventListener("pointerup",   e=>{ e.preventDefault(); release(); });
    cv.addEventListener("pointercancel", release);
    addEventListener("keydown", e=>{
      const gamesOn = document.getElementById("page-games").classList.contains("visible");
      if(!gamesOn) return;
      if(e.key===" "||e.key==="ArrowUp"){
        if(document.activeElement && document.activeElement.tagName==="INPUT") return;   /* not while in the crossword */
        e.preventDefault();
        if(!e.repeat) press();
      }
    });
    addEventListener("keyup", e=>{
      if(e.key===" "||e.key==="ArrowUp") release();
    });
    /* live cloud leaderboard: personal bests submit themselves */
    function kdCloudSubmit(){
      if(!CLOUD || !score || NAME==="Guest") return;
      const sent = +(lstore.get("km-kd-sent")||0);
      if(score <= sent) return;
      cloudPost({action:"score", name: NAME, score: score})
        .then(()=>{ lstore.set("km-kd-sent", score); kdLiveBoard(); })
        .catch(()=>{});
    }
    function kdLiveBoard(){
      if(!CLOUD) return;
      cloudGet("scores").then(rows=>{
        const tbl = document.getElementById("kd-lb");
        tbl.querySelectorAll(".kd-live").forEach(r=>r.remove());
        const hdr = document.createElement("tr"); hdr.className = "kd-live";
        hdr.innerHTML = '<th colspan="3" style="padding-top:1rem">🏆 Official wedding-wide tally (live)</th>';
        tbl.appendChild(hdr);
        rows.slice(0,10).forEach((e,i)=>{
          const tr = document.createElement("tr"); tr.className = "kd-live";
          [i+1, e.name, e.score+" m"].forEach(v=>{ const td=document.createElement("td"); td.textContent=v; tr.appendChild(td); });
          tbl.appendChild(tr);
        });
      }).catch(()=>{});
    }
    kdLiveBoard();
    /* submit best score: automatic when the LIVE CLOUD is on; else a
       pre-filled Google Form when configured; else mailto */
    if(CLOUD){
      document.getElementById("kd-mail").textContent = "Refresh the live tally";
      const dn = document.querySelector("#kd-lb + .devnote");
      if(dn) dn.innerHTML = "Your best run joins the official wedding-wide tally automatically — no emailing required. <strong>Prizes at stake:</strong> highest score before 29 May wins the first slice of cake, a victory lap announced by the DJ, and a pint on Kazimir. Runner-up chooses one song — no vetoes.";
    }
    if(SETTINGS.scoreFormUrl && !CLOUD) document.getElementById("kd-mail").textContent = "Submit my best score";
    document.getElementById("kd-mail").addEventListener("click", ()=>{
      if(CLOUD){
        kdCloudSubmit(); kdLiveBoard(); toast("Tally refreshed 🏆");
        return;
      }
      if(SETTINGS.scoreFormUrl){
        window.open(SETTINGS.scoreFormUrl.replace("{name}", encodeURIComponent(NAME)).replace("{score}", best), "_blank", "noopener");
        return;
      }
      location.href = "mailto:"+SETTINGS.contactEmail+"?subject="+encodeURIComponent("Kiko Dash score: "+best+"m — "+NAME)+
        "&body="+encodeURIComponent(NAME+" ran "+best+" metres. I claim my place in the official tally (and, ideally, the cake).");
    });
    /* live wedding-wide leaderboard from the published score sheet */
    if(SETTINGS.scoreCsv && !CLOUD){
      fetch(SETTINGS.scoreCsv).then(r=>r.text()).then(t=>{
        const rows = parseCsv(t).map(r=>({n:r.name||"?", s:+r.score||0}))
          .filter(r=>r.s>0).sort((a,b)=>b.s-a.s).slice(0,10);
        if(!rows.length) return;
        const tbl = document.getElementById("kd-lb");
        const hdr = document.createElement("tr");
        hdr.innerHTML = '<th colspan="3" style="padding-top:1rem">🏆 Official wedding-wide tally (live)</th>';
        tbl.appendChild(hdr);
        rows.forEach((e,i)=>{
          const tr = document.createElement("tr");
          [i+1, e.n, e.s+" m"].forEach(v=>{ const td=document.createElement("td"); td.textContent=v; tr.appendChild(td); });
          tbl.appendChild(tr);
        });
      }).catch(()=>{});
    }
  }
}
