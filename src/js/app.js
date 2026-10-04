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
import { createConnie } from "./concierge-ai.js";
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
import { initGallery, refreshGallery, openGalleryLightbox, galleryResumed } from "./gallery.js";

export function boot() {
  /* ---------- tier access (from ./tier.js) ---------- */
  let TIER = null;

  /* ---- RSVP config + state ---- */
  let RSVP_STATE = null;   /* the currently loaded RSVP, if any */

  /* storage: imported from ./storage.js */
  let NAME = "Guest";   /* set at the gate; personalises the whole site */

  /* ---------- router ---------- */
  let pendingAnchor = null;
  /* Filled in once the pin lists are built. Declared up here because a
     returning guest is unlocked, and show() runs, before that build. */
  let MAPS = {};
  /* Set once Kiko Dash exists, so leaving the games page can pause 3D. */
  let onGamesVisibility = ()=>{};
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
    document.body.classList.toggle("on-games", route === "games");
    if(route === "games") setTimeout(()=>{ try{ gamesInit(); onGamesVisibility(true); }catch(e){} }, 60);
    else { try{ onGamesVisibility(false); }catch(e){} }
    if(route === "rsvp") setTimeout(()=>{ try{ rsvpInit(); }catch(e){ console.error(e); } }, 40);
    window.scrollTo(0,0);
    /* Home week-calendar taps set this, then change the hash. The day
       cards live on #week, which is display:none until this route shows,
       so the scroll has to happen after the page is actually visible. */
    if(pendingAnchor){
      const id = pendingAnchor;
      pendingAnchor = null;
      if(route === "week"){
        /* Fade-in uses a transform for 0.5s, and webfonts can still be
           shifting the layout after that. Measure once the fade is over,
           then again once fonts have settled, so the jump lands on the day. */
        const jumpToDay = ()=>{
          const jump = document.getElementById(id);
          if(!jump) return;
          const top = jump.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo(0, Math.max(0, top));
        };
        setTimeout(jumpToDay, 650);
        setTimeout(jumpToDay, 1400);
      }
    }
  }
  document.addEventListener("click", e=>{
    const dayBtn = e.target.closest && e.target.closest("[data-week-day]");
    if(!dayBtn) return;
    const id = dayBtn.getAttribute("data-week-day");
    if(!id || !document.getElementById(id)) return;
    pendingAnchor = id;
    /* replaceState, not location.hash: assigning the hash makes the
       browser scroll to the top again a moment later and undo the jump. */
    const onWeek = (location.hash||"").replace(/^#/,"") === "week";
    if(!onWeek) history.replaceState(null, "", "#week");
    show("week");
  });
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
    for(const t of ["full","vinko"]){
      if(norm(p[t]) && n === norm(p[t])) return t;   /* blank setting = tier disabled */
    }
    return null;
  }
  function unlock(tier, quiet){
    lstore.set("km-tier", tier);
    store.set("km-tier", tier);
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
    /* one-time nudge so nobody misses the concierge — never cover reading */
    if(store.get("km-nudge") !== "seen"){
      setTimeout(()=>{
        if(document.getElementById("chat-panel").classList.contains("open")) return;
        if(document.body.classList.contains("on-games")) return;
        const nudge = document.getElementById("chat-nudge");
        nudge.classList.add("show");
        const dismiss = ()=>{
          if(!nudge.classList.contains("show")) return;
          nudge.classList.remove("show");
          store.set("km-nudge","seen");
          removeEventListener("scroll", dismiss);
        };
        addEventListener("scroll", dismiss, {passive:true});
        setTimeout(dismiss, 7000);
      }, 3500);
    }
  }
  function tryPassword(){
    const tier = matchTier(document.getElementById("pw").value);
    if(tier){
      /* the NAME personalises greetings, the dashboard, games and the concierge */
      NAME = document.getElementById("gname").value.trim() || "Guest";
      lstore.set("km-name", NAME);
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
  const savedTier = lstore.get("km-tier") || store.get("km-tier");
  /* Restored at the end of boot, once toast, RSVP and the maps exist.
     Unlocking here would call those before their bindings are ready. */

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

  /* ---------- settings wiring ---------- */
  /* faqs page contact cards */
  const faqEmail = document.getElementById("contact-email-link");
  const faqEmailVal = document.getElementById("contact-email-val");
  const faqWa = document.getElementById("contact-wa-link");
  if(faqEmail){ faqEmail.href = "mailto:"+SETTINGS.contactEmail; }
  if(faqEmailVal){ faqEmailVal.textContent = SETTINGS.contactEmail; }
  if(faqWa){ faqWa.href = SETTINGS.whatsappLink; }
  const rsvpWa = document.getElementById("whatsapp-join-btn");
  if(rsvpWa){ rsvpWa.href = SETTINGS.whatsappLink; }
  const homeWa = document.getElementById("home-wa-btn");
  if(homeWa){ homeWa.href = SETTINGS.whatsappLink; }
  const vy = document.getElementById("vyshyvanka-code");
  if(vy) vy.textContent = SETTINGS.vyshyvankaCode;
  if(SETTINGS.spotifyLink){
    const sc = document.getElementById("spotify-card"); if(sc) sc.style.display = "";
    const sl = document.getElementById("spotify-link"); if(sl) sl.href = SETTINGS.spotifyLink;
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
  const sealBtn = document.getElementById("seal-btn");
  if(sealBtn) sealBtn.addEventListener("click", ()=>{ location.hash = "#home"; petalsBurst(120); });
  /* 2. type "budmo" anywhere */
  let typed = "";
  addEventListener("keydown", e=>{
    if(e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    typed = (typed + (e.key||"").toLowerCase()).slice(-5);
    if(typed === "budmo"){ petalsBurst(70, GOLD); emojiBurst(["🥂"],14); toast("Будьмо! 🥂 (The correct reply is: Гей!)"); typed=""; }
  });
  /* 3. Kiko's paw in the footer */
  let pawCount = 0;
  const pawBtn = document.getElementById("paw-btn");
  if(pawBtn) pawBtn.addEventListener("click", ()=>{
    pawCount++;
    emojiBurst(["🐾"], 10);
    toast(pawCount < 3 ? "Woof. Kiko has inspected this website and approves."
                       : "Kiko says that's enough attention. (It is never enough attention.)");
  });
  /* 4. Ukrainian flag burst */
  const ukFlag = document.getElementById("ukraine-flag");
  if(ukFlag){
    const fireUkraine = ()=>{ emojiBurst(["🇺🇦","🌻","💛","💙","✨","🎉","🌟","💪","❤️","🎊"], 80); };
    ukFlag.addEventListener("click", fireUkraine);
    ukFlag.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); fireUkraine(); }});
  }

  /* 5. the button that says not to press it */
  const myst = document.getElementById("mystery-btn");
  const mystConfirm = document.getElementById("mystery-confirm");
  if(myst && mystConfirm){
    myst.addEventListener("click", ()=>{
      myst.textContent = "You were warned.";
      myst.disabled = true;
      mystConfirm.style.display = "";
    });
    mystConfirm.addEventListener("click", ()=>{
      mystConfirm.style.display = "none";
      document.body.classList.add("disco");
      emojiBurst(["🪩","💃","🕺"], 54);
      toast("You had TWO chances. 🪩 Welcome to the (very brief) disco.");
      setTimeout(()=>document.body.classList.remove("disco"), 2200);
      mystConfirm.textContent = "You pressed both buttons";
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
     THE WEDDING CONCIERGE ✏️ EDIT — add entries to the knowledge
     base in src/data/concierge-kb.js. Each entry: keywords it
     listens for, the answer, and which tiers may hear it
     (omit tiers = everyone). Those answers are used directly when
     no OpenAI key is configured, and they are also part of the
     context when Connie is answering with the model.
     ============================================================ */
  
  const FALLBACK = "I'm Connie, and I only know what's written on this website — but I know all of it. Try me on trains, taxis, airports, hotels, parking, timings, what to wear, the food, the Ukrainian celebration, day trips to London or Europe, the [Guestbook](#guestbook), or [In-Flight Entertainment](#games). For anything I can't answer, the [FAQs](#faqs) have the couple's contact details.";

  /* light synonym map so guests' phrasing matches the keywords. Each line:
     if the question contains the term on the left, we also test the ones
     on the right. Keeps the KB readable while widening what Connie hears. */
  
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
  function answer(q){
    const rxEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const words = " " + expandQuery(q).toLowerCase() + " ";
    /* rank ALL entries so we can offer runners-up if the top score is weak */
    const ranked = KB.map(e=>({e, s:scoreEntry(e, words, rxEsc)}))
                     .filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
    if(!ranked.length) return FALLBACK;
    /* confident hit */
    if(ranked[0].s >= 5 || ranked.length===1) return ranked[0].e.a;
    /* weak/ambiguous: lead with the best guess, then nudge toward alternatives */
    return ranked[0].e.a;
  }

  const connie = createConnie({
    getTier: () => TIER,
    getName: () => NAME,
    localAnswer: answer,
  });

  const fab = document.getElementById("chat-fab"), panel = document.getElementById("chat-panel"),
        log = document.getElementById("chat-log"), input = document.getElementById("chat-input"),
        veil = document.getElementById("chat-veil");
  let chatBusy = false;
  /* Known hash routes + common phrases → clickable in-bot links */
  const CHAT_ROUTES = {
    home:"Home", rsvp:"RSVP", about:"About Us", party:"Bridal Party",
    generations:"Generations of Love", memory:"In Loving Memory", bts:"Behind the Scenes",
    thankyous:"Thank Yous", week:"Wedding Week", vinko:"Vinkopletyny", bigday:"The Big Day",
    ceremony:"Ceremony", reception:"Evening Reception",
    registry:"Registry", guestbook:"Guestbook",
    "expl-sta":"Explore St Albans", "expl-ldn":"Explore London", "expl-day":"England Day Trips",
    "expl-eur":"Explore Europe", playlists:"Playlists", games:"In-Flight Entertainment",
    faqs:"FAQs", stay:"Where to Stay", americans:"For Americans", ukraine:"For Ukrainians",
    atlas:"Guest Atlas"
  };
  const CHAT_PHRASES = [
    {re:/\b(?:the\s+)?(?:Where to )?Stay page\b/gi, route:"stay"},
    {re:/\b(?:the\s+)?FAQs? page\b/gi, route:"faqs"},
    {re:/\b(?:the\s+)?RSVP page\b/gi, route:"rsvp"},
    {re:/\b(?:the\s+)?Registry page\b/gi, route:"registry"},
    {re:/\b(?:the\s+)?Ceremony page\b/gi, route:"ceremony"},
    {re:/\b(?:the\s+)?Evening Reception page\b/gi, route:"reception"},
    {re:/\b(?:the\s+)?Bridal Party page\b/gi, route:"party"},
    {re:/\b(?:the\s+)?Guestbook\b/gi, route:"guestbook"},
    {re:/\b(?:the\s+)?Playlists? page\b/gi, route:"playlists"},
    {re:/\b(?:the\s+)?(?:For )?Americans page\b/gi, route:"americans"},
    {re:/\b(?:the\s+)?Thank Yous page\b/gi, route:"thankyous"},
    {re:/\b(?:the\s+)?Guest Atlas\b/gi, route:"atlas"},
    {re:/\bIn-Flight Entertainment(?:\s+(?:page|lounge))?\b/gi, route:"games"},
    {re:/\b(?:the\s+)?Europe page\b/gi, route:"expl-eur"},
    {re:/\b(?:the\s+)?(?:Pre-Wedding Celebration|Vinkopletyny) page\b/gi, route:"vinko"},
    {re:/\bField Guide\b/gi, route:"expl-sta"}
  ];
  function makeChatLink(href, label){
    const a = document.createElement("a");
    a.className = "chat-link";
    a.textContent = label;
    if(/^https?:\/\//i.test(href)){
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    } else {
      const route = href.replace(/^#/, "");
      a.href = "#" + route;
      if(CHAT_ROUTES[route]) a.setAttribute("data-route", route);
    }
    return a;
  }
  function appendLinkedPlain(parent, text){
    if(!text) return;
    /* Find the earliest phrase or bare #route match and recurse */
    let best = null;
    for(const {re, route} of CHAT_PHRASES){
      re.lastIndex = 0;
      const m = re.exec(text);
      if(m && (!best || m.index < best.index)){
        best = {index:m.index, len:m[0].length, href:"#"+route, label:m[0]};
      }
    }
    const hashRe = /#(home|rsvp|about|party|generations|memory|bts|thankyous|week|vinko|bigday|ceremony|reception|registry|guestbook|expl-sta|expl-ldn|expl-day|expl-eur|playlists|games|faqs|stay|americans|ukraine|atlas)\b/g;
    let hm;
    while((hm = hashRe.exec(text))){
      if(!best || hm.index < best.index){
        const route = hm[1];
        best = {index:hm.index, len:hm[0].length, href:"#"+route, label:CHAT_ROUTES[route] || route};
      }
    }
    if(!best){
      parent.appendChild(document.createTextNode(text));
      return;
    }
    if(best.index > 0) parent.appendChild(document.createTextNode(text.slice(0, best.index)));
    parent.appendChild(makeChatLink(best.href, best.label));
    appendLinkedPlain(parent, text.slice(best.index + best.len));
  }
  function renderBotMessage(text){
    const frag = document.createDocumentFragment();
    const src = String(text || "");
    const md = /\[([^\]]+)\]\((#[\w-]+|https?:\/\/[^)\s]+)\)/g;
    let last = 0, m;
    while((m = md.exec(src))){
      appendLinkedPlain(frag, src.slice(last, m.index));
      frag.appendChild(makeChatLink(m[2], m[1]));
      last = m.index + m[0].length;
    }
    appendLinkedPlain(frag, src.slice(last));
    return frag;
  }
  function setMsgContent(el, text, who){
    el.replaceChildren();
    if(who === "user") el.textContent = text;
    else el.appendChild(renderBotMessage(text));
  }
  function markMsgSource(el, ai){
    if(!el || !el.classList.contains("bot")) return;
    el.classList.remove("msg-ai", "msg-local");
    el.classList.add(ai ? "msg-ai" : "msg-local");
    el.title = ai ? "Answered with Connie AI" : "Answered from saved site notes";
    let mark = el.querySelector(".msg-source");
    if(!mark){
      mark = document.createElement("span");
      mark.className = "msg-source";
      mark.setAttribute("aria-hidden", "true");
      el.appendChild(mark);
    }
    mark.textContent = ai ? "✦" : "·";
  }
  function addMsg(text, who){
    const d = document.createElement("div");
    d.className = "msg "+who;
    setMsgContent(d, text, who);
    log.appendChild(d);
    chatPinBottom = true;
    scrollLogToBottom(true);
    return d;
  }
  async function send(qText){
    if(chatBusy) return;
    const q = (qText !== undefined ? qText : input.value).trim();
    if(!q) return;
    chatBusy = true;
    chatPinBottom = true;
    addMsg(q, "user"); input.value = "";
    input.disabled = true;
    const pending = addMsg("One moment…", "bot");
    pending.classList.add("pending");
    try {
      const got = await connie.reply(q);
      setMsgContent(pending, got.text, "bot");
      markMsgSource(pending, got.ai);
    } catch (e) {
      setMsgContent(pending, answer(q), "bot");
      markMsgSource(pending, false);
    } finally {
      pending.classList.remove("pending");
      chatBusy = false;
      input.disabled = false;
      chatPinBottom = true;
      scrollLogToBottom(true);
      schedulePlaceChatSheet();
      try { input.focus({preventScroll:true}); } catch (e) { try { input.focus(); } catch (e2) {} }
    }
  }
  function isPhoneChat(){
    return window.matchMedia("(max-width:700px), (max-height:500px)").matches;
  }
  function clearChatSheetStyles(){
    panel.style.top = "";
    panel.style.left = "";
    panel.style.right = "";
    panel.style.bottom = "";
    panel.style.width = "";
    panel.style.height = "";
    panel.style.maxHeight = "";
    panel.style.paddingTop = "";
    panel.style.paddingBottom = "";
    panel.style.transform = "";
  }
  let chatScrollY = 0;
  let chatTouchY = 0;
  let chatPinBottom = true; /* stick message log to newest when keyboard resizes */
  let chatPlaceRaf = 0;
  let chatLastVvH = 0;
  function isLogNearBottom(){
    return !log || (log.scrollTop + log.clientHeight >= log.scrollHeight - 56);
  }
  function scrollLogToBottom(force){
    if(!log) return;
    if(force || chatPinBottom) log.scrollTop = log.scrollHeight;
  }
  function placeChatSheet(){
    if(!panel.classList.contains("open")) return;
    const vv = window.visualViewport;
    if(isPhoneChat() && vv){
      /* Fill the visual viewport via height + transform. Do NOT call
         window.scrollTo here — fighting iOS keyboard pan is what glitches
         the page. The opaque veil covers any layout-viewport gap. */
      const x = Math.round(vv.offsetLeft || 0);
      const y = Math.round(vv.offsetTop || 0);
      const w = Math.round(vv.width);
      const h = Math.round(vv.height);
      const heightChanged = h !== chatLastVvH;
      chatLastVvH = h;
      panel.style.top = "0px";
      panel.style.left = "0px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.width = w + "px";
      panel.style.height = h + "px";
      panel.style.maxHeight = "none";
      panel.style.paddingTop = y > 1 ? "0px" : "";
      panel.style.paddingBottom = "0px";
      panel.style.transform = "translate(" + x + "px," + y + "px)";
      if(heightChanged && (chatPinBottom || isLogNearBottom())){
        chatPinBottom = true;
        requestAnimationFrame(()=>scrollLogToBottom(true));
      }
      return;
    }
    if(!vv) return;
    const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    panel.style.bottom = gap ? gap + "px" : "";
    panel.style.maxHeight = Math.min(vv.height * 0.88, vv.height - 12) + "px";
  }
  function schedulePlaceChatSheet(){
    if(chatPlaceRaf) return;
    chatPlaceRaf = requestAnimationFrame(()=>{
      chatPlaceRaf = 0;
      placeChatSheet();
    });
  }
  function onChatTouchStart(e){
    if(!panel.classList.contains("open") || !e.touches || !e.touches.length) return;
    chatTouchY = e.touches[0].clientY;
  }
  function onChatTouchMove(e){
    if(!panel.classList.contains("open") || !e.touches || !e.touches.length) return;
    const t = e.target;
    /* Allow vertical pan only inside the message log; block everything else so
       iOS cannot rubber-band / pan the page underneath the sheet. */
    if(log && (t === log || log.contains(t))){
      const dy = e.touches[0].clientY - chatTouchY;
      const atTop = log.scrollTop <= 0;
      const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 1;
      if((atTop && dy > 0) || (atBottom && dy < 0) || log.scrollHeight <= log.clientHeight){
        e.preventDefault();
      }
      return;
    }
    e.preventDefault();
  }
  function onChatLogScroll(){
    chatPinBottom = isLogNearBottom();
  }
  function onChatComposerFocus(){
    chatPinBottom = true;
    schedulePlaceChatSheet();
    /* Remeasure after the keyboard finishes animating — resize only, no scroll fights */
    setTimeout(schedulePlaceChatSheet, 100);
    setTimeout(()=>{ schedulePlaceChatSheet(); scrollLogToBottom(true); }, 350);
  }
  function onChatComposerBlur(){
    setTimeout(schedulePlaceChatSheet, 100);
    setTimeout(schedulePlaceChatSheet, 350);
  }
  function setChatOpen(on){
    panel.classList.toggle("open", on);
    fab.setAttribute("aria-expanded", on ? "true" : "false");
    /* Keep the veil up on phones too — opaque fill hides any keyboard gap */
    if(veil) veil.classList.toggle("show", on);
    if(on){
      chatScrollY = window.scrollY || 0;
      chatPinBottom = true;
      chatLastVvH = 0;
      document.documentElement.classList.add("chat-open");
      document.body.classList.add("chat-open");
      document.body.style.top = "-" + chatScrollY + "px";
      document.getElementById("chat-nudge").classList.remove("show");
      store.set("km-nudge","seen");
      seedChat();
      placeChatSheet();
      scrollLogToBottom(true);
    } else {
      document.documentElement.classList.remove("chat-open");
      document.body.classList.remove("chat-open");
      document.body.style.top = "";
      clearChatSheetStyles();
      chatLastVvH = 0;
      window.scrollTo(0, chatScrollY);
    }
  }
  function openChat(){ setChatOpen(true); }
  function closeChat(){ setChatOpen(false); }
  function seedChat(){
    if(log.childElementCount) return;
    addMsg("Hello"+(NAME && NAME!=="Guest" ? ", "+NAME : "")+"! I'm Connie 🌸 — your Concierge for Nuptials, Networking, Itineraries & Events. I know this whole website inside out, so ask me anything: trains, hotels, timings, dress codes, the Ukrainian traditions, day trips, even what a 'Spoons' is. When a page helps, I'll drop you a clickable link — try [Stay](#stay), [FAQs](#faqs) or [In-Flight Entertainment](#games).", "bot");
    const chips = document.getElementById("chat-chips");
    /* Short labels so all three fit on one phone row; full question still sent to Connie */
    const starters = TIER==="vinko"
      ? [
          {label:"Vinkopletyny?", q:"What is the Vinkopletyny?"},
          {label:"What to wear?", q:"What should I wear?"},
          {label:"Airport?", q:"Which airport?"}
        ]
      : [
          {label:"Which airport?", q:"Which airport?"},
          {label:"Last trains?", q:"Last trains home?"},
          {label:"What to wear?", q:"What should I wear?"}
        ];
    chips.innerHTML = "";
    starters.forEach(s=>{
      const b = document.createElement("button"); b.type="button"; b.textContent = s.label;
      b.setAttribute("aria-label", s.q);
      b.addEventListener("click", ()=>send(s.q));
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
  /* Desktop: tap outside closes. Phone: veil is only a solid underlay for keyboard gaps. */
  if(veil) veil.addEventListener("click", ()=>{ if(!isPhoneChat()) closeChat(); });
  document.getElementById("chat-send").addEventListener("click", ()=>send());
  input.addEventListener("keydown", e=>{ if(e.key==="Enter") send(); });
  addEventListener("keydown", e=>{
    if(e.key === "Escape" && panel.classList.contains("open")) closeChat();
  });
  log.addEventListener("click", e=>{
    const a = e.target.closest("a.chat-link");
    if(!a || !log.contains(a)) return;
    const href = a.getAttribute("href") || "";
    if(!href.startsWith("#")) return; /* external links open normally */
    e.preventDefault();
    const route = href.slice(1);
    closeChat();
    if(route) location.hash = route;
  });
  if(window.visualViewport){
    visualViewport.addEventListener("resize", schedulePlaceChatSheet);
    visualViewport.addEventListener("scroll", schedulePlaceChatSheet);
  }
  addEventListener("resize", schedulePlaceChatSheet);
  addEventListener("orientationchange", ()=>setTimeout(schedulePlaceChatSheet, 150));
  log.addEventListener("scroll", onChatLogScroll, {passive:true});
  input.addEventListener("focus", onChatComposerFocus);
  input.addEventListener("blur", onChatComposerBlur);
  if(typeof ResizeObserver !== "undefined"){
    const chatLogRo = new ResizeObserver(()=>{
      if(!panel.classList.contains("open")) return;
      if(chatPinBottom) scrollLogToBottom(true);
    });
    chatLogRo.observe(log);
  }
  document.addEventListener("touchstart", onChatTouchStart, {passive:true, capture:true});
  document.addEventListener("touchmove", onChatTouchMove, {passive:false, capture:true});

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
        const tC = Math.round(c.temperature_2m);
        const tF = Math.round(c.temperature_2m * 9/5 + 32);
        const feelC = Math.round(c.apparent_temperature);
        const feelF = Math.round(c.apparent_temperature * 9/5 + 32);
        const minC = Math.round(day.temperature_2m_min[0]);
        const maxC = Math.round(day.temperature_2m_max[0]);
        const minF = Math.round(day.temperature_2m_min[0] * 9/5 + 32);
        const maxF = Math.round(day.temperature_2m_max[0] * 9/5 + 32);
        const rainChance = day.precipitation_probability_max[0];
        let outfit;
        if(tC >= 24)      outfit = "Short sleeves or a summer dress — it's a warm one. Sunscreen advised.";
        else if(tC >= 18) outfit = "Light layers — a cardigan or light jacket over your outfit will do nicely.";
        else if(tC >= 12) outfit = "A proper jacket is a good call. Comfortable closed shoes recommended.";
        else if(tC >= 6)  outfit = "Coat weather. Layer up — a scarf wouldn't go amiss.";
        else              outfit = "Full winter coat and serious layers. Welcome to Britain.";
        if(rainChance >= 60)      outfit += " Rain is likely — bring an umbrella.";
        else if(rainChance >= 35) outfit += " Some rain possible — an umbrella in the bag wouldn't hurt.";
        if(mini) mini.textContent = ico+" "+tC+"°C ("+tF+"°F) · "+txt;
        if(card) card.innerHTML =
          '<div class="wx-big">'+ico+'</div>'+
          '<div><div class="wx-temp">'+tF+'°F ('+tC+'°C)</div>'+
          '<div class="wx-meta">'+txt+' · feels like '+feelF+'°F ('+feelC+'°C) · wind '+Math.round(c.wind_speed_10m)+' km/h</div>'+
          '<div class="wx-meta">Today: '+minF+'–'+maxF+'°F ('+minC+'–'+maxC+'°C) · rain chance '+rainChance+'%</div>'+
          '<div class="wx-outfit">👗 Outfit suggestion: '+outfit+'</div></div>'+
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
  const MAP_COLS = {venue:"#B3945C", sight:"#3D6FD4", pub:"#3A8C54", stay:"#C46A4A", rail:"#2E4080", guest:"#93A8D8", journey:"#B3945C",
                    from:"#B3945C", home:"#A2543F", travel:"#3D6FD4", hm:"#5A8C6A",
                    culture:"#3A8C54", kids:"#C46A4A", food:"#C87D2A", foodie:"#C87D2A", date:"#A2543F",
                    important:"#1C1C1C", shop:"#7D4E9B"};
  
  
  
  
  /* The About Us story map: pins come straight from SETTINGS.storyMap
     (place, coords, category, memory, optional photo). Dotted gold arcs
     are drawn automatically from every "from" pin to the "home" pin. */
  const STORY_PINS = buildStoryPins(SETTINGS.storyMap);
  const STORY_LINES = buildStoryLines(STORY_PINS);
  MAPS = buildMaps(STORY_PINS, STORY_LINES);
  
  const mapRefs = {};
  let mapResizeTimer;
  addEventListener("resize", ()=>{
    clearTimeout(mapResizeTimer);
    mapResizeTimer = setTimeout(()=>{
      Object.values(mapRefs).forEach(m=>{ try{ if(m) m.invalidateSize(); }catch(e){} });
    }, 120);
  });

  /* ---- shared GPS state across all explore maps ---- */
  let gpsWatch = null, gpsLastPos = null;
  const gpsHandlers = []; /* [{map, gpsBtn, locMarker, locCircle}] */

  function gpsApplyPos(h, lat, lng, acc){
    if(!h.locCircle) h.locCircle = L.circle([lat,lng],{radius:acc,color:'#4285F4',fillColor:'#4285F4',fillOpacity:.12,weight:1,interactive:false}).addTo(h.map);
    else h.locCircle.setLatLng([lat,lng]).setRadius(acc);
    if(!h.locMarker){
      h.locMarker = L.circleMarker([lat,lng],{radius:8,color:'#fff',weight:2,fillColor:'#4285F4',fillOpacity:1}).addTo(h.map).bindPopup('You are here');
    } else { h.locMarker.setLatLng([lat,lng]); }
    h.gpsBtn.textContent='📍 Live'; h.gpsBtn.classList.add('gps-active');
  }

  function gpsRemove(h){
    if(h.locMarker){ h.map.removeLayer(h.locMarker); h.locMarker=null; }
    if(h.locCircle){ h.map.removeLayer(h.locCircle); h.locCircle=null; }
    h.gpsBtn.textContent='📍 My location'; h.gpsBtn.classList.remove('gps-active');
  }

  function gpsStartAll(){
    if(!navigator.geolocation) return;
    gpsHandlers.forEach(h=>{ h.gpsBtn.textContent='📍 Locating…'; });
    const firstFix = {done:false};
    gpsWatch = navigator.geolocation.watchPosition(pos=>{
      const {latitude:lat,longitude:lng,accuracy:acc}=pos.coords;
      const isFirst=!firstFix.done; firstFix.done=true;
      gpsLastPos={lat,lng,acc};
      gpsHandlers.forEach(h=>{
        gpsApplyPos(h,lat,lng,acc);
        if(isFirst && h.map.getContainer().offsetParent!==null) h.map.setView([lat,lng],Math.max(h.map.getZoom(),15));
      });
    }, ()=>{
      gpsWatch=null; gpsLastPos=null;
      gpsHandlers.forEach(h=>{ h.gpsBtn.textContent='📍 My location'; h.gpsBtn.classList.remove('gps-active'); });
    },{enableHighAccuracy:true,maximumAge:5000,timeout:10000});
  }

  function gpsStopAll(){
    if(gpsWatch!==null){ navigator.geolocation.clearWatch(gpsWatch); gpsWatch=null; }
    gpsLastPos=null;
    gpsHandlers.forEach(h=>gpsRemove(h));
  }

  function initMapFor(route){
    const cfg = MAPS[route]; if(!cfg) return;
    /* the atlas re-pulls live data every visit so new RSVPs show up */
    if(cfg.atlas && (mapRefs[route]!==undefined)){ try{ atlasCloudRefresh(); }catch(e){} }
    if(mapRefs[route]){ mapRefs[route].invalidateSize(); return; }
    const el = document.getElementById(cfg.el); if(!el) return;
    if(typeof L === "undefined"){
      el.outerHTML = '<p class="note">This map loads when you\'re online — the leaderboard below still works.</p>';
      mapRefs[route] = null;
      if(cfg.atlas) atlasCloudRefresh();
      return;
    }
    const map = L.map(cfg.el,{scrollWheelZoom:false, worldCopyJump:true}).setView(cfg.center, cfg.zoom);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(map);
    (cfg.lines||[]).forEach(pts=>L.polyline(pts,{color:"#B3945C",weight:2,dashArray:"2 8",opacity:.85}).addTo(map));

    /* On phones, one-finger pans steal the page scroll. Ask first. */
    const mapWrap = el.parentElement;
    let unlockMap = ()=>{};
    const touchMap = matchMedia("(hover:none), (pointer:coarse)").matches
      || ((navigator.maxTouchPoints||0) > 0 && matchMedia("(max-width:1024px)").matches);
    if(mapWrap && mapWrap.classList.contains("map-wrap") && touchMap){
      map.dragging.disable();
      mapWrap.classList.add("is-locked");
      let unlockBtn = mapWrap.querySelector(".map-unlock");
      if(!unlockBtn){
        unlockBtn = document.createElement("button");
        unlockBtn.type = "button";
        unlockBtn.className = "map-unlock";
        unlockBtn.textContent = "Tap to explore map";
        mapWrap.appendChild(unlockBtn);
      }
      unlockMap = ()=>{
        if(!mapWrap.classList.contains("is-locked")) return;
        map.dragging.enable();
        mapWrap.classList.remove("is-locked");
      };
      unlockBtn.addEventListener("click", unlockMap);
    }

    /* track markers for category filter + search */
    const allMarkers = [], catMarkers = {};
    function drop(p){
      const photo = (p.img && /^images[_\/][\w.\-]+$/.test(p.img))
        ? "<img src='"+esc(p.img)+"' alt='"+esc(p.n)+"' loading='lazy' onerror='this.remove()' style='width:100%;max-width:220px;margin:.45rem 0 .2rem;border:1px solid #D8D2C2;display:block'>"
        : "";
      const m = L.circleMarker([p.lat,p.lng],{radius:9,color:"#fff",weight:2,fillColor:MAP_COLS[p.cat]||"#6B82B8",fillOpacity:.95})
        .addTo(map)
        .bindPopup("<strong>"+esc(p.n)+"</strong>"+photo+"<br>"+esc(p.d||"")+"<br><a target=_blank rel=noopener href='https://maps.google.com/?q="+encodeURIComponent(p.n)+"'>Google Maps →</a>");
      allMarkers.push({m,p});
      if(!catMarkers[p.cat]) catMarkers[p.cat]=[];
      catMarkers[p.cat].push({m,p});
    }
    cfg.pins.forEach(drop);

    /* explore maps: inject search+GPS toolbar, wire legend filter */
    if(/^expl-/.test(route) && mapWrap){
      const toolbar = document.createElement('div');
      toolbar.className = 'map-toolbar';
      toolbar.innerHTML =
        '<input class="map-search" type="search" placeholder="Search pins…" aria-label="Search map pins">'+
        '<button class="map-gps-btn" type="button" title="Show my location">📍 My location</button>';
      mapWrap.parentElement.insertBefore(toolbar, mapWrap);

      const searchInput = toolbar.querySelector('.map-search');
      const gpsBtn     = toolbar.querySelector('.map-gps-btn');

      function showAll(){ allMarkers.forEach(({m})=>m.setStyle({fillOpacity:.95,opacity:1})); }

      /* legend category filter */
      let activeFilter = null;
      const legendEl = mapWrap.nextElementSibling;
      if(legendEl && legendEl.classList.contains('map-legend')){
        legendEl.querySelectorAll('[data-cat]').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            const cat = btn.dataset.cat;
            searchInput.value = '';
            if(activeFilter===cat){
              activeFilter=null;
              legendEl.querySelectorAll('[data-cat]').forEach(b=>b.classList.remove('lg-active','lg-dim'));
              showAll();
            } else {
              activeFilter=cat;
              legendEl.querySelectorAll('[data-cat]').forEach(b=>{
                b.classList.toggle('lg-active', b.dataset.cat===cat);
                b.classList.toggle('lg-dim',    b.dataset.cat!==cat);
              });
              allMarkers.forEach(({m,p})=>
                m.setStyle(p.cat===cat ? {fillOpacity:.95,opacity:1} : {fillOpacity:.08,opacity:.18})
              );
              catMarkers[cat]&&catMarkers[cat].forEach(({m})=>m.bringToFront());
            }
          });
        });
      }

      /* search */
      searchInput.addEventListener('input', ()=>{
        const q = searchInput.value.trim().toLowerCase();
        if(activeFilter){ activeFilter=null; if(legendEl) legendEl.querySelectorAll('[data-cat]').forEach(b=>b.classList.remove('lg-active','lg-dim')); }
        if(!q){ showAll(); return; }
        const hits = allMarkers.filter(({p})=>p.n.toLowerCase().includes(q)||(p.d&&p.d.toLowerCase().includes(q)));
        allMarkers.forEach(({m})=>m.setStyle({fillOpacity:.08,opacity:.18}));
        hits.forEach(({m})=>{ m.setStyle({fillOpacity:.95,opacity:1}); m.bringToFront(); });
        if(hits.length){ unlockMap(); }
        if(hits.length===1){ map.setView([hits[0].p.lat,hits[0].p.lng],Math.max(map.getZoom(),14)); hits[0].m.openPopup(); }
        else if(hits.length>1){ try{ map.fitBounds(L.featureGroup(hits.map(({m})=>m)).getBounds().pad(.3)); }catch(e){} }
      });

      /* GPS live location — shared across all explore maps */
      const gpsH = {map, gpsBtn, locMarker:null, locCircle:null};
      gpsHandlers.push(gpsH);

      /* if GPS is already live when this map opens, show dot immediately */
      if(gpsWatch!==null && gpsLastPos){
        const {lat,lng,acc}=gpsLastPos;
        gpsApplyPos(gpsH,lat,lng,acc);
        map.setView([lat,lng],Math.max(map.getZoom(),15));
      }

      gpsBtn.addEventListener('click', ()=>{
        if(!navigator.geolocation){ gpsBtn.title='Location unavailable in this browser'; return; }
        if(gpsWatch!==null){ gpsStopAll(); return; }
        unlockMap();
        gpsStartAll();
      });
    }

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
  function haversineKm(a, b){
    const R = 6371, toR = x=>x*Math.PI/180;
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
        const km = haversineKm(ST_ALBANS, {lat:r.lat, lng:r.lng});
        return {name:r.name||"Guests", place, lat:r.lat, lng:r.lng, km};
      })
      .sort((a,b)=>b.km-a.km);

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
                     "<br>"+p.km.toLocaleString()+" km to St Albans");
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
        [i+1, p.name, p.place, p.km.toLocaleString()+" km"].forEach(v=>{
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
            '<label class="rsvp-child"><input type="checkbox" data-gchild'+(g.child?" checked":"")+'> Child</label>'+
            '<label class="rsvp-l">Full name<input type="text" data-gname value="'+esc(g.name||(i===0?document.getElementById("r-name").value:""))+'" placeholder="Name"></label>'+
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
        const _ifd = document.getElementById("rsvp-ifdecline"); if(_ifd) _ifd.style.display = attending==="no" ? "" : "none";
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
      const _ifd2 = document.getElementById("rsvp-ifdecline"); if(_ifd2) _ifd2.style.display = attending==="no" ? "" : "none";
      const extra = (d.details && typeof d.details === "object") ? d.details : {};
      document.getElementById("r-email").value = d.email || "";
      document.getElementById("r-mobile").value = d.mobile || "";
      const rStreet = document.getElementById("r-street"); if(rStreet) rStreet.value = d.street || extra.street || "";
      const rCity = document.getElementById("r-city"); if(rCity) rCity.value = d.city || "";
      const rCountry = document.getElementById("r-country"); if(rCountry) rCountry.value = d.country || "";
      const rPostcode = document.getElementById("r-postcode"); if(rPostcode) rPostcode.value = d.postcode || extra.postcode || "";
      const declineEl = document.getElementById("r-decline-msg");
      if(declineEl) declineEl.value = d.decline_message || extra.decline_message || "";
      if(d.party_size){ sizeSel.value = Math.min(6, Math.max(1, +d.party_size)); }
      buildGuestRows(d.guests || []);                 /* prefill saved guests */
      events.forEach(ev=>{
        const box = evWrap.querySelector('[data-ev="'+ev.k+'"]');
        if(box) box.checked = !!d[ev.k];
      });
      document.getElementById("r-activities").checked = !!d.activities;
      if(actSub) actSub.style.display = !!d.activities ? "" : "none";
      const actInterests = d.activity_interests || extra.activity_interests || "";
      if(actInterests){ String(actInterests).split(",").forEach(v=>{ const c=document.querySelector('[name="r-act-sub"][value="'+v+'"]'); if(c) c.checked=true; }); }
      const travelChkEl = document.getElementById("r-travelafter"); if(travelChkEl) travelChkEl.checked = !!d.travelling_after;
      if(travelSub) travelSub.style.display = !!d.travelling_after ? "" : "none";
      const travelInterests = d.travel_interests || extra.travel_interests || "";
      if(travelInterests){ String(travelInterests).split(",").forEach(v=>{ const c=document.querySelector('[name="r-travel-sub"][value="'+v+'"]'); if(c) c.checked=true; }); }
      showSaved(d);
    }

    buildGuestRows();

    /* activities sub-checkboxes show/hide */
    const actChk = document.getElementById("r-activities");
    const actSub = document.getElementById("r-activities-sub");
    if(actChk && actSub){
      actChk.addEventListener("change", ()=>{ actSub.style.display = actChk.checked ? "" : "none"; });
    }
    /* travel sub-checkboxes show/hide */
    const travelChk = document.getElementById("r-travelafter");
    const travelSub = document.getElementById("r-travelafter-sub");
    if(travelChk && travelSub){
      travelChk.addEventListener("change", ()=>{ travelSub.style.display = travelChk.checked ? "" : "none"; });
    }

    /* Prefer the lead name from the last RSVP saved on this device.
       The gate name is often a nickname, and the sheet is keyed by the
       name typed on the form. Fall back to the gate name if that misses. */
    function rsvpLookupName(){
      return lstore.get("km-rsvp-name") || (NAME && NAME!=="Guest" ? NAME : "");
    }
    function loadForName(){
      const primary = rsvpLookupName();
      if(!CLOUD || !primary) return;
      cloudGet("rsvp", {name: primary}).then(d=>{
        if(d){ applyLoaded(d); return; }
        if(NAME && NAME!=="Guest" && norm(NAME)!==norm(primary))
          return cloudGet("rsvp", {name: NAME}).then(d2=>{ if(d2) applyLoaded(d2); });
      }).catch(()=>{});
    }
    loadForName();

    /* ---- submit ---- */
    document.getElementById("r-submit").addEventListener("click", ()=>{
      const err = document.getElementById("r-err"); err.textContent = "";
      const name = document.getElementById("r-name").value.trim();
      if(!name){ err.textContent = "Please add the lead guest's full name."; return; }
      if(!attending){ err.textContent = "Please let us know if you can make it."; return; }

      const declineMsg = document.getElementById("r-decline-msg");
      const declineNote = attending==="no" && declineMsg ? declineMsg.value.trim() : "";
      const payload = { action:"rsvp", name:name, attending:attending, decline_message: declineNote };
      if(attending === "yes"){
        payload.email = document.getElementById("r-email").value.trim();
        payload.mobile = document.getElementById("r-mobile").value.trim();
        const rStreetEl = document.getElementById("r-street");
        const rCityEl = document.getElementById("r-city");
        const rCountryEl = document.getElementById("r-country");
        const rPostcodeEl = document.getElementById("r-postcode");
        payload.street = rStreetEl ? rStreetEl.value.trim() : "";
        payload.city = rCityEl ? rCityEl.value.trim() : "";
        payload.country = rCountryEl ? rCountryEl.value.trim() : "";
        payload.postcode = rPostcodeEl ? rPostcodeEl.value.trim() : "";
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
        const actSubs = document.querySelectorAll('[name="r-act-sub"]:checked');
        payload.activity_interests = Array.from(actSubs).map(c=>c.value).join(",");
        payload.travelling_after = document.getElementById("r-travelafter").checked;
        const travelSubs = document.querySelectorAll('[name="r-travel-sub"]:checked');
        payload.travel_interests = Array.from(travelSubs).map(c=>c.value).join(",");
        /* The live script stores full_address from `address` and a spare
           JSON blob from `details`. Street and postcode are not columns. */
        payload.address = [payload.street, payload.postcode].filter(Boolean).join(", ");
        payload.details = {
          street: payload.street,
          postcode: payload.postcode,
          activity_interests: payload.activity_interests,
          travel_interests: payload.travel_interests
        };
      } else {
        payload.details = { decline_message: declineNote };
      }

      const btn = document.getElementById("r-submit"); const was = btn.textContent;
      btn.disabled = true; btn.textContent = "Sending…";
      cloudPost(payload)
        .then(()=>{
          lstore.set("km-rsvp-name", name);
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
    ["pre_wedding","ceremony","evening","activities","travelling_after"].forEach(k=>{ o[k]=!!p[k]; });
    return o;
  }
  function rsvpSummaryHtml(d, events){
    if(!d) return "";
    if(d.attending === "no"){
      const note = d.decline_message || (d.details && d.details.decline_message) || "";
      return '<p class="rsvp-summary">You\'ve let us know you sadly can\'t make it. We\'ll miss you — thank you for replying.'+(note ? '<br>'+esc(note) : '')+'</p>';
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

    /* render before-phase photos into the simple before masonry */
    (function(){
      const grid = document.getElementById('gal-masonry-before');
      if (!grid) return;
      grid.innerHTML = '';
      const beforePhotos = gbPhotos.before.filter(it => IMG_OK.test(it.e.img));
      beforePhotos.forEach((it, idx) => {
        const div = document.createElement('div');
        div.className = 'gal-item';
        div.setAttribute('role', 'button');
        div.setAttribute('tabindex', '0');
        const img = document.createElement('img');
        img.alt = it.e.who || '';
        img.loading = 'lazy';
        img.src = it.e.img;
        img.onload = () => img.classList.add('gal-loaded');
        img.onerror = () => div.remove();
        const over = document.createElement('div');
        over.className = 'gal-item-over';
        if (it.e.who) {
          const who = document.createElement('span');
          who.className = 'gal-item-who';
          who.textContent = it.e.who;
          over.appendChild(who);
        }
        div.appendChild(img);
        div.appendChild(over);
        const photos = beforePhotos.map(p => ({ src: p.e.img, who: p.e.who || null, caption: p.e.text || null, cat: null }));
        div.addEventListener('click', () => openGalleryLightbox(photos, idx));
        div.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGalleryLightbox(photos, idx); } });
        grid.appendChild(div);
      });
    })();

    /* update the after-phase masonry gallery */
    const afterPhotos = [
      ...(SETTINGS.galleryPhotos || []),
      ...gbPhotos.after.filter(it => IMG_OK.test(it.e.img)).map(it => ({
        src: it.e.img, who: it.e.who || null, caption: it.e.text || null,
        cat: it.e.cat || 'Guests', local: it.local
      }))
    ];
    refreshGallery(afterPhotos);
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
    const isPrivate = !!(document.getElementById("gb-private") && document.getElementById("gb-private").checked);
    if(!text && !photos.length){ toast("Add a few words or a photo first."); return; }
    if(!text && photos.length) type = "photo";        /* photo-only entries */
    if(isPrivate){
      toast("Saved privately — only we'll see it. You can also email it to us below.");
      document.getElementById("gb-text").value="";
      gbPhotoQueue=[]; document.getElementById("gb-photo").value="";
      document.getElementById("gb-private").checked=false;
      return;
    }

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
        ? '<div class="pl-embed"><iframe src="'+emb+'" loading="lazy" allow="encrypted-media" title="Shared playlist"></iframe></div>'
        : '<div class="pl-embed"><div class="pl-placeholder">The collaborative playlist link goes in SETTINGS.sharedPlaylist —<br>make one in Spotify (⋯ → Invite collaborators) and paste it in.</div></div>';
    }
    const grid = document.getElementById("pl-grid");
    if(grid){
      grid.innerHTML = "";
      (SETTINGS.playlists||[]).forEach(p=>{
        const emb = spotifyEmbed(p.url);
        const wrap = document.createElement("div"); wrap.className = "pl-item";
        if(p.title){ const h = document.createElement("h4"); h.textContent = p.title; wrap.appendChild(h); }
        const d = document.createElement("div"); d.className = "pl-embed";
        d.innerHTML = emb
          ? '<iframe src="'+emb+'" loading="lazy" allow="encrypted-media" title="'+(p.title||'Playlist')+'"></iframe>'
          : '<div class="pl-placeholder"><strong>'+(p.title||'')+'</strong> coming soon — paste a Spotify link into SETTINGS.playlists</div>';
        wrap.appendChild(d);
        if(p.caption){ const c = document.createElement("p"); c.className = "note"; c.textContent = p.caption; wrap.appendChild(c); }
        grid.appendChild(wrap);
      });
    }
  })();
  function songList(){ try{ return JSON.parse(lstore.get("km-songs")||"[]"); }catch(e){ return []; } }
  function songRender(){
    const el = document.getElementById("song-list"); if(!el) return;
    el.innerHTML = ""; songList().forEach(t=>{ const c=document.createElement("span"); c.textContent="🎵 "+t; el.appendChild(c); });
  }
  songRender();
  const songAddBtn = document.getElementById("song-add");
  if(songAddBtn) songAddBtn.addEventListener("click", ()=>{
    const v = document.getElementById("song-in").value.trim(); if(!v) return;
    const l = songList(); l.push(v); lstore.set("km-songs", JSON.stringify(l));
    document.getElementById("song-in").value = ""; songRender(); emojiBurst(["🎵","🎶"],8);
    if(CLOUD){
      cloudPost({action:"song", name: NAME, song: v})
        .then(()=>toast("Request delivered straight to the DJ booth 🎶"))
        .catch(()=>toast("Saved here — we'll try the DJ booth again next time you're online."));
    }
  });
  const songMailBtn = document.getElementById("song-mail");
  if(songMailBtn){
    if(CLOUD){
      songMailBtn.style.display = "none";
      const sn = document.querySelector("#song-list + .devnote, .songchips + .devnote");
      if(sn) sn.textContent = "Requests go straight to us the moment you add them (and stay listed here for your own records). The Macarena clause of the terms and conditions applies.";
    }
    if(SETTINGS.songFormUrl) songMailBtn.textContent = "Submit my requests";
    songMailBtn.addEventListener("click", ()=>{
      const l = songList();
      if(!l.length){ toast("Add a request or two first — the dance floor is counting on you."); return; }
      if(SETTINGS.songFormUrl){
        window.open(SETTINGS.songFormUrl.replace("{song}", encodeURIComponent(l.join("; "))).replace("{name}", encodeURIComponent(NAME)), "_blank", "noopener");
        return;
      }
      location.href = "mailto:"+SETTINGS.contactEmail+"?subject="+encodeURIComponent("Song requests!")+"&body="+encodeURIComponent(l.join("\n"));
    });
  }

  /* ============================================================
     THE BRIDAL PARTY — TOP TRUMPS ✏️ EDIT this list.
     Photos: images_party-1.jpg etc. Stats are 0–100.
     ============================================================ */
  
  (function(){
    const grid = document.getElementById("tp-grid"); if(!grid) return;
    const gridDogs = document.getElementById("tp-grid-dogs");
    PARTY.forEach((m,i)=>{
      const c = document.createElement("button");
      c.type = "button"; c.className = "tp-card";
      c.innerHTML = '<div class="tp-face">'+
        '<span>'+ (m.name||"?").replace("[NAME]","?").charAt(0) +'</span>'+
        '<img src="'+m.img+'" alt="" onerror="this.remove()"></div>'+
        '<div class="tp-role"></div><h4></h4>';
      c.querySelector(".tp-role").textContent = m.role;
      c.querySelector("h4").textContent = m.name;
      c.addEventListener("click", ()=>{
        if(c.hasAttribute("data-tpactive")){ tpDoClose(); return; }
        tpOpen(m, c);
      });
      const isDog = m.role === "Dog of Honour";
      (isDog && gridDogs ? gridDogs : grid).appendChild(c);
    });
  })();
  const tpOv = document.getElementById("tp-overlay");
  function tpDoClose(){
    tpOv.classList.remove("open");
    document.querySelectorAll(".tp-card[data-tpactive]").forEach(b=>b.removeAttribute("data-tpactive"));
  }
  function tpOpen(m, btn){
    document.querySelectorAll(".tp-card[data-tpactive]").forEach(b=>b.removeAttribute("data-tpactive"));
    if(btn) btn.setAttribute("data-tpactive","1");
    document.getElementById("tpb-role").textContent = m.role;
    document.getElementById("tpb-name").textContent = m.name;
    const face = document.getElementById("tpb-face");
    face.innerHTML = '<span>'+(m.name||"?").replace("[NAME]","?").charAt(0)+'</span><img src="'+m.img+'" alt="" onerror="this.remove()">';
    if(m.imgPos){ const fi = face.querySelector("img"); if(fi) fi.style.objectPosition = m.imgPos; }
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
    const p1 = document.createElement("p"); p1.innerHTML = "<strong>Connection:</strong> "; p1.appendChild(document.createTextNode(m.connection)); fx.appendChild(p1);
    if(m.weddingRole){ const p2 = document.createElement("p"); p2.innerHTML = "<strong>Wedding Role:</strong> "; p2.appendChild(document.createTextNode(m.weddingRole)); fx.appendChild(p2); }
    tpOv.classList.add("open");
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      st.querySelectorAll(".fill").forEach(f=>f.style.width = f.dataset.w+"%");
    }));
  }
  document.getElementById("tp-close").addEventListener("click", tpDoClose);
  tpOv.addEventListener("click", e=>{ if(e.target===tpOv) tpDoClose(); });
  addEventListener("keydown", e=>{ if(e.key==="Escape") tpDoClose(); });

  /* ============================================================
     THE RUNAWAY BUS 🚌 (click the bus in the day-of timeline)
     ============================================================ */
  const busEgg = document.getElementById("bus-egg");
  function busGo(){
    const b = document.getElementById("bus-run");
    b.classList.remove("go"); void b.offsetWidth; b.classList.add("go");
    toast("🚌 Beep beep! All aboard for Hatfield House.");
    const hd = document.getElementById("bus-head-emoji");
    if(hd){ hd.classList.remove("honk"); void hd.offsetWidth; hd.classList.add("honk"); hd.addEventListener("animationend",()=>hd.classList.remove("honk"),{once:true}); }
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
      toast("I pledge allegiance to the flag…");
      setTimeout(()=>{
        document.body.classList.remove("patriot");
        modal.classList.add("open");
      }, 1500);
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
        galleryResumed();
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

  /* ---- After-tab photo upload → cloud ---- */
  (function(){
    const fileInput = document.getElementById('gb-upload-file');
    const catSel    = document.getElementById('gb-upload-cat');
    const btn       = document.getElementById('gb-upload-btn');
    const status    = document.getElementById('gb-upload-status');
    if (!btn || !fileInput) return;

    let uploadQueue = [];
    fileInput.addEventListener('change', function(){
      const files = [...(this.files || [])];
      status.textContent = files.length ? files.length + ' photo' + (files.length > 1 ? 's' : '') + ' selected' : '';
      uploadQueue = files;
    });

    btn.addEventListener('click', () => {
      if (!uploadQueue.length) { status.textContent = 'Choose at least one photo first.'; return; }
      if (!CLOUD) { status.textContent = 'Live uploads aren\'t set up yet — email your photos to us instead!'; return; }
      const cat = catSel ? catSel.value : 'Guests';
      const who = (document.getElementById('gb-who') || {}).value || '';
      btn.disabled = true;
      const was = btn.textContent; btn.textContent = 'Uploading…';
      status.textContent = '';
      Promise.all(uploadQueue.slice(0, 20).map(f =>
        shrinkImage(f, 1400, 0.82).then(dataUrl =>
          cloudPost({ action: 'guestbook', who, type: 'photo', text: '', photo: dataUrl, phase: 'after', cat })
        ).catch(() => null)
      )).then(results => {
        const ok = results.filter(Boolean).length;
        status.textContent = ok + ' photo' + (ok !== 1 ? 's' : '') + ' uploaded — they\'ll appear in the gallery shortly!';
        uploadQueue = [];
        fileInput.value = '';
        gbCloudRefresh().catch(() => {});
      }).catch(() => {
        status.textContent = 'Upload failed — check your connection and try again.';
      }).finally(() => {
        btn.disabled = false; btn.textContent = was;
      });
    });
  })();

  /* shared photo albums per category (Guestbook → After the day) */
  (function(){
    const container = document.getElementById("album-slots"); if(!container) return;
    const albums = SETTINGS.photoAlbums || {};
    const cats = [
      { key:"weddingWeek",  label:"Wedding Week" },
      { key:"vinkopletyny", label:"Vinkopletyny" },
      { key:"ceremony",     label:"Ceremony" },
      { key:"reception",    label:"Reception" }
    ];
    container.innerHTML = cats.map(c => {
      const url = albums[c.key];
      return '<div class="album-row"><span class="album-row-label">'+c.label+'</span>'
        + (url
            ? '<a class="btn ghost" style="padding:.35rem .9rem;font-size:.85rem" target="_blank" rel="noopener" href="'+url+'">Open album</a>'
            : '<span style="font-size:.85rem;color:var(--ink-soft)">Link coming soon</span>')
        + '</div>';
    }).join('');
  })();

  /* ---- BTS gallery lightbox ---- */
  (function(){
    const lb      = document.getElementById('bts-lb');
    if (!lb) return;

    /* Move lightbox to body so position:fixed isn't scoped to a .page
       ancestor that carries a CSS transform during the fadeUp animation. */
    if (lb.parentElement !== document.body) document.body.appendChild(lb);

    const lbImg   = document.getElementById('bts-lb-img');
    const lbCap   = document.getElementById('bts-lb-cap');
    const lbCtr   = document.getElementById('bts-lb-counter');
    const closeBtn = document.getElementById('bts-lb-close');
    const prevBtn  = document.getElementById('bts-lb-prev');
    const nextBtn  = document.getElementById('bts-lb-next');
    let btsPhotos = [], btsIdx = 0;

    function btsLbShow(idx) {
      btsIdx = (idx + btsPhotos.length) % btsPhotos.length;
      const p = btsPhotos[btsIdx];
      lbImg.style.opacity = '0';
      lbImg.onload = () => { lbImg.style.opacity = '1'; };
      lbImg.src = p.src;
      if (lbCap) lbCap.textContent = p.caption || '';
      if (lbCtr) lbCtr.textContent = (btsIdx + 1) + ' / ' + btsPhotos.length;
    }
    function btsOpen(photos, idx) {
      btsPhotos = photos; btsIdx = idx;
      btsLbShow(idx);
      const scrollY = window.scrollY;
      document.body.dataset.lbScroll = scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = '-' + scrollY + 'px';
      document.body.style.width = '100%';
      lb.classList.add('open');
    }
    function btsClose() {
      lb.classList.remove('open');
      const scrollY = parseFloat(document.body.dataset.lbScroll || '0');
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    }

    closeBtn && closeBtn.addEventListener('click', btsClose);
    prevBtn  && prevBtn.addEventListener('click',  () => btsLbShow(btsIdx - 1));
    nextBtn  && nextBtn.addEventListener('click',  () => btsLbShow(btsIdx + 1));
    lb.addEventListener('click', e => { if (e.target === lb) btsClose(); });
    document.addEventListener('keydown', e => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') btsClose();
      else if (e.key === 'ArrowLeft') btsLbShow(btsIdx - 1);
      else if (e.key === 'ArrowRight') btsLbShow(btsIdx + 1);
    });

    /* Wire tiles — IntersectionObserver lazy loads data-src images with a
       300px pre-load buffer and fade-in, matching the main gallery approach. */
    function wireGrid(gridId) {
      const grid = document.getElementById(gridId);
      if (!grid) return;
      const tiles = [...grid.querySelectorAll('.bts-tile')];

      /* Capture src paths upfront for the lightbox */
      const photos = tiles.map(t => {
        const img = t.querySelector('img');
        return { src: (img && img.getAttribute('src')) || '', caption: t.dataset.caption || '' };
      });

      /* Wire fade-in: images start opacity:0 (CSS); add .bts-loaded when loaded */
      tiles.forEach((tile, i) => {
        const img = tile.querySelector('img');
        if (img) {
          if (img.complete && img.naturalWidth) {
            img.classList.add('bts-loaded');
          } else {
            img.addEventListener('load', () => img.classList.add('bts-loaded'), { once: true });
          }
        }
        tile.addEventListener('click', () => btsOpen(photos, i));
      });
    }
    wireGrid('bts-eng-grid');
    wireGrid('bts-plan-grid');
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
  function xwAt(r, c){ return xwCells[r+","+c] || null; }
  function xwStep(r, c, dr, dc){
    for(let i=0;i<XW_R+XW_C;i++){
      r += dr; c += dc;
      const hit = xwAt(r, c);
      if(hit) return hit;
    }
    return null;
  }
  function xwNext(r, c){
    c++;
    while(r < XW_R){
      const hit = xwAt(r, c);
      if(hit) return hit;
      c++;
      if(c >= XW_C){ c = 0; r++; }
    }
    return null;
  }
  function xwPrev(r, c){
    c--;
    while(r >= 0){
      const hit = xwAt(r, c);
      if(hit) return hit;
      c--;
      if(c < 0){ c = XW_C-1; r--; }
    }
    return null;
  }
  function xwEnsure(inp){
    const wrap = inp.closest(".xw-wrap");
    const cell = inp.parentElement;
    if(wrap && cell){
      const cr = cell.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      if(cr.left < wr.left + 8 || cr.right > wr.right - 8){
        wrap.scrollLeft += (cr.left + cr.width/2) - (wr.left + wr.width/2);
      }
    }
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const box = inp.getBoundingClientRect();
    if(box.bottom > vh - 12 || box.top < 64) inp.scrollIntoView({block:"center", inline:"nearest"});
  }
  function xwInit(){
    const grid = document.getElementById("xw"); if(!grid || grid.childElementCount) return;
    const used = {}, nums = {};
    XW_WORDS.forEach(w=>{ xwEach(w,(r,c)=>{ used[r+","+c]=true; }); nums[w.r+","+w.c] = w.n; });
    let saved = {}; try{ saved = JSON.parse(lstore.get("km-xw")||"{}"); }catch(e){}
    for(let r=0;r<XW_R;r++) for(let c=0;c<XW_C;c++){
      const cell = document.createElement("div");
      cell.className = "xc" + (used[r+","+c] ? "" : " blk");
      if(used[r+","+c]){
        if(nums[r+","+c]){ const n=document.createElement("span"); n.className="xn"; n.textContent=nums[r+","+c]; cell.appendChild(n); }
        const inp = document.createElement("input");
        inp.maxLength = 1; inp.autocomplete="off"; inp.inputMode = "text"; inp.autocapitalize = "characters";
        inp.setAttribute("aria-label","crossword cell");
        inp.dataset.r = r; inp.dataset.c = c;
        inp.value = saved[r+","+c] || "";
        inp.addEventListener("focus", ()=>xwEnsure(inp));
        inp.addEventListener("keydown", e=>{
          const rr = +inp.dataset.r, cc = +inp.dataset.c;
          const step = {ArrowLeft:[0,-1], ArrowRight:[0,1], ArrowUp:[-1,0], ArrowDown:[1,0]}[e.key];
          if(step){
            e.preventDefault();
            const nxt = xwStep(rr, cc, step[0], step[1]);
            if(nxt){ nxt.focus(); xwEnsure(nxt); }
          } else if(e.key === "Backspace" && !inp.value){
            const prev = xwPrev(rr, cc);
            if(prev){ e.preventDefault(); prev.focus(); xwEnsure(prev); }
          }
        });
        inp.addEventListener("input", ()=>{
          inp.value = inp.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,1);
          cell.classList.remove("ok","bad");
          saved[r+","+c] = inp.value; lstore.set("km-xw", JSON.stringify(saved));
          if(inp.value){
            const nxt = xwNext(+inp.dataset.r, +inp.dataset.c);
            if(nxt){ nxt.focus(); xwEnsure(nxt); }
          }
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
    /* down ducks under a flying bouquet and fast-falls; it must not scroll the page */
    let ducking=false, duckHeld=false, view="2d", k3=null;
    /* responsiveness + level machinery:
       grace    — frames left in the obstacle-free level intro
       banner   — the "LEVEL N · NAME" card drawn on the canvas
       jumpBuf  — a press just before landing still jumps (input buffer)
       spawnIn  — frames until the next obstacle (delta-time safe)     */
    let grace=0, banner=null, jumpBuf=0, spawnIn=0, lastT=0;
    /* rings are distance bonuses; level pace stays on the metres you actually run */
    let gems=[], bonus=0, rings=0, streak=0, charm=0, milestone=0, bestSung=false;
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
      let w = k==="cake" ? 46 : k==="envelope" ? 52 : k==="flute" ? 18 : k==="wreath" ? 40 : k==="gift" ? 34 : 34;
      let h = k==="flute" ? 52 : k==="cake" ? 48 : k==="wreath" ? 40 : 34;
      let foot = 0;
      /* a tossed bouquet clears a duck and still catches a standing jump */
      if(k==="hyd" && Math.random() < 0.58){ foot = 26; h = 30; w = 36; }
      obs.push({k, x: W+20, w, h, foot});
      /* two more hydrangeas stacked above a flying one — forces a duck */
      if(foot === 26){ obs.push({k, x: W+20, w, h, foot: foot + h}); obs.push({k, x: W+20, w, h, foot: foot + h*2}); }
      /* a spare ring just past the obstacle, or a rare glowing barvinok */
      if(Math.random() < 0.08) gems.push({k:"charm", x: W+96, y: GY - (62 + Math.random()*36)});
      else if(Math.random() < 0.55) gems.push({k:"ring", x: W+64 + Math.random()*36, y: GY - (62 + Math.random()*36)});
    }
    function shown(){ return score + bonus; }
    function cheers(text){
      const host = document.getElementById("kd-cheers");
      if(!host || !text) return;
      const el = document.createElement("span");
      el.className = "kd-cheer";
      el.textContent = text;
      host.appendChild(el);
      while(host.children.length > 3) host.firstChild.remove();
      setTimeout(()=>{ el.remove(); }, 1200);
    }
    function paintGems(info){
      const g = document.getElementById("kd-gems");
      if(!g) return;
      const n = info && info.rings || 0;
      const on = !!(info && info.charm);
      g.hidden = !n && !on;
      g.classList.toggle("is-charm", on);
      g.textContent = on ? (n ? "✦ "+n+" · BARVINOK" : "✦ BARVINOK") : ("✦ "+n);
    }
    function award(n, label){ bonus += n; cheers(label); }
    function noteBest(metres){
      if(!(best > 0) || metres <= best) return;
      if(!bestSung){ bestSung = true; cheers("New best"); }
      document.getElementById("kd-best").textContent = String(metres).padStart(3,"0");
    }
    function syncTheme(){
      const w = document.getElementById("dash-canvas-wrap");
      if(!w || view === "3d") return;
      if(level === 3) w.dataset.kdTheme = "night";
      else delete w.dataset.kdTheme;
    }
    function drawGem(g){
      const bob = Math.sin((frame + g.x) / 8) * 3;
      cx.save(); cx.translate(g.x, g.y + bob);
      if(g.k === "charm"){
        cx.fillStyle = "rgba(147,168,216,.35)";
        cx.beginPath(); cx.arc(0, 0, 16, 0, 7); cx.fill();
        cx.fillStyle = "#93A8D8";
        [[0,0],[7,-4],[-6,-3],[2,7],[-5,5]].forEach(([px,py])=>{ cx.beginPath(); cx.arc(px,py,4,0,7); cx.fill(); });
      } else {
        cx.strokeStyle = "#C6A15A"; cx.lineWidth = 2.4;
        cx.beginPath(); cx.arc(0, 0, 7, 0, 7); cx.stroke();
        cx.fillStyle = "#F4C64D";
        cx.beginPath(); cx.arc(-2, -3, 1.3, 0, 7); cx.fill();
      }
      cx.restore();
    }
    /* ---- Kiko: a small black-and-white Japanese Chin ----------- */
    function drawKiko(){
      const x = 70, y = ky;
      cx.save(); cx.translate(x, y);
      if(charm > 0){
        const pulse = 0.55 + 0.45 * Math.sin(frame / 2.2);
        cx.save();
        cx.globalCompositeOperation = "lighter";
        cx.fillStyle = `rgba(244,198,77,${0.18 + pulse * 0.16})`;
        cx.beginPath(); cx.ellipse(2, -18, 46, 38, 0, 0, 7); cx.fill();
        cx.fillStyle = `rgba(147,168,216,${0.22 + pulse * 0.2})`;
        cx.beginPath(); cx.ellipse(2, -18, 34, 28, 0, 0, 7); cx.fill();
        cx.strokeStyle = "#F4C64D"; cx.lineWidth = 3;
        cx.globalAlpha = 0.55 + pulse * 0.4;
        cx.beginPath(); cx.ellipse(2, -18, 40 + pulse * 4, 32 + pulse * 3, 0, 0, 7); cx.stroke();
        cx.strokeStyle = "#93A8D8"; cx.lineWidth = 2;
        cx.beginPath(); cx.ellipse(2, -18, 28 + pulse * 3, 22 + pulse * 2, 0, 0, 7); cx.stroke();
        cx.restore();
        cx.save();
        cx.fillStyle = level === 3 ? "#F4C64D" : "#8A6F3F";
        cx.font = "bold 11px Georgia"; cx.textAlign = "center";
        cx.globalAlpha = 0.75 + pulse * 0.25;
        cx.fillText("BARVINOK", 2, -52 - pulse * 3);
        cx.restore();
      }
      if(ducking && ky >= GY-0.5) cx.scale(1.14, 0.58);
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
      if(o.foot){
        cx.save();
        cx.fillStyle = level===3 ? "rgba(244,198,77,.2)" : "rgba(65,80,122,.16)";
        cx.beginPath(); cx.ellipse(o.x+o.w*0.45, GY+3, Math.max(8, o.w*0.28), 3.2, 0, 0, 7); cx.fill();
        cx.restore();
      }
      cx.save(); cx.translate(o.x, GY - (o.foot||0));
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
      grace = GRACE_FRAMES; obs = []; gems = []; spawnIn = 20;
      syncTheme();
    }
    function doJump(){ kvy = -10.8; jumpBuf = 0; }
    function press(){
      if(over){ reset(); return; }
      if(!run){ run = true; enterLevel(0); return; }
      if(ky >= GY-0.5) doJump();
      else jumpBuf = 7;                                   /* buffer a press made just before landing */
    }
    function release(){ if(kvy < -4.2) kvy = -4.2; }      /* let go early = a shorter hop */
    /* Down cuts a rising jump and, on the ground, flattens her under bouquets. */
    function setDuck(on){
      const next = !!on;
      if(next && !ducking && kvy < -3) kvy = -3;
      ducking = next;
      if(!run) paint();
    }
    function reset(){ run=false; over=false; frame=0; speed=4.4; score=0; obs=[]; gems=[]; ky=GY; kvy=0;
      grace=0; banner=null; jumpBuf=0; spawnIn=0; ducking = duckHeld;
      bonus=0; rings=0; streak=0; charm=0; milestone=0; bestSung=false;
      level=0; document.getElementById("kd-level").textContent = "LVL 1 · ST ALBANS";
      const wrapEl = document.getElementById("dash-canvas-wrap");
      if(wrapEl && view === "2d") wrapEl.classList.remove("is-charmed");
      paintGems(null); syncTheme(); paint(); }
    function recordScore(finalScore){
      const s = finalScore|0;
      if(s > best){ best = s; lstore.set("km-kd-best", best); document.getElementById("kd-best").textContent = String(best).padStart(3,"0"); }
      const board = lb(); board.push({n: NAME, s: s});
      board.sort((a,b)=>b.s-a.s); lstore.set("km-kd-lb", JSON.stringify(board.slice(0,5))); lbRender();
      kdCloudSubmit(s);
      toast(s>60 ? "Kiko made it "+s+"m with the rings! 🏆" : "Kiko tripped at "+s+"m. The rings are fine. Probably.");
    }
    function gameOver(){
      run=false; over=true;
      recordScore(shown());
    }
    function paint(){
      cx.clearRect(0,0,W,H);
      drawScene();
      obs.forEach(drawObs); gems.forEach(drawGem); drawKiko();
      cx.fillStyle = level===3 ? "#C9D2F0" : "#5B6788"; cx.font="12px Georgia"; cx.textAlign="left";
      if(!run && !over) cx.fillText("Jump the admin · catch the rings · down ducks.", 16, 24);
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
        const extra = rings ? " · ✦ "+rings : "";
        cx.fillText("Paws. "+shown()+"m"+extra+" — tap to try again", W/2, 90); }
    }
    function loop(now){
      /* delta-time physics: the game runs at the SAME speed on 60Hz
         laptops and 120Hz phones, and inputs land the frame they occur */
      if(view !== "2d"){ lastT = now; requestAnimationFrame(loop); return; }
      const dt = lastT ? Math.min(2.6, (now - lastT) / 16.667) : 1;
      lastT = now;
      if(run){
        frame += dt;
        if(grace > 0){ grace -= dt; }
        else {
          spawnIn -= dt;
          if(spawnIn <= 0 || (obs.length===0 && frame>30)){
            spawn();
            spawnIn = Math.max(38, 100 - Math.floor(score/5)) * (0.8 + Math.random()*0.45);
          }
        }
        if(banner){ banner.t -= dt; if(banner.t <= 0) banner = null; }
        speed = 4.4 + score/50;
        const falling = ducking && ky < GY-1 && kvy > 0;
        kvy += (falling ? 1.45 : 0.58)*dt; ky = Math.min(GY, ky + kvy*dt);
        if(jumpBuf > 0){ jumpBuf -= dt; if(ky >= GY-0.5) doJump(); }
        if(charm > 0) charm -= dt;
        obs.forEach(o=>o.x -= speed*dt);
        gems.forEach(g=>g.x -= speed*dt);
        obs = obs.filter(o=>o.x > -80);
        const duckedNow = ducking && ky >= GY-0.8;
        const chestY = ky - (duckedNow ? 10 : 24);
        for(const g of gems){
          if(g.got) continue;
          if(Math.abs(g.x - 70) < 26 && Math.abs(g.y - chestY) < 30){
            g.got = true;
            if(g.k === "charm"){ charm = 145; award(12, "Barvinok"); }
            else {
              rings++; streak++;
              if(streak >= 5){ streak = 0; award(24, "The set!"); }
              else award(8, "✦ +8");
            }
          } else if(g.k === "ring" && g.x < 48 && !g.missed){
            g.missed = true; streak = 0;
          }
        }
        gems = gems.filter(g => g.x > -40 && !g.got);
        score = Math.floor(frame/6);
        const lv = levelFor(score);
        if(lv !== level) enterLevel(lv);                  /* new scene, new card, safe stretch */
        const mark = Math.floor(score / 100) * 100;
        if(mark >= 100 && mark > milestone){ milestone = mark; cheers(mark + " m"); }
        if(grace <= 0 && charm <= 0){
          const ducked = duckedNow;
          const kikoH = ducked ? 17 : 40;
          const kikoTop = ky - kikoH;
          for(const o of obs){
            const obsBottom = GY - (o.foot||0);
            const obsTop = obsBottom - o.h;
            const xHit = 70+12 > o.x+5 && 70-12 < o.x+o.w-5;
            const yHit = ky > obsTop + 4 && kikoTop < obsBottom - 2;
            if(xHit && yHit){ gameOver(); break; }
            if(xHit && !o.near){
              const closeOver = ky <= obsTop + 4 && ky >= obsTop - 16;
              const closeUnder = (o.foot||0) > 0 && kikoTop >= obsBottom - 2 && kikoTop <= obsBottom + 16;
              if(closeOver || closeUnder){ o.near = true; award(5, "Close!"); }
            }
          }
        }
        const metres = shown();
        document.getElementById("kd-score").textContent = String(metres).padStart(3,"0")+" m";
        paintGems({rings, charm: charm > 0});
        noteBest(metres);
        const wrapEl = document.getElementById("dash-canvas-wrap");
        if(wrapEl && view === "2d") wrapEl.classList.toggle("is-charmed", charm > 0);
        paint();
      }
      requestAnimationFrame(loop);
    }
    paint(); requestAnimationFrame(loop);
    function gamePlaying(){
      if(view==="3d") return !!(k3 && k3.playing());
      return run && !over;
    }
    function doPress(){ if(view==="3d" && k3) k3.jumpPress(); else press(); }
    function doRelease(){ if(view==="3d" && k3) k3.jumpRelease(); else release(); }
    function doDuck(on){ if(view==="3d" && k3) k3.setDuck(on); else setDuck(on); }
    const modeBtn = document.getElementById("kd-3d");
    const modeBtnFs = document.getElementById("kd-3d-fs");
    const wrap = document.getElementById("dash-canvas-wrap");
    const tapBtn = document.getElementById("kd-tap");
    const exitBtn = document.getElementById("kd-exit");
    const jumpBtn = document.getElementById("kd-jump");
    const duckBtn = document.getElementById("kd-duck");
    const phonePlay = ()=> matchMedia("(max-width:700px), (hover: none) and (pointer: coarse)").matches;
    let fsOn = false;
    function setModeUi(pressed, label, disabled){
      [modeBtn, modeBtnFs].forEach(btn=>{
        if(!btn) return;
        btn.setAttribute("aria-pressed", pressed ? "true" : "false");
        btn.textContent = label;
        btn.disabled = !!disabled;
      });
    }
    let fsMarker = null;
    let hudMarker = null;
    let fsLock = false;
    let labelTimer = 0;
    let fsTapSpent = false;
    const hudEl = document.querySelector("#page-games .kd-hud");
    const gateEl = document.getElementById("kd-gate");
    const gateKicker = document.getElementById("kd-gate-kicker");
    const gateTitle = document.getElementById("kd-gate-title");
    const gateNote = document.getElementById("kd-gate-note");
    function nativeFsEl(){
      return document.fullscreenElement || document.webkitFullscreenElement || null;
    }
    function isPortrait(){
      /* Prefer geometry over orientation MQ — Safari chrome changes fool matchMedia mid-rotate */
      return window.innerHeight >= window.innerWidth;
    }
    function looksImmersive(){
      /* Safari can keep fullscreenElement set while toolbars reclaim the viewport after rotate */
      if(!nativeFsEl()) return false;
      const vv = window.visualViewport;
      if(!vv) return true;
      const viewMin = Math.min(vv.width, vv.height);
      const viewMax = Math.max(vv.width, vv.height);
      const screenMin = Math.min(screen.width, screen.height);
      const screenMax = Math.max(screen.width, screen.height);
      return viewMin >= screenMin * 0.86 && viewMax >= screenMax * 0.88;
    }
    function fsReq(el){
      if(!el) return null;
      return el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen || null;
    }
    function requestNativeFs(){
      /* Sync call in the tap turn — Safari ignores deferred fullscreen requests */
      const targets = [wrap, document.documentElement, document.body].filter(Boolean);
      for(const el of targets){
        const req = fsReq(el);
        if(!req) continue;
        try{
          const out = req.call(el, { navigationUI: "hide" });
          return Promise.resolve(out).then(()=>looksImmersive()).catch(()=>false);
        }catch(err){ /* try next */ }
      }
      return Promise.resolve(looksImmersive());
    }
    function leaveNativeFs(){
      const cur = nativeFsEl();
      if(!cur) return Promise.resolve();
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
      if(!exit) return Promise.resolve();
      try{ return Promise.resolve(exit.call(document)).catch(()=>{}); }
      catch(err){ return Promise.resolve(); }
    }
    function lockLandscape(){
      try{
        const o = screen.orientation;
        if(o && o.lock) return Promise.resolve(o.lock("landscape")).catch(()=>{});
      }catch(err){}
      return Promise.resolve();
    }
    function unlockOrientation(){
      try{
        const o = screen.orientation;
        if(o && o.unlock) o.unlock();
      }catch(err){}
    }
    let lastVvArea = 0;
    function syncGate(){
      if(!wrap || !fsOn) return;
      const portrait = isPortrait();
      const immersive = looksImmersive();
      const vv = window.visualViewport;
      const area = vv ? vv.width * vv.height : 0;
      /* Re-arm reclaim when Safari chrome eats the viewport again (often without a fullscreenchange). */
      if(area && lastVvArea && area < lastVvArea * 0.94) fsTapSpent = false;
      if(area) lastVvArea = area;
      if(portrait || immersive) fsTapSpent = false;
      /* Portrait always gated. Landscape: show until immersive, or until one tap has been tried. */
      const need = portrait || (!immersive && !fsTapSpent);
      wrap.classList.toggle("is-portrait", portrait);
      wrap.classList.toggle("need-gate", need);
      if(gateEl) gateEl.hidden = !need;
      if(gateKicker && gateTitle && gateNote){
        if(portrait){
          gateKicker.textContent = "Landscape";
          gateTitle.textContent = "Turn your phone sideways";
          gateNote.textContent = "Then tap for full screen";
        } else {
          gateKicker.textContent = "Full screen";
          gateTitle.textContent = "Tap for full screen";
          gateNote.textContent = "Hides Safari’s search bar and tabs";
        }
      }
      if(portrait){
        duckHeld = false;
        doDuck(false);
      }
    }
    function gateTap(){
      if(!fsOn) return;
      if(isPortrait()){
        syncGate();
        return;
      }
      /* Must request fullscreen in this same gesture — then allow play even if Safari keeps a sliver of chrome */
      requestNativeFs().then(()=>lockLandscape()).then(()=>{
        fsTapSpent = true;
        syncGate();
      });
    }
    function ensureFsFromGesture(){
      if(fsOn && !isPortrait() && !looksImmersive() && !fsTapSpent) gateTap();
    }
    function flashFsLabels(){
      if(!wrap) return;
      wrap.classList.remove("show-fs-labels");
      void wrap.offsetWidth;
      wrap.classList.add("show-fs-labels");
      clearTimeout(labelTimer);
      labelTimer = setTimeout(()=>{ wrap.classList.remove("show-fs-labels"); }, 1300);
    }
    function enterFs(){
      if(!wrap || fsOn || fsLock) return;
      fsOn = true;
      fsTapSpent = false;
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      document.body.dataset.kdScroll = String(y);
      document.documentElement.classList.add("kd-fs");
      document.body.classList.add("kd-fs");
      if(!fsMarker){
        fsMarker = document.createComment("kd-fs");
        wrap.parentNode.insertBefore(fsMarker, wrap);
      }
      document.body.appendChild(wrap);
      wrap.classList.add("is-fs");
      if(hudEl && hudEl.parentNode !== wrap){
        if(!hudMarker){
          hudMarker = document.createComment("kd-hud");
          hudEl.parentNode.insertBefore(hudMarker, hudEl);
        }
        wrap.appendChild(hudEl);
      }
      document.body.classList.toggle("kd-view-3d", view === "3d");
      wrap.classList.toggle("is-3d-hud", view === "3d");
      /* Native FS only from the landscape gate tap — premature FS drops on rotate and hid the reclaim UI */
      syncGate();
      flashFsLabels();
      if(k3 && view === "3d") k3.show();
    }
    function exitFs(){
      if(!fsOn || fsLock) return;
      fsLock = true;
      fsOn = false;
      clearTimeout(labelTimer);
      wrap.classList.remove("is-fs", "is-3d-hud", "is-portrait", "show-fs-labels", "need-gate");
      fsTapSpent = false;
      if(gateEl) gateEl.hidden = true;
      if(hudEl && hudMarker && hudMarker.parentNode) hudMarker.parentNode.insertBefore(hudEl, hudMarker);
      if(fsMarker && fsMarker.parentNode) fsMarker.parentNode.insertBefore(wrap, fsMarker);
      document.documentElement.classList.remove("kd-fs");
      document.body.classList.remove("kd-fs", "kd-view-3d");
      const y = parseFloat(document.body.dataset.kdScroll || "0") || 0;
      delete document.body.dataset.kdScroll;
      window.scrollTo(0, y);
      duckHeld = false;
      doDuck(false);
      if(jumpBtn) jumpBtn.classList.remove("is-held");
      if(duckBtn) duckBtn.classList.remove("is-held");
      unlockOrientation();
      leaveNativeFs().finally(()=>{ fsLock = false; });
    }
    addEventListener("resize", ()=>{ if(fsOn) syncGate(); });
    addEventListener("orientationchange", ()=>{
      fsTapSpent = false;
      setTimeout(syncGate, 80);
      setTimeout(syncGate, 350);
    });
    if(window.visualViewport){
      visualViewport.addEventListener("resize", ()=>{ if(fsOn) syncGate(); });
      visualViewport.addEventListener("scroll", ()=>{ if(fsOn) syncGate(); });
    }
    function onNativeFsChange(){
      if(fsLock || !fsOn) return;
      if(!looksImmersive()) fsTapSpent = false;
      syncGate();
    }
    addEventListener("fullscreenchange", onNativeFsChange);
    addEventListener("webkitfullscreenchange", onNativeFsChange);
    if(gateEl){
      gateEl.addEventListener("pointerdown", e=>{
        e.preventDefault();
        e.stopPropagation();
        gateTap();
      });
      gateEl.addEventListener("click", e=>{
        e.preventDefault();
        e.stopPropagation();
        gateTap();
      });
    }
    function holdBtn(btn, down, up){
      if(!btn) return;
      let held = false;
      const start = (e)=>{
        e.preventDefault();
        e.stopPropagation();
        ensureFsFromGesture();
        if(held) return;
        held = true;
        btn.classList.add("is-held");
        try{ btn.setPointerCapture(e.pointerId); }catch(err){}
        down();
      };
      const end = (e)=>{
        if(!held) return;
        held = false;
        btn.classList.remove("is-held");
        if(e && e.preventDefault) e.preventDefault();
        up();
      };
      btn.addEventListener("pointerdown", start);
      btn.addEventListener("pointerup", end);
      btn.addEventListener("pointercancel", end);
      btn.addEventListener("lostpointercapture", end);
    }
    cv.addEventListener("pointerdown", e=>{
      if(phonePlay() && !fsOn) return;
      e.preventDefault();
      ensureFsFromGesture();
      doPress();
    });
    cv.addEventListener("pointerup", e=>{
      if(phonePlay() && !fsOn) return;
      e.preventDefault();
      doRelease();
    });
    cv.addEventListener("pointercancel", ()=>{ if(!(phonePlay() && !fsOn)) doRelease(); });
    if(tapBtn) tapBtn.addEventListener("click", e=>{ e.preventDefault(); enterFs(); });
    if(exitBtn) exitBtn.addEventListener("click", e=>{ e.preventDefault(); exitFs(); });
    holdBtn(jumpBtn, doPress, doRelease);
    holdBtn(duckBtn, ()=>doDuck(true), ()=>doDuck(false));
    function refresh2dHud(){
      document.getElementById("kd-level").textContent = "LVL "+(level+1)+" · "+LEVELS[level].name;
      document.getElementById("kd-score").textContent = String(shown()).padStart(3,"0")+" m";
      paintGems({rings, charm: charm > 0});
      syncTheme();
    }
    let loading3d = false;
    async function toggle3d(){
      if(!wrap || loading3d) return;
      if(view==="2d"){
        view = "3d";
        wrap.classList.add("is-3d");
        document.body.classList.toggle("kd-view-3d", fsOn);
        wrap.classList.toggle("is-3d-hud", fsOn);
        setModeUi(true, "Classic mode", false);
        if(!k3){
          loading3d = true;
          setModeUi(true, "Loading 3D…", true);
          try{
            const mod = await import("./games/kiko-dash-3d.js");
            k3 = mod.createKiko3D(wrap, {
              onScore(s, info){
                document.getElementById("kd-score").textContent = String(s).padStart(3,"0")+" m";
                paintGems(info);
              },
              onLevel(i, name){ document.getElementById("kd-level").textContent = "LVL "+(i+1)+" · "+name; },
              onCheer: cheers,
              onBest(s){ document.getElementById("kd-best").textContent = String(s).padStart(3,"0"); },
              best(){ return best; },
              onFinish(s){ recordScore(s); },
              onError(){ toast("3D mode couldn't start on this device."); }
            });
          }catch(err){
            console.error(err);
            view = "2d";
            wrap.classList.remove("is-3d", "is-3d-hud");
            document.body.classList.remove("kd-view-3d");
            setModeUi(false, "3D mode", false);
            toast("3D mode couldn't start on this device.");
            return;
          }finally{
            loading3d = false;
            setModeUi(view==="3d", view==="3d" ? "Classic mode" : "3D mode", false);
          }
          if(view !== "3d" || !k3) return;
        }
        if(view==="3d") k3.show();
      } else {
        view = "2d";
        wrap.classList.remove("is-3d");
        document.body.classList.remove("kd-view-3d");
        wrap.classList.remove("is-3d-hud");
        setModeUi(false, "3D mode", false);
        if(k3) k3.hide();
        refresh2dHud();
        paint();
      }
    }
    if(modeBtn) modeBtn.addEventListener("click", ()=>{ toggle3d(); });
    if(modeBtnFs) modeBtnFs.addEventListener("click", e=>{ e.preventDefault(); e.stopPropagation(); toggle3d(); });
    onGamesVisibility = (on)=>{
      if(!on) exitFs();
      if(!k3) return;
      if(on && view==="3d") k3.show();
      else k3.hide();
    };
    addEventListener("keydown", e=>{
      const gamesOn = document.getElementById("page-games").classList.contains("visible");
      if(!gamesOn) return;
      const ae = document.activeElement;
      const typing = ae && (ae.tagName==="INPUT" || ae.tagName==="TEXTAREA" || ae.tagName==="SELECT" || ae.isContentEditable);
      if(typing) return;                                 /* not while in the crossword */
      if(e.key==="Escape" && fsOn){ e.preventDefault(); exitFs(); return; }
      if(e.key===" "||e.key==="ArrowUp"){
        e.preventDefault();
        if(!e.repeat) doPress();
      } else if(e.key==="ArrowDown"){
        /* On this page Down is for Kiko — never let it scroll, even after a crash. */
        e.preventDefault();
        if(!duckHeld){ duckHeld = true; doDuck(true); }
      }
    }, true);
    addEventListener("keyup", e=>{
      const gamesOn = document.getElementById("page-games").classList.contains("visible");
      if(!gamesOn) return;
      if(e.key===" "||e.key==="ArrowUp") doRelease();
      if(e.key==="ArrowDown"){ duckHeld = false; doDuck(false); }
    }, true);
    /* live cloud leaderboard: personal bests submit themselves */
    function kdCloudSubmit(finalScore){
      const s = finalScore == null ? score : finalScore;
      if(!CLOUD || !s || NAME==="Guest") return;
      const sent = +(lstore.get("km-kd-sent")||0);
      if(s <= sent) return;
      cloudPost({action:"score", name: NAME, score: s})
        .then(()=>{ lstore.set("km-kd-sent", s); kdLiveBoard(); })
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

  /* ---- Background-preload BTS photos while user browses other pages ---- */
  (function(){
    function preloadBts(){
      const srcs = [];
      for(let i=1;i<=40;i++) srcs.push('images_engagement-'+i+'.jpg');
      for(let i=1;i<=43;i++) srcs.push('images_bts-'+i+'.jpg');
      srcs.forEach(src=>{ const img=new Image(); img.src=src; });
    }
    if(typeof requestIdleCallback!=='undefined'){
      requestIdleCallback(preloadBts,{timeout:12000});
    } else {
      setTimeout(preloadBts,6000);
    }
  })();

  if(savedTier && ACCESS[savedTier]) unlock(savedTier, true);
}
