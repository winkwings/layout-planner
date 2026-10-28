/* Sofa Planner logic. Copied AS IS from sofa-planner.html lines 776-2311.
 * Only mechanical changes:
 *  1. style="..." inside HTML strings -> data-style="..." (42 places), and
 *     SofaPlannerCSP.applyDataStyles(...) after each innerHTML that uses them (11 places).
 *     Reason: the Portal CSP blocks inline style attributes. See INLINE_FIXES.md.
 *  2. localStorage.getItem/setItem -> SofaPlannerStorage.getItem/setItem (6 places).
 *     TODO-PORTAL stub, see storage-stub.js.
 * Needs csp-helpers.js and storage-stub.js loaded BEFORE this file.
 */
(function(){
  "use strict";

  // ---------- Catalog ----------
  const GROUPS = [
    { id:"arm", label:"Arms", hue:80, items:[
      { name:"Arm (S)", w:12, d:82 },
      { name:"Arm (L)", w:20, d:105 },
    ]},
    { id:"single", label:"Single Seats", hue:250, items:[
      { name:"Single Seat (S)", d:82, widths:[70,80,90] },
      { name:"Single Seat (L)", d:105, widths:[70,80,90] },
    ]},
    { id:"recliner", label:"Recliners", hue:55, items:[
      { name:"Recliner (S)", w:90, d:82, assumed:true },
      { name:"Recliner (L)", w:90, d:105, assumed:true },
    ]},
    { id:"power", label:"Power Beds", hue:25, items:[
      { name:"Power Bed (S)", w:140, d:130 },
      { name:"Power Bed (M)", w:160, d:130 },
      { name:"Power Bed (L)", w:180, d:130 },
    ]},
    { id:"chaise", label:"Chaise", hue:150, items:[
      { name:"Chaise", w:105, d:180 },
    ]},
    { id:"lounge", label:"Lounge", hue:300, items:[
      { name:"Lounge (S)", w:105, d:230 },
      { name:"Lounge (L)", w:105, d:250 },
    ]},
    { id:"decor", label:"Decor", hue:40, decor:true, items:[
      { name:"Area Rug",     w:240, d:320, shape:"rug" },
      { name:"Coffee Table", w:90,  d:90,  shape:"round" },
      { name:"Side Table",   w:50,  d:50,  shape:"round" },
    ]},
    { id:"custom", label:"Custom", hue:200, custom:true, items:[] },
  ];
  const HUE = {};
  const DECOR = {};
  const SHAPE = {};
  GROUPS.forEach(g => { HUE[g.id] = g.hue; if(g.decor){ DECOR[g.id]=true; g.items.forEach(it=> SHAPE[it.name]=it.shape); } });

  function fill(hue){ return `oklch(0.93 0.016 ${hue})`; }      // outer frame (arms/back), faint type tint
  function cushion(hue){ return `oklch(0.965 0.013 ${hue})`; }  // lighter seat cushion
  function stroke(hue){ return `oklch(0.78 0.035 ${hue})`; }    // soft seam/border
  function seam(hue){ return `oklch(0.86 0.025 ${hue})`; }      // cushion division lines
  function textc(hue){ return `oklch(0.44 0.03 ${hue})`; }
  function dot(hue){ return `oklch(0.64 0.11 ${hue})`; }        // palette group dots keep more colour for legibility

  // ---------- World / state ----------
  const WORLD_W = 760, WORLD_H = 440; // cm
  const BACK_MARGIN = 75;             // cm padding above back wall (room for width dimension label)
  const LEFT_MARGIN = 130;            // cm padding left of plan (room for depth dimension label)
  const MIGRATE = { dx: 60, dy: 35 }; // shift applied to pre-v2 saved layouts to match new origin
  const STORE = "sofaPlanner.v1";
  const NAME_STORE = "sofaPlanner.names.v1";

  const DEFAULT_NAMES = [
    "Alvric Sofa","Amora Sofa","Ardis Sofa","Aria Sofa","Aurora Sofa",
    "Bliss Sofa","Delta Sofa","Cascade Modular Sectional with lounge",
    "Heritage Modular Sectional Sofa with chaise","Nelson Sectional Sofa with chaise",
    "Nirvana Power Sleeper Sofa bed","Nolan Sofa","Polar Power Sleeper Sofa bed",
    "Renna 4 Seater"
  ];
  let sofaNames = DEFAULT_NAMES.slice();
  let sofaName = sofaNames[0];

  let scale = 2.4;          // px per cm
  let pieces = [];          // {id,type,name,w,d,x,y,rot,decor?,shape?}
  let selectedId = null;
  let uid = 1;
  let unit = "cm";          // 'cm' | 'in'
  let openingUid = 1;
  let selectedOpening = null;
  // sofa pieces only (decor excluded from sizing, counts, order form)
  function sofaPieces(){ return pieces.filter(p=> !p.decor); }
  function isDecor(p){ return !!(p && (p.decor || DECOR[p.type])); }

  // ---------- Room ----------
  const ROOM_X = LEFT_MARGIN, ROOM_Y = BACK_MARGIN; // room top-left in world cm
  let room = { on:false, w:400, d:300, unit:"ft",
               notches:{ tl:{x:0,y:0}, tr:{x:0,y:0}, br:{x:0,y:0}, bl:{x:0,y:0} },
               openings:[] };  // openings: {id,kind:'door'|'window',side,center,len} (cm)
  const ROOM_PRESETS = [
    { name:"Small",  w:330, d:300 },
    { name:"Medium", w:430, d:360 },
    { name:"Large",  w:550, d:420 },
  ];
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function roomBox(){ return { l:ROOM_X, t:ROOM_Y, r:ROOM_X+room.w, b:ROOM_Y+room.d, w:room.w, h:room.d }; }
  function nget(c){ const N=room.notches||{}; return N[c]||{x:0,y:0}; }
  function clampNotches(){
    if(!room.notches) room.notches = { tl:{x:0,y:0}, tr:{x:0,y:0}, br:{x:0,y:0}, bl:{x:0,y:0} };
    ["tl","tr","br","bl"].forEach(c=>{
      if(!room.notches[c]) room.notches[c]={x:0,y:0};
      room.notches[c].x = clamp(room.notches[c].x, 0, room.w*0.95);
      room.notches[c].y = clamp(room.notches[c].y, 0, room.d*0.95);
    });
  }
  // orthogonal outline of the room (clockwise), accounting for corner notches
  function roomPolygon(){
    const rb=roomBox(); const tl=nget("tl"),tr=nget("tr"),br=nget("br"),bl=nget("bl");
    const pts=[];
    if(tl.x||tl.y){ pts.push({x:rb.l,y:rb.t+tl.y},{x:rb.l+tl.x,y:rb.t+tl.y},{x:rb.l+tl.x,y:rb.t}); }
    else pts.push({x:rb.l,y:rb.t});
    if(tr.x||tr.y){ pts.push({x:rb.r-tr.x,y:rb.t},{x:rb.r-tr.x,y:rb.t+tr.y},{x:rb.r,y:rb.t+tr.y}); }
    else pts.push({x:rb.r,y:rb.t});
    if(br.x||br.y){ pts.push({x:rb.r,y:rb.b-br.y},{x:rb.r-br.x,y:rb.b-br.y},{x:rb.r-br.x,y:rb.b}); }
    else pts.push({x:rb.r,y:rb.b});
    if(bl.x||bl.y){ pts.push({x:rb.l+bl.x,y:rb.b},{x:rb.l+bl.x,y:rb.b-bl.y},{x:rb.l,y:rb.b-bl.y}); }
    else pts.push({x:rb.l,y:rb.b});
    return pts;
  }
  // rectangular regions cut out of each corner (forbidden zones)
  function notchRects(){
    const rb=roomBox(); const out=[];
    const tl=nget("tl"),tr=nget("tr"),br=nget("br"),bl=nget("bl");
    if(tl.x&&tl.y) out.push({l:rb.l,t:rb.t,r:rb.l+tl.x,b:rb.t+tl.y});
    if(tr.x&&tr.y) out.push({l:rb.r-tr.x,t:rb.t,r:rb.r,b:rb.t+tr.y});
    if(br.x&&br.y) out.push({l:rb.r-br.x,t:rb.b-br.y,r:rb.r,b:rb.b});
    if(bl.x&&bl.y) out.push({l:rb.l,t:rb.b-bl.y,r:rb.l+bl.x,b:rb.b});
    return out;
  }
  // handle (inner elbow) position for a corner, in world cm
  function roomHandlePos(c){
    const rb=roomBox(), n=nget(c);
    if(c==="tl") return {x:rb.l+n.x, y:rb.t+n.y};
    if(c==="tr") return {x:rb.r-n.x, y:rb.t+n.y};
    if(c==="br") return {x:rb.r-n.x, y:rb.b-n.y};
    return {x:rb.l+n.x, y:rb.b-n.y};
  }

  // ---------- Door / window opening geometry ----------
  const DOOR_LEN = 85, WIN_LEN = 120;   // default opening lengths (cm)
  function sideIsH(side){ return side==="top" || side==="bottom"; }
  function sideConst(side, rb){ return side==="top"?rb.t : side==="bottom"?rb.b : side==="left"?rb.l : rb.r; }
  function sideSpan(side, rb){ return sideIsH(side) ? rb.w : rb.h; }
  function sideStartW(side, rb){ return sideIsH(side) ? rb.l : rb.t; }   // world coord of the side's start corner
  function intoSign(side){ return (side==="top" || side==="left") ? 1 : -1; }
  function clampOpenings(){
    if(!room.openings) room.openings = [];
    const rb = roomBox();
    room.openings.forEach(o=>{
      const span = sideSpan(o.side, rb);
      o.len = clamp(o.len, 30, span);
      o.center = clamp(o.center, o.len/2, span - o.len/2);
    });
  }
  function longestSide(){
    const rb = roomBox();
    const sides = [["bottom",rb.w],["top",rb.w],["left",rb.h],["right",rb.h]];
    sides.sort((a,b)=> b[1]-a[1]);
    return sides[0][0];
  }
  function addOpening(kind){
    const rb = roomBox();
    const side = longestSide();
    const span = sideSpan(side, rb);
    const len = Math.min(kind==="door"?DOOR_LEN:WIN_LEN, span*0.8);
    const o = { id: openingUid++, kind, side, center: span/2, len };
    if(!room.openings) room.openings = [];
    room.openings.push(o);
    selectedOpening = o.id;
    room.on = true;
    render(); save();
  }
  function overflowAmount(b){
    if(!room.on || !b) return 0;
    const rb = roomBox();
    let over = Math.max(0, rb.l-b.l, b.r-rb.r, rb.t-b.t, b.b-rb.b);
    notchRects().forEach(nr=>{
      const iw = Math.min(b.r,nr.r)-Math.max(b.l,nr.l);
      const ih = Math.min(b.b,nr.b)-Math.max(b.t,nr.t);
      if(iw>0 && ih>0) over = Math.max(over, Math.min(iw, ih));
    });
    return over;
  }

  const IN = 2.54;
  const FT = 30.48;
  // convert a cm value to a display number in the current unit
  function disp(cm){ return unit==="in" ? Math.round(cm/IN*10)/10 : Math.round(cm); }
  // convert a display value (current unit) back to cm
  function fromDisp(v){ return unit==="in" ? v*IN : v; }
  function uname(){ return unit; }
  // ---- room-specific units (independent of sofa unit) ----
  function roomDisp(cm){
    if(room.unit==="ft") return Math.round(cm/FT*100)/100;
    if(room.unit==="in") return Math.round(cm/IN*10)/10;
    return Math.round(cm);
  }
  function roomFromDisp(v){
    if(room.unit==="ft") return v*FT;
    if(room.unit==="in") return v*IN;
    return v;
  }
  function roomUname(){ return room.unit; }

  const world = document.getElementById("world");
  const wrap  = document.getElementById("canvasWrap");
  const backwall = document.getElementById("backwall");
  const emptyEl  = document.getElementById("empty");

  // ---------- Geometry helpers ----------
  // effective UNROTATED footprint in cm
  function eff(p){ return { w:p.w, h:p.d }; }
  // size of the axis-aligned bounding box of the rotated rectangle
  function aabbSize(p){
    const rad = ((p.rot||0)) * Math.PI/180;
    const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
    return { w: p.w*c + p.d*s, h: p.w*s + p.d*c };
  }
  // box() keeps p.x,p.y as the AABB top-left (backward compatible with 0/90/180/270)
  function box(p){
    const a = aabbSize(p);
    return { l:p.x, t:p.y, r:p.x+a.w, b:p.y+a.h, w:a.w, h:a.h };
  }
  // centre of a piece in world cm
  function centre(p){ const a = aabbSize(p); return { x:p.x + a.w/2, y:p.y + a.h/2 }; }
  // place a DOM element for a piece (rotated about its centre)
  function placePiece(el, p){
    const c = centre(p);
    el.style.left   = ((c.x - p.w/2)*scale)+"px";
    el.style.top    = ((c.y - p.d/2)*scale)+"px";
    el.style.width  = (p.w*scale)+"px";
    el.style.height = (p.d*scale)+"px";
    el.style.transform = `rotate(${p.rot||0}deg)`;
    const rot = p.rot||0;
    el.querySelectorAll(".p-inner, .p-edge .v").forEach(n=> n.style.transform = `rotate(${-rot}deg)`);
  }
  function bounds(){
    const sp = sofaPieces();
    if(!sp.length) return null;
    let l=Infinity,t=Infinity,r=-Infinity,b=-Infinity;
    sp.forEach(p=>{ const k=box(p); l=Math.min(l,k.l); t=Math.min(t,k.t); r=Math.max(r,k.r); b=Math.max(b,k.b); });
    return { l,t,r,b, w:r-l, h:b-t };
  }

  // ---------- Build palette ----------
  // Default custom size: standard 31" × 31" (stored in cm)
  const CUSTOM_DEFAULT_CM = 31 * IN; // 78.74 cm
  function buildCustomCard(g){
    const card = document.createElement("div");
    card.className = "card custom";
    // default dims shown in the active unit
    const wv = disp(CUSTOM_DEFAULT_CM), dv = disp(CUSTOM_DEFAULT_CM);
    card.innerHTML = `
      <div class="cc-row">
        <div class="thumb"><i data-style="width:32px;height:32px;background:${fill(g.hue)};border:1.5px solid ${stroke(g.hue)}"></i></div>
        <input class="cc-name" type="text" placeholder="Piece name" value="Custom Piece" maxlength="40" />
      </div>
      <div class="cc-dims">
        <span class="fld"><input class="cc-w" type="number" min="1" step="0.1" value="${wv}" /></span>
        <span class="x">×</span>
        <span class="fld"><input class="cc-d" type="number" min="1" step="0.1" value="${dv}" /></span>
        <span class="uu u-label">${uname()}</span>
      </div>
      <button class="cc-add" type="button">+ Add to plan</button>
    `;
    SofaPlannerCSP.applyDataStyles(card); // CSP fix, see INLINE_FIXES.md
    const nameEl = card.querySelector(".cc-name");
    const wEl = card.querySelector(".cc-w");
    const dEl = card.querySelector(".cc-d");
    nameEl.addEventListener("click", e=> e.stopPropagation());
    [nameEl, wEl, dEl].forEach(el=> el.addEventListener("keydown", e=>{
      if(e.key === "Enter"){ e.preventDefault(); card.querySelector(".cc-add").click(); }
    }));
    card.querySelector(".cc-add").addEventListener("click", ()=>{
      const nm = (nameEl.value || "").trim() || "Custom Piece";
      const wCm = clamp(fromDisp(+wEl.value) || CUSTOM_DEFAULT_CM, 5, 600);
      const dCm = clamp(fromDisp(+dEl.value) || CUSTOM_DEFAULT_CM, 5, 600);
      addPiece(g.id, nm, Math.round(wCm*10)/10, Math.round(dCm*10)/10, false);
    });
    return card;
  }

  function buildPalette(){
    const aside = document.getElementById("palette");
    aside.querySelectorAll(".group").forEach(n=>n.remove());
    GROUPS.forEach(g=>{
      const wrapG = document.createElement("div");
      wrapG.className = "group";
      const head = document.createElement("div");
      head.className = "group-head";
      head.innerHTML = `<span class="group-dot" data-style="background:${dot(g.hue)}"></span><h2>${g.label}</h2>`;
      SofaPlannerCSP.applyDataStyles(head); // CSP fix, see INLINE_FIXES.md
      wrapG.appendChild(head);

      if(g.custom){
        wrapG.appendChild(buildCustomCard(g));
        aside.appendChild(wrapG);
        return;
      }

      g.items.forEach(it=>{
        const card = document.createElement("div");
        card.className = "card" + (it.widths ? " has-variants" : "");

        // thumbnail proportional rectangle
        const tw = it.widths ? Math.max(...it.widths) : it.w;
        const td = it.d;
        const cap = 42, capH = 36;
        const k = Math.min(cap/tw, capH/td);
        const pw = Math.max(8, Math.round(tw*k)), ph = Math.max(8, Math.round(td*k));
        const dimText = it.widths
          ? `${it.widths.map(disp).join(" / ")} × ${disp(it.d)} ${uname()}`
          : `${disp(it.w)} × ${disp(it.d)} ${uname()}`;

        let thumbStyle;
        if(it.shape === "round"){
          const s = Math.max(pw, ph);
          thumbStyle = `width:${s}px;height:${s}px;border-radius:50%;`+
            `background:radial-gradient(circle at 38% 32%, oklch(0.62 0.05 58), var(--wood-top) 70%);`+
            `border:1px solid var(--wood-top-edge);`;
        } else if(it.shape === "rug"){
          thumbStyle = `width:${pw}px;height:${ph}px;border-radius:3px;background:var(--rug);`+
            `border:2px solid var(--rug-edge);box-shadow:inset 0 0 0 2px oklch(1 0 0 / 0.25);`;
        } else {
          thumbStyle = `width:${pw}px;height:${ph}px;border-radius:3px;background:${fill(g.hue)};border:1.5px solid ${stroke(g.hue)}`;
        }

        card.innerHTML = `
          <div class="thumb"><i data-style="${thumbStyle}"></i></div>
          <div class="card-meta">
            <div class="card-name">${it.name}</div>
            <div class="card-dim">${dimText}${it.assumed?' <span class="assumed">· assumed</span>':''}</div>
            ${it.widths ? `<div class="variants">${it.widths.map(w=>`<span class="vchip" data-w="${w}">${disp(w)}</span>`).join("")}</div>` : ``}
          </div>
          ${it.widths ? `` : `<div class="add-glyph">+</div>`}
        `;
        SofaPlannerCSP.applyDataStyles(card); // CSP fix, see INLINE_FIXES.md

        if(it.widths){
          card.querySelectorAll(".vchip").forEach(ch=>{
            ch.addEventListener("click", e=>{
              e.stopPropagation();
              addPiece(g.id, it.name, +ch.dataset.w, it.d, !!it.assumed);
            });
          });
        } else {
          card.addEventListener("click", ()=> addPiece(g.id, it.name, it.w, it.d, !!it.assumed, it.shape));
        }
        wrapG.appendChild(card);
      });
      aside.appendChild(wrapG);
    });
  }

  // ---------- Add / place ----------
  function addPiece(type, name, w, d, assumed, shape){
    const decor = !!DECOR[type];
    if(decor){
      // drop decor near the centre of the room (or canvas) instead of chaining to the sofa
      let cx, cy;
      if(room.on){ const rb = roomBox(); cx = rb.l + rb.w/2; cy = rb.t + rb.h/2; }
      else { const b = bounds(); if(b){ cx = b.l + b.w/2; cy = b.b + d/2 + 40; } else { cx = LEFT_MARGIN + w/2; cy = BACK_MARGIN + d/2; } }
      const p = { id: uid++, type, name, w, d, x: cx - w/2, y: cy - d/2, rot:0, decor:true, shape: shape || "rect" };
      pieces.push(p); select(p.id); render(); save();
      requestAnimationFrame(()=> scrollTo(p));
      return;
    }
    const b = bounds();
    let x, y;
    if(b){ x = b.r + 0; y = LEFT_MARGIN === 0 ? 0 : Math.max(BACK_MARGIN, b.t); }
    else { x = LEFT_MARGIN; y = BACK_MARGIN; }
    // first piece / fresh row starts at the back margin line
    if(!b){ y = BACK_MARGIN; x = LEFT_MARGIN; }
    else { y = b.t; } // align to existing back line

    const p = { id: uid++, type, name, w, d, x, y, rot:0, assumed:!!assumed };
    pieces.push(p);
    select(p.id);
    render();
    save();
    // ensure visible
    requestAnimationFrame(()=> scrollTo(p));
  }

  function scrollTo(p){
    const k = box(p);
    const px = (k.l + k.w/2) * scale, py = (k.t + k.h/2) * scale;
    wrap.scrollTo({ left: px - wrap.clientWidth/2, top: py - wrap.clientHeight/2, behavior:"smooth" });
  }

  function duplicate(id){
    const src = pieces.find(p=>p.id===id); if(!src) return;
    const p = Object.assign({}, src, { id: uid++, x: src.x + 10, y: src.y + 10 });
    pieces.push(p); select(p.id); render(); save();
  }
  function removePiece(id){
    pieces = pieces.filter(p=>p.id!==id);
    if(selectedId===id) selectedId=null;
    render(); save();
  }
  function rotateTo(p, ang){
    const c = centre(p);                 // keep visual centre fixed
    p.rot = ((Math.round(ang)%360)+360)%360;
    const a = aabbSize(p);
    p.x = c.x - a.w/2;
    p.y = c.y - a.h/2;
  }
  function rotate(id){
    const p = pieces.find(x=>x.id===id); if(!p) return;
    rotateTo(p, Math.round((p.rot||0)/90)*90 + 90);   // snap to next 90°
    render(); save();
  }

  function select(id){ selectedId = id; if(id!=null) selectedOpening = null; }

  // ---------- Render ----------
  function setWorldSize(){
    const b = bounds();
    let needW = WORLD_W, needH = WORLD_H;
    if(b){ needW = Math.max(WORLD_W, b.r + 120); needH = Math.max(WORLD_H, b.b + 120); }
    if(room.on){ const rb = roomBox(); needW = Math.max(needW, rb.r + 120); needH = Math.max(needH, rb.b + 120); }
    // fill the viewport so the wood floor covers the whole canvas (no bare strip)
    needW = Math.max(needW, wrap.clientWidth/scale);
    needH = Math.max(needH, wrap.clientHeight/scale);
    world.style.width  = (needW*scale)+"px";
    world.style.height = (needH*scale)+"px";
    // warm wood-plank floor
    const plank = Math.max(12, 24*scale);   // plank height in px (~24cm planks)
    world.style.backgroundColor = "var(--wood-a)";
    world.style.backgroundImage =
      // soft directional grain
      `repeating-linear-gradient(90deg, var(--wood-grain) 0 1px, transparent 1px 6px),`+
      // plank seams (thin shadow lines between rows)
      `repeating-linear-gradient(0deg, transparent 0 ${plank-1.5}px, var(--wood-seam) ${plank-1.5}px ${plank}px),`+
      // alternating plank tone every other row
      `repeating-linear-gradient(0deg, var(--wood-a) 0 ${plank}px, var(--wood-b) ${plank}px ${plank*2}px)`;
    world.style.backgroundSize = "auto, auto, auto";
  }

  function render(){
    setWorldSize();
    // back wall position = min top of pieces (or BACK_MARGIN)
    const b = bounds();
    const wallY = b ? b.t : BACK_MARGIN;
    backwall.style.top = (wallY*scale)+"px";
    backwall.style.width = world.style.width;
    backwall.style.display = room.on ? "none" : "";

    // remove old pieces, dims, guides, room
    world.querySelectorAll(".piece,.dim,.guide,.room,.room-line").forEach(n=>n.remove());

    drawRoom();                              // behind pieces (inserted before them)
    // render rugs first (so they sit behind furniture), then everything else
    const ordered = pieces.slice().sort((a,b)=> (a.shape==="rug"?0:1) - (b.shape==="rug"?0:1));
    ordered.forEach(p=> world.appendChild(makePieceEl(p)));
    if(room.on) drawRoomDims(); else drawDims(b);

    emptyEl.style.display = pieces.length ? "none" : "grid";

    // readout
    document.getElementById("ro-width").textContent  = b ? disp(b.w) : 0;
    document.getElementById("ro-depth").textContent  = b ? disp(b.h) : 0;
    document.getElementById("ro-count").textContent  = sofaPieces().length;

    updateFitPill(b);
    updateInspector();
  }

  // ---------- Room rendering ----------
  function roomPolyStr(rb, PAD){
    return roomPolygon().map(p=> ((p.x-rb.l)*scale+PAD)+","+((p.y-rb.t)*scale+PAD)).join(" ");
  }
  const ROOM_PAD = 16;
  function wallPx(){ return Math.max(7, Math.min(16, 4.5*scale)); }
  function drawRoom(){
    if(!room.on) return;
    clampNotches();
    clampOpenings();
    const rb = roomBox();
    const over = overflowAmount(bounds()) > 0.5;
    const WALL = wallPx();
    const el = document.createElement("div");
    el.className = "room" + (over ? " over" : "");
    el.style.left   = (rb.l*scale - ROOM_PAD)+"px";
    el.style.top    = (rb.t*scale - ROOM_PAD)+"px";
    el.style.width  = (rb.w*scale + ROOM_PAD*2)+"px";
    el.style.height = (rb.h*scale + ROOM_PAD*2)+"px";
    const ptStr = roomPolyStr(rb, ROOM_PAD);
    let handles = "";
    ["tl","tr","br","bl"].forEach(c=>{
      const hp = roomHandlePos(c);
      handles += `<div class="room-handle" data-corner="${c}" title="Drag in to cut an L-shaped corner"`+
        ` data-style="left:${(hp.x-rb.l)*scale+ROOM_PAD}px;top:${(hp.y-rb.t)*scale+ROOM_PAD}px;"></div>`;
    });
    const op = buildOpenings(rb, WALL);
    el.innerHTML =
      `<svg width="100%" height="100%">`+
        `<polygon class="room-floor" points="${ptStr}"/>`+
        `<polygon class="room-wall" points="${ptStr}" stroke-width="${WALL}"/>`+
        `<polygon class="room-wall-in" points="${ptStr}"/>`+
        op.arcs+
      `</svg>`+
      `<span class="room-tag">Back wall</span>`+ handles + op.bodies;
    SofaPlannerCSP.applyDataStyles(el); // CSP fix, see INLINE_FIXES.md
    world.appendChild(el);
    el.querySelectorAll(".room-handle").forEach(h=>
      h.addEventListener("pointerdown", e=> startRoomCornerDrag(e, h.dataset.corner, el)));
    attachOpenings(el);
  }

  // Build door/window DOM (bodies) + door swing arcs (svg paths), positioned on the walls
  function buildOpenings(rb, WALL){
    let arcs = "", bodies = "";
    (room.openings || []).forEach(o=>{
      const H = sideIsH(o.side);
      const lineLocal = (sideConst(o.side, rb) - (H ? rb.t : rb.l)) * scale + ROOM_PAD;
      const start = (o.center - o.len/2) * scale + ROOM_PAD;   // along-wall local px of opening start
      const lenPx = o.len * scale;
      const thick = WALL + 2;
      const sel = (o.id===selectedOpening) ? " selected" : "";
      const vert = H ? "" : " vert";
      // body geometry
      let bx, by, bw, bh;
      if(H){ bx = start; by = lineLocal - thick/2; bw = lenPx; bh = thick; }
      else { bx = lineLocal - thick/2; by = start; bw = thick; bh = lenPx; }
      // resize handles at both jambs + delete at centre
      const aPos = H ? `left:${bx}px;top:${lineLocal}px` : `left:${lineLocal}px;top:${by}px`;
      const bPos = H ? `left:${bx+bw}px;top:${lineLocal}px` : `left:${lineLocal}px;top:${by+bh}px`;
      const cPos = H ? `left:${bx+bw/2}px;top:${lineLocal - thick/2 - 4}px` : `left:${lineLocal - thick/2 - 4}px;top:${by+bh/2}px`;
      let mull = "";
      if(o.kind==="window"){
        mull = H
          ? `<div class="op-mull" data-style="left:50%;top:2px;bottom:2px;width:1.5px;margin-left:-0.75px;"></div>`
          : `<div class="op-mull" data-style="top:50%;left:2px;right:2px;height:1.5px;margin-top:-0.75px;"></div>`;
      }
      bodies +=
        `<div class="opening ${o.kind}${vert}${sel}" data-op="${o.id}">`+
          `<div class="op-body" data-op="${o.id}" data-style="left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;border-radius:2px;">${mull}</div>`+
          `<div class="op-resize" data-op="${o.id}" data-jamb="a" data-style="${aPos}"></div>`+
          `<div class="op-resize" data-op="${o.id}" data-jamb="b" data-style="${bPos}"></div>`+
          `<div class="op-del" data-op="${o.id}" title="Remove" data-style="${cPos}">×</div>`+
        `</div>`;
      // door swing arc + leaf (into the room)
      if(o.kind==="door"){
        const into = intoSign(o.side);
        let hinge, along, perp;
        if(H){ hinge = {x:bx, y:lineLocal}; along = {x:1,y:0}; perp = {x:0,y:into}; }
        else { hinge = {x:lineLocal, y:by}; along = {x:0,y:1}; perp = {x:into,y:0}; }
        const leafTip = { x:hinge.x + perp.x*lenPx, y:hinge.y + perp.y*lenPx };
        const otherJ  = { x:hinge.x + along.x*lenPx, y:hinge.y + along.y*lenPx };
        const v1 = { x:leafTip.x-hinge.x, y:leafTip.y-hinge.y };
        const v2 = { x:otherJ.x-hinge.x, y:otherJ.y-hinge.y };
        const sweep = (v1.x*v2.y - v1.y*v2.x) > 0 ? 1 : 0;
        arcs += `<path class="op-arc" d="M ${leafTip.x} ${leafTip.y} A ${lenPx} ${lenPx} 0 0 ${sweep} ${otherJ.x} ${otherJ.y}"/>`;
        arcs += `<path class="op-leaf" d="M ${hinge.x} ${hinge.y} L ${leafTip.x} ${leafTip.y}"/>`;
      }
    });
    return { arcs, bodies };
  }

  function attachOpenings(el){
    el.querySelectorAll(".op-body").forEach(b=>
      b.addEventListener("pointerdown", e=> startOpeningDrag(e, +b.dataset.op, "move", null, el)));
    el.querySelectorAll(".op-resize").forEach(h=>
      h.addEventListener("pointerdown", e=> startOpeningDrag(e, +h.dataset.op, "resize", h.dataset.jamb, el)));
    el.querySelectorAll(".op-del").forEach(d=>{
      d.addEventListener("pointerdown", e=> e.stopPropagation());
      d.addEventListener("click", e=>{ e.stopPropagation(); room.openings = room.openings.filter(o=>o.id!==+d.dataset.op); if(selectedOpening===+d.dataset.op) selectedOpening=null; render(); save(); });
    });
  }

  function startOpeningDrag(e, id, mode, jamb, el){
    if(e.button!==undefined && e.button!==0) return;
    e.preventDefault(); e.stopPropagation();
    const o = (room.openings||[]).find(x=>x.id===id); if(!o) return;
    selectedOpening = id; selectedId = null;
    world.querySelectorAll(".piece").forEach(n=> n.classList.remove("selected"));
    el.querySelectorAll(".opening").forEach(n=> n.classList.toggle("selected", +n.dataset.op===id));
    const target = e.currentTarget;
    try{ target.setPointerCapture(e.pointerId); }catch(_){}
    const rb = roomBox();
    function move(ev){
      const r = world.getBoundingClientRect();
      const H = sideIsH(o.side);
      const along = H ? (ev.clientX - r.left)/scale - rb.l : (ev.clientY - r.top)/scale - rb.t; // cm from side start
      const span = sideSpan(o.side, rb);
      if(mode==="move"){
        o.center = clamp(Math.round(along/2)*2, o.len/2, span - o.len/2);
      } else {
        // resize: move the dragged jamb, keep the other fixed
        const a0 = o.center - o.len/2, b0 = o.center + o.len/2;
        let na = a0, nb = b0;
        if(jamb==="a") na = clamp(Math.round(along/2)*2, 0, b0 - 30);
        else           nb = clamp(Math.round(along/2)*2, a0 + 30, span);
        o.len = nb - na; o.center = (na + nb)/2;
      }
      render(); save();
    }
    function up(ev){
      try{ target.releasePointerCapture(ev.pointerId); }catch(_){}
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    }
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  }

  // update room outline + handles live during a corner drag (no full re-render)
  function updateRoomLive(el){
    const rb = roomBox();
    const ptStr = roomPolyStr(rb, ROOM_PAD);
    el.querySelectorAll("polygon").forEach(pg=> pg.setAttribute("points", ptStr));
    ["tl","tr","br","bl"].forEach(c=>{
      const hp = roomHandlePos(c);
      const hEl = el.querySelector(`.room-handle[data-corner="${c}"]`);
      if(hEl){ hEl.style.left=((hp.x-rb.l)*scale+ROOM_PAD)+"px"; hEl.style.top=((hp.y-rb.t)*scale+ROOM_PAD)+"px"; }
    });
    el.classList.toggle("over", overflowAmount(bounds())>0.5);
    updateFitPill(bounds());
  }

  function startRoomCornerDrag(e, corner, el){
    if(e.button!==undefined && e.button!==0) return;
    e.preventDefault(); e.stopPropagation();
    const h = el.querySelector(`.room-handle[data-corner="${corner}"]`);
    try{ h.setPointerCapture(e.pointerId); }catch(_){}
    function move(ev){
      const r = world.getBoundingClientRect();
      const px = (ev.clientX - r.left)/scale, py = (ev.clientY - r.top)/scale;
      const rb = roomBox();
      let nx, ny;
      if(corner==="tl"){ nx=px-rb.l; ny=py-rb.t; }
      else if(corner==="tr"){ nx=rb.r-px; ny=py-rb.t; }
      else if(corner==="br"){ nx=rb.r-px; ny=rb.b-py; }
      else { nx=px-rb.l; ny=rb.b-py; }
      nx = clamp(Math.round(nx/5)*5, 0, room.w*0.95);
      ny = clamp(Math.round(ny/5)*5, 0, room.d*0.95);
      if(nx<14 || ny<14){ nx=0; ny=0; }   // snap back to a full rectangle near the corner
      room.notches[corner] = { x:nx, y:ny };
      updateRoomLive(el);
    }
    function up(ev){
      try{ h.releasePointerCapture(ev.pointerId); }catch(_){}
      h.removeEventListener("pointermove", move);
      h.removeEventListener("pointerup", up);
      h.removeEventListener("pointercancel", up);
      render(); save();
    }
    h.addEventListener("pointermove", move);
    h.addEventListener("pointerup", up);
    h.addEventListener("pointercancel", up);
  }

  function drawRoomDims(){
    const rb = roomBox();
    const off = 34;
    // width (above)
    const wl = document.createElement("div");
    wl.className = "room-line";
    const y = rb.t*scale - off, x1 = rb.l*scale, x2 = rb.r*scale;
    wl.innerHTML =
      `<div class="stem" data-style="left:${x1}px;top:${y}px;width:${x2-x1}px;height:1px;"></div>`+
      `<div class="cap"  data-style="left:${x1}px;top:${y-4}px;width:1px;height:9px;"></div>`+
      `<div class="cap"  data-style="left:${x2}px;top:${y-4}px;width:1px;height:9px;"></div>`+
      `<div class="val"  data-style="left:${(x1+x2)/2}px;top:${y-10}px;transform:translateX(-50%);">${roomDisp(rb.w)} ${roomUname()}</div>`;
    SofaPlannerCSP.applyDataStyles(wl); // CSP fix, see INLINE_FIXES.md
    world.appendChild(wl);
    // depth (left)
    const dl = document.createElement("div");
    dl.className = "room-line";
    const x = rb.l*scale - off, yy1 = rb.t*scale, yy2 = rb.b*scale;
    dl.innerHTML =
      `<div class="stem" data-style="left:${x}px;top:${yy1}px;width:1px;height:${yy2-yy1}px;"></div>`+
      `<div class="cap"  data-style="left:${x-4}px;top:${yy1}px;width:9px;height:1px;"></div>`+
      `<div class="cap"  data-style="left:${x-4}px;top:${yy2}px;width:9px;height:1px;"></div>`+
      `<div class="val"  data-style="left:${x-7}px;top:${(yy1+yy2)/2}px;transform:translate(-100%,-50%);">${roomDisp(rb.h)} ${roomUname()}</div>`;
    SofaPlannerCSP.applyDataStyles(dl); // CSP fix, see INLINE_FIXES.md
    world.appendChild(dl);
  }

  function updateFitPill(b){
    const fp = document.getElementById("fitPill");
    if(!room.on || !b){ fp.hidden = true; return; }
    fp.hidden = false;
    const over = overflowAmount(b);
    if(over > 0.5){
      fp.className = "fit-pill over";
      fp.textContent = "Over by " + roomDisp(over) + " " + roomUname();
    } else {
      fp.className = "fit-pill ok";
      fp.textContent = "Fits";
    }
  }

  // ---------- Inspector ----------
  const insp = document.getElementById("inspector");
  function updateInspector(){
    const p = pieces.find(x=>x.id===selectedId);
    if(!p){ insp.hidden = true; return; }
    insp.hidden = false;
    document.getElementById("insp-dot").style.background = dot(HUE[p.type]);
    document.getElementById("insp-name").textContent = p.name;
    const wEl = document.getElementById("insp-w"), dEl = document.getElementById("insp-d");
    if(document.activeElement !== wEl) wEl.value = disp(p.w);
    if(document.activeElement !== dEl) dEl.value = disp(p.d);
    const aEl = document.getElementById("insp-ang");
    if(document.activeElement !== aEl) aEl.value = Math.round(p.rot||0);
  }
  function commitSize(){
    const p = pieces.find(x=>x.id===selectedId); if(!p) return;
    const w = Math.max(5, Math.min(400, fromDisp(+document.getElementById("insp-w").value) || p.w));
    const d = Math.max(5, Math.min(400, fromDisp(+document.getElementById("insp-d").value) || p.d));
    p.w = w; p.d = d; render(); save();
  }
  document.getElementById("insp-w").addEventListener("input", commitSize);
  document.getElementById("insp-d").addEventListener("input", commitSize);
  document.getElementById("insp-ang").addEventListener("input", ()=>{
    const p = pieces.find(x=>x.id===selectedId); if(!p) return;
    let v = +document.getElementById("insp-ang").value;
    if(isNaN(v)) return;
    rotateTo(p, v);
    render(); save();
  });
  document.getElementById("insp-rot").addEventListener("click", ()=> selectedId!=null && rotate(selectedId));
  document.getElementById("insp-dup").addEventListener("click", ()=> selectedId!=null && duplicate(selectedId));
  document.getElementById("insp-del").addEventListener("click", ()=> selectedId!=null && removePiece(selectedId));

  // ---------- Unit toggle ----------
  function setUnit(u){
    if(u===unit) return;
    unit = u;
    document.querySelectorAll("#unitSeg button").forEach(b=> b.classList.toggle("active", b.dataset.u===u));
    document.querySelectorAll(".u-label").forEach(s=> s.textContent = u);
    buildPalette();
    buildRoomPresets();
    syncRoomUI();
    render();
    save();
  }
  document.querySelectorAll("#unitSeg button").forEach(b=>{
    b.addEventListener("click", ()=> setUnit(b.dataset.u));
  });

  // ---------- Room controls ----------
  const roomMenu = document.getElementById("roomMenu");
  const roomBtn = document.getElementById("roomBtn");
  const roomSwitch = document.getElementById("roomSwitch");
  const roomWEl = document.getElementById("room-w");
  const roomDEl = document.getElementById("room-d");

  function syncRoomUI(){
    roomSwitch.classList.toggle("on", room.on);
    roomSwitch.setAttribute("aria-checked", room.on ? "true" : "false");
    document.querySelectorAll("#roomUnitSeg button").forEach(b=> b.classList.toggle("active", b.dataset.ru===room.unit));
    document.querySelectorAll(".ru-label").forEach(s=> s.textContent = room.unit);
    if(document.activeElement !== roomWEl) roomWEl.value = roomDisp(room.w);
    if(document.activeElement !== roomDEl) roomDEl.value = roomDisp(room.d);
  }
  function buildRoomPresets(){
    const host = document.getElementById("roomPresets");
    host.innerHTML = "";
    ROOM_PRESETS.forEach(pr=>{
      const chip = document.createElement("button");
      chip.className = "rm-chip";
      chip.innerHTML = `<span class="rm-cn">${pr.name}</span><span class="rm-cd">${roomDisp(pr.w)}×${roomDisp(pr.d)} ${roomUname()}</span>`;
      chip.addEventListener("click", ()=>{
        room.w = pr.w; room.d = pr.d; room.on = true;
        clampNotches();
        syncRoomUI(); render(); save();
      });
      host.appendChild(chip);
    });
  }
  roomBtn.addEventListener("click", e=>{ e.stopPropagation(); roomMenu.hidden = !roomMenu.hidden; });
  roomMenu.addEventListener("click", e=> e.stopPropagation());
  document.addEventListener("click", ()=> { roomMenu.hidden = true; });
  roomSwitch.addEventListener("click", ()=>{
    room.on = !room.on; syncRoomUI(); render(); save();
  });
  function commitRoom(){
    room.w = clamp(roomFromDisp(+roomWEl.value) || room.w, 50, 2000);
    room.d = clamp(roomFromDisp(+roomDEl.value) || room.d, 50, 2000);
    room.on = true;
    clampNotches();
    roomSwitch.classList.add("on");
    roomSwitch.setAttribute("aria-checked", "true");
    render(); save();
  }
  roomWEl.addEventListener("input", commitRoom);
  roomDEl.addEventListener("input", commitRoom);
  document.getElementById("roomResetCorners").addEventListener("click", ()=>{
    room.notches = { tl:{x:0,y:0}, tr:{x:0,y:0}, br:{x:0,y:0}, bl:{x:0,y:0} };
    render(); save();
  });
  document.getElementById("addDoor").addEventListener("click", ()=> addOpening("door"));
  document.getElementById("addWindow").addEventListener("click", ()=> addOpening("window"));
  document.querySelectorAll("#roomUnitSeg button").forEach(b=>{
    b.addEventListener("click", ()=>{
      if(b.dataset.ru===room.unit) return;
      room.unit = b.dataset.ru;
      syncRoomUI(); buildRoomPresets(); render(); save();
    });
  });

  function makePieceEl(p){
    const hue = HUE[p.type];
    const el = document.createElement("div");
    const decor = isDecor(p);
    const shape = p.shape || (decor ? "rect" : "");
    el.className = "piece" + (decor ? " decor" : "") + (shape ? " "+shape : "") + (p.id===selectedId ? " selected":"");
    el.dataset.id = p.id;
    el.style.setProperty("--p-fill", fill(hue));
    el.style.setProperty("--p-cushion", cushion(hue));
    el.style.setProperty("--p-stroke", stroke(hue));
    el.style.setProperty("--p-text", textc(hue));

    const small = (p.w*scale < 46) || (p.d*scale < 40);
    let body = "";
    if(decor){
      // rug / round table — no cushion; round hides edge dims for a cleaner look
      const labelHtml = small ? `` : `<div class="p-label">${p.name}</div>`;
      body = `<div class="p-inner">${labelHtml}</div>`;
      if(shape !== "round"){
        body += `<div class="p-edge p-edge-w"><span class="v">${disp(p.w)}</span></div>`+
                `<div class="p-edge p-edge-d"><span class="v">${disp(p.d)}</span></div>`;
      }
    } else {
      // upholstered section: frame + inset seat cushion(s) with division seams
      const n = Math.max(1, Math.round(p.w / 58));
      const seamStyle = n > 1
        ? `background-image:repeating-linear-gradient(90deg, transparent 0, transparent calc(100%/${n} - 1.5px), ${seam(hue)} calc(100%/${n} - 1.5px), ${seam(hue)} calc(100%/${n}));`
        : ``;
      body =
        `<div class="p-cushion" data-style="${seamStyle}"></div>`+
        `<div class="p-inner">${small ? `` : `<div class="p-label">${p.name}</div>`}</div>`+
        `<div class="p-edge p-edge-w"><span class="v">${disp(p.w)}</span></div>`+
        `<div class="p-edge p-edge-d"><span class="v">${disp(p.d)}</span></div>`;
    }
    el.innerHTML = body + `
      <div class="rot-stem"></div>
      <div class="rot-handle" title="Drag to rotate (hold Shift for fine)"></div>
      <div class="rot" title="Rotate 90° (R)">⟳</div>
      <div class="del" title="Delete (⌫)">×</div>
    `;
    SofaPlannerCSP.applyDataStyles(el); // CSP fix, see INLINE_FIXES.md
    placePiece(el, p);

    el.querySelector(".del").addEventListener("pointerdown", e=>{ e.stopPropagation(); });
    el.querySelector(".del").addEventListener("click", e=>{ e.stopPropagation(); removePiece(p.id); });
    el.querySelector(".rot").addEventListener("pointerdown", e=>{ e.stopPropagation(); });
    el.querySelector(".rot").addEventListener("click", e=>{ e.stopPropagation(); rotate(p.id); });
    el.querySelector(".rot-handle").addEventListener("pointerdown", e=> startRotate(e, p, el));

    el.addEventListener("pointerdown", e=> startDrag(e, p, el));
    return el;
  }

  // ---------- Overall dimension lines ----------
  function drawDims(b){
    if(!b) return;
    const off = 26; // px offset outside bbox
    // width line (above)
    const wl = document.createElement("div");
    wl.className = "dim";
    const y = b.t*scale - off;
    const x1 = b.l*scale, x2 = b.r*scale;
    wl.innerHTML = `
      <div class="stem" data-style="left:${x1}px;top:${y}px;width:${x2-x1}px;height:1px;"></div>
      <div class="cap"  data-style="left:${x1}px;top:${y-4}px;width:1px;height:9px;"></div>
      <div class="cap"  data-style="left:${x2}px;top:${y-4}px;width:1px;height:9px;"></div>
      <div class="val"  data-style="left:${(x1+x2)/2}px;top:${y-9}px;transform:translateX(-50%);">${disp(b.w)} ${uname()}</div>
    `;
    SofaPlannerCSP.applyDataStyles(wl); // CSP fix, see INLINE_FIXES.md
    world.appendChild(wl);

    // depth line (left)
    const dl = document.createElement("div");
    dl.className = "dim";
    const x = b.l*scale - off;
    const y1 = b.t*scale, y2 = b.b*scale;
    dl.innerHTML = `
      <div class="stem" data-style="left:${x}px;top:${y1}px;width:1px;height:${y2-y1}px;"></div>
      <div class="cap"  data-style="left:${x-4}px;top:${y1}px;width:9px;height:1px;"></div>
      <div class="cap"  data-style="left:${x-4}px;top:${y2}px;width:9px;height:1px;"></div>
      <div class="val"  data-style="left:${x-6}px;top:${(y1+y2)/2}px;transform:translate(-100%,-50%);">${disp(b.h)} ${uname()}</div>
    `;
    SofaPlannerCSP.applyDataStyles(dl); // CSP fix, see INLINE_FIXES.md
    world.appendChild(dl);
  }

  // ---------- Dragging + snapping ----------
  let drag = null;
  function startDrag(e, p, el){
    if(e.button!==undefined && e.button!==0) return;
    select(p.id);
    // refresh selection outline without full re-render flicker
    world.querySelectorAll(".piece").forEach(n=> n.classList.toggle("selected", +n.dataset.id===p.id));
    el.classList.add("dragging");
    el.setPointerCapture(e.pointerId);
    const k = box(p);
    drag = {
      p, el,
      startX: e.clientX, startY: e.clientY,
      origX: p.x, origY: p.y,
      pid: e.pointerId
    };
    el.addEventListener("pointermove", onDrag);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
  }

  function onDrag(e){
    if(!drag) return;
    const dx = (e.clientX - drag.startX)/scale;
    const dy = (e.clientY - drag.startY)/scale;
    drag.p.x = drag.origX + dx;
    drag.p.y = drag.origY + dy;
    const guides = applySnap(drag.p);
    drag.el.style.left = (drag.p.x*scale)+"px";
    drag.el.style.top  = (drag.p.y*scale)+"px";
    drawGuides(guides);
  }

  function endDrag(e){
    if(!drag) return;
    drag.el.classList.remove("dragging");
    try{ drag.el.releasePointerCapture(drag.pid); }catch(_){}
    drag.el.removeEventListener("pointermove", onDrag);
    drag.el.removeEventListener("pointerup", endDrag);
    drag.el.removeEventListener("pointercancel", endDrag);
    drag = null;
    clearGuides();
    render();
    save();
  }

  // ---------- Free rotation ----------
  const rotBadge = document.getElementById("rotBadge");
  function startRotate(e, p, el){
    if(e.button!==undefined && e.button!==0) return;
    e.preventDefault(); e.stopPropagation();
    select(p.id);
    world.querySelectorAll(".piece").forEach(n=> n.classList.toggle("selected", +n.dataset.id===p.id));
    el.classList.add("rotating");
    el.setPointerCapture(e.pointerId);

    const c = centre(p);                              // fixed centre (cm)
    const wr = world.getBoundingClientRect();
    const cxs = wr.left + c.x*scale, cys = wr.top + c.y*scale;

    function move(ev){
      let ang = Math.atan2(ev.clientY - cys, ev.clientX - cxs)*180/Math.PI + 90;
      ang = ((ang%360)+360)%360;
      if(!ev.shiftKey) ang = Math.round(ang/15)*15;   // 15° steps; Shift = fine
      for(const card of [0,90,180,270,360]){          // magnet to cardinals
        if(Math.abs(ang-card) < 4){ ang = card%360; break; }
      }
      rotateTo(p, ang);
      placePiece(el, p);
      rotBadge.hidden = false;
      rotBadge.textContent = Math.round(p.rot) + "°";
      rotBadge.style.left = (ev.clientX + 16)+"px";
      rotBadge.style.top  = (ev.clientY - 10)+"px";
    }
    function up(ev){
      el.classList.remove("rotating");
      try{ el.releasePointerCapture(ev.pointerId); }catch(_){}
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      rotBadge.hidden = true;
      render(); save();
    }
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }

  // returns array of guide descriptors {axis:'x'|'y', at:cm}
  function applySnap(p){
    const SNAP = 9/scale; // cm threshold
    const me = box(p);
    const guides = [];

    // candidate adjustments for x and y, independently choose nearest
    let bestX = null, bestY = null;
    const wallY = currentWallY(p);

    pieces.forEach(o=>{
      if(o.id===p.id) return;
      const ob = box(o);
      // X: align left-right edges & shared edges
      [ [me.l, ob.l], [me.l, ob.r], [me.r, ob.l], [me.r, ob.r] ].forEach(pair=>{
        const d = pair[0]-pair[1];
        if(Math.abs(d) < SNAP){
          if(bestX===null || Math.abs(d) < Math.abs(bestX.d)){ bestX = { d, at: pair[1] }; }
        }
      });
      // Y: align top-bottom edges & shared edges
      [ [me.t, ob.t], [me.t, ob.b], [me.b, ob.t], [me.b, ob.b] ].forEach(pair=>{
        const d = pair[0]-pair[1];
        if(Math.abs(d) < SNAP){
          if(bestY===null || Math.abs(d) < Math.abs(bestY.d)){ bestY = { d, at: pair[1] }; }
        }
      });
    });

    // room walls as snap candidates
    if(room.on){
      const rb = roomBox();
      [ [me.l, rb.l], [me.r, rb.r] ].forEach(pair=>{
        const d = pair[0]-pair[1];
        if(Math.abs(d) < SNAP && (bestX===null || Math.abs(d) < Math.abs(bestX.d))){ bestX = { d, at: pair[1] }; }
      });
      [ [me.t, rb.t], [me.b, rb.b] ].forEach(pair=>{
        const d = pair[0]-pair[1];
        if(Math.abs(d) < SNAP && (bestY===null || Math.abs(d) < Math.abs(bestY.d))){ bestY = { d, at: pair[1] }; }
      });
    }

    // back wall as Y candidate
    {
      const d = me.t - wallY;
      if(Math.abs(d) < SNAP && (bestY===null || Math.abs(d) < Math.abs(bestY.d))){
        bestY = { d, at: wallY };
      }
    }

    if(bestX){ p.x -= bestX.d; guides.push({ axis:'x', at:bestX.at }); }
    if(bestY){ p.y -= bestY.d; guides.push({ axis:'y', at:bestY.at }); }
    return guides;
  }
  function currentWallY(excl){
    let t = Infinity;
    pieces.forEach(p=>{ if(p.id!==excl.id){ t = Math.min(t, box(p).t); } });
    return t===Infinity ? BACK_MARGIN : t;
  }

  function drawGuides(guides){
    clearGuides();
    const b = bounds();
    const ext = world;
    guides.forEach(g=>{
      const el = document.createElement("div");
      el.className = "guide";
      if(g.axis==='x'){
        el.style.left = (g.at*scale - 0.5)+"px"; el.style.top = "0"; el.style.width="1px"; el.style.height= world.style.height;
      } else {
        el.style.top = (g.at*scale - 0.5)+"px"; el.style.left="0"; el.style.height="1px"; el.style.width= world.style.width;
      }
      world.appendChild(el);
    });
  }
  function clearGuides(){ world.querySelectorAll(".guide").forEach(n=>n.remove()); }

  // ---------- Selection on empty click ----------
  wrap.addEventListener("pointerdown", e=>{
    if(e.target === wrap || e.target === world || e.target.classList.contains("backwall") ||
       e.target.classList.contains("room-floor") || e.target.classList.contains("room-wall")){
      selectedId = null; selectedOpening = null; render();
    }
  });

  // ---------- Keyboard ----------
  window.addEventListener("keydown", e=>{
    if(e.target.tagName === "INPUT") return;
    if(selectedId===null){
      if(selectedOpening!=null && (e.key==="Backspace" || e.key==="Delete")){
        e.preventDefault();
        room.openings = room.openings.filter(o=>o.id!==selectedOpening);
        selectedOpening = null; render(); save();
      } else if(selectedOpening!=null && e.key==="Escape"){ selectedOpening=null; render(); }
      return;
    }
    if(e.key==="Backspace" || e.key==="Delete"){ e.preventDefault(); removePiece(selectedId); }
    else if(e.key==="r" || e.key==="R"){ rotate(selectedId); }
    else if(e.key==="d" || e.key==="D"){ duplicate(selectedId); }
    else if(e.key==="Escape"){ selectedId=null; render(); }
  });

  // ---------- Zoom / fit ----------
  const zoomEl = document.getElementById("zoom");
  zoomEl.addEventListener("input", e=>{
    scale = +e.target.value; render();
  });
  function stepZoom(delta){
    const min = +zoomEl.min, max = +zoomEl.max;
    scale = Math.max(min, Math.min(max, +(scale + delta).toFixed(2)));
    zoomEl.value = scale;
    render(); save();
  }
  document.getElementById("zoomIn").addEventListener("click", ()=> stepZoom(0.4));
  document.getElementById("zoomOut").addEventListener("click", ()=> stepZoom(-0.4));
  document.getElementById("fit").addEventListener("click", fitView);
  // Union of the sofa and (when shown) the room — what "Fit" should frame
  function contentBounds(){
    const b = bounds();
    if(room.on){
      const rb = roomBox();
      if(!b) return { l:rb.l, t:rb.t, r:rb.r, b:rb.b, w:rb.w, h:rb.h };
      const l=Math.min(b.l,rb.l), t=Math.min(b.t,rb.t), r=Math.max(b.r,rb.r), bot=Math.max(b.b,rb.b);
      return { l, t, r, b:bot, w:r-l, h:bot-t };
    }
    return b;
  }
  function fitView(){
    const cb = contentBounds();
    if(!cb){ return; }
    const padPx = 64;
    // gutters reserve room for the dimension labels drawn to the left / above
    const GL = 128, GT = 64;
    const sx = (wrap.clientWidth  - padPx*2 - GL) / cb.w;
    const sy = (wrap.clientHeight - padPx*2 - GT) / cb.h;
    scale = Math.max(0.2, Math.min(5, Math.min(sx, sy)));
    // dynamically shrink slider min so it can reach this zoom level
    const zEl = document.getElementById("zoom");
    zEl.min = Math.min(0.2, +scale.toFixed(2)).toString();
    zEl.value = scale.toFixed(2);
    render();
    requestAnimationFrame(()=>{
      const cc = contentBounds();
      const contentW = cc.w*scale + GL;
      const contentH = cc.h*scale + GT;
      wrap.scrollTo({
        left: cc.l*scale - GL - Math.max(0, (wrap.clientWidth  - contentW)/2),
        top:  cc.t*scale - GT - Math.max(0, (wrap.clientHeight - contentH)/2)
      });
    });
  }

  document.getElementById("clear").addEventListener("click", ()=>{
    if(!pieces.length) return;
    if(confirm("Clear the whole layout?")){ pieces=[]; selectedId=null; render(); save(); }
  });

  // ---------- Print ----------
  const printMenu = document.getElementById("printMenu");
  const printBtn = document.getElementById("print");
  printBtn.addEventListener("click", e=>{
    e.stopPropagation();
    printMenu.hidden = !printMenu.hidden;
  });
  printMenu.addEventListener("click", e=>{
    const btn = e.target.closest("button[data-mode]");
    if(!btn) return;
    printMenu.hidden = true;
    if(btn.dataset.mode === "form") buildOrderForm();
    else buildPrint();
  });
  document.addEventListener("click", ()=> { printMenu.hidden = true; });

  function buildPrint(){
    const sheet = document.getElementById("printSheet");
    const b = bounds();
    if(!b){ alert("Add some pieces first."); return; }
    sheet.className = "";

    // scale to fit ~640px wide print canvas — include the room when shown
    const ref = room.on ? roomBox() : b;
    const ub = { l:Math.min(b.l, ref.l), t:Math.min(b.t, ref.t), r:Math.max(b.r, ref.r), b:Math.max(b.b, ref.b) };
    ub.w = ub.r - ub.l; ub.h = ub.b - ub.t;
    const PW = 640, PHmax = 760;
    const ps = Math.min(PW / ub.w, PHmax / ub.h);
    const cw = ref.w*ps, ch = ref.h*ps;        // dimension span
    const fullW = ub.w*ps, fullH = ub.h*ps;    // full canvas span
    const padT = 36;  // top room for the width dimension
    const padL = 74;  // left room for the depth dimension label

    // room outline (behind pieces) — polygon supports L-shaped corners + openings
    let roomBlock = "";
    if(room.on){
      const rx = (ref.l - ub.l)*ps + padL, ry = (ref.t - ub.t)*ps + padT;
      const rbp = roomBox();
      const poly = roomPolygon().map(p=> ((p.x-rbp.l)*ps)+","+((p.y-rbp.t)*ps)).join(" ");
      const wallW = Math.max(3, 5*ps);
      let opM = "";
      (room.openings||[]).forEach(o=>{
        const H = sideIsH(o.side);
        const lc = (sideConst(o.side, rbp) - (H?rbp.t:rbp.l))*ps;
        const st = (o.center - o.len/2)*ps, ln = o.len*ps, th = wallW+1.5;
        let bx,by,bw,bh;
        if(H){ bx=st; by=lc-th/2; bw=ln; bh=th; } else { bx=lc-th/2; by=st; bw=th; bh=ln; }
        const col = o.kind==="window" ? "#cdd9ea" : "#ffffff";
        opM += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${col}" stroke="#888" stroke-width="0.6"/>`;
        if(o.kind==="door"){
          const into = intoSign(o.side);
          let hinge, along, perp;
          if(H){ hinge={x:bx,y:lc}; along={x:1,y:0}; perp={x:0,y:into}; }
          else { hinge={x:lc,y:by}; along={x:0,y:1}; perp={x:into,y:0}; }
          const lt={x:hinge.x+perp.x*ln,y:hinge.y+perp.y*ln}, oj={x:hinge.x+along.x*ln,y:hinge.y+along.y*ln};
          const sweep = ((lt.x-hinge.x)*(oj.y-hinge.y)-(lt.y-hinge.y)*(oj.x-hinge.x))>0?1:0;
          opM += `<path d="M ${lt.x} ${lt.y} A ${ln} ${ln} 0 0 ${sweep} ${oj.x} ${oj.y}" fill="none" stroke="#999" stroke-width="0.7" stroke-dasharray="2 2"/>`;
          opM += `<path d="M ${hinge.x} ${hinge.y} L ${lt.x} ${lt.y}" fill="none" stroke="#555" stroke-width="1"/>`;
        }
      });
      roomBlock = `<div class="proom" data-style="left:${rx}px;top:${ry}px;width:${ref.w*ps}px;height:${ref.h*ps}px;">`+
        `<svg width="100%" height="100%" data-style="position:absolute;inset:0;overflow:visible">`+
        `<polygon points="${poly}" fill="#f3efe7"/>`+
        `<polygon points="${poly}" fill="none" stroke="#8c8378" stroke-width="${wallW}" stroke-linejoin="miter"/>`+
        opM+
        `</svg>`+
        `<span class="proom-tag">Back wall</span></div>`;
    }

    let blocks = "";
    sofaPieces().forEach(p=>{
      const c = centre(p), hue = HUE[p.type];
      const w = p.w*ps, h = p.d*ps;
      const x = (c.x - p.w/2 - ub.l)*ps + padL, y = (c.y - p.d/2 - ub.t)*ps + padT;
      const small = (w < 46) || (h < 34);
      blocks += `<div class="pp" data-style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;transform:rotate(${p.rot||0}deg);transform-origin:50% 50%;background:${fill(hue)};border-color:${stroke(hue)};color:${textc(hue)}">`+
                `<div data-style="transform:rotate(${-(p.rot||0)}deg)">${small?'':`<div class="nm">${p.name}</div>`}<div class="dm">${disp(p.w)}×${disp(p.d)}</div></div></div>`;
    });

    // overall dimension lines (room when shown, else sofa)
    const rdx = (ref.l - ub.l)*ps + padL, rdy = (ref.t - ub.t)*ps + padT;
    const wy = rdy - 18;          // width line sits above the plan
    const lx = rdx - 18;          // depth line sits left of the plan
    const dimW = `<div class="pdim"><div class="ln" data-style="left:${rdx}px;top:${wy}px;width:${cw}px;height:1px;"></div>`+
      `<div class="ln" data-style="left:${rdx}px;top:${wy-4}px;width:1px;height:9px;"></div>`+
      `<div class="ln" data-style="left:${rdx+cw}px;top:${wy-4}px;width:1px;height:9px;"></div>`+
      `<div class="vv" data-style="left:${rdx+cw/2}px;top:${wy-8}px;transform:translateX(-50%);">${room.on?roomDisp(ref.w)+' '+roomUname():disp(ref.w)+' '+uname()}</div></div>`;
    const dimD = `<div class="pdim"><div class="ln" data-style="left:${lx}px;top:${rdy}px;width:1px;height:${ch}px;"></div>`+
      `<div class="ln" data-style="left:${lx-4}px;top:${rdy}px;width:9px;height:1px;"></div>`+
      `<div class="ln" data-style="left:${lx-4}px;top:${rdy+ch}px;width:9px;height:1px;"></div>`+
      `<div class="vv" data-style="left:${lx-7}px;top:${rdy+ch/2}px;transform:translate(-100%,-50%);">${room.on?roomDisp(ref.h)+' '+roomUname():disp(ref.h)+' '+uname()}</div></div>`;

    // parts list (grouped by name + size)
    const counts = {};
    sofaPieces().forEach(p=>{ const key = `${p.name}__${p.w}×${p.d}`; counts[key] = (counts[key]||0)+1; });
    let rows = "";
    Object.keys(counts).sort().forEach(key=>{
      const [name,size] = key.split("__");
      const [cw2,cd2] = size.split("×").map(Number);
      rows += `<tr><td>${name}</td><td>${disp(cw2)} × ${disp(cd2)} ${uname()}</td><td class="qty">${counts[key]}</td></tr>`;
    });

    const today = new Date().toLocaleDateString();
    const roomMeta = room.on ? ` · Room ${roomDisp(room.w)} × ${roomDisp(room.d)} ${roomUname()}` : "";
    sheet.innerHTML = `
      <div class="p-title">${sofaName}</div>
      <div class="p-meta">Overall ${disp(b.w)} × ${disp(b.h)} ${uname()} · ${sofaPieces().length} sections${roomMeta} · ${today}</div>
      <div class="p-canvas" data-style="width:${fullW+padL+12}px;height:${fullH+padT+12}px;">
        ${dimW}${dimD}${roomBlock}${blocks}
      </div>
      <div class="p-list-title">Parts list</div>
      <table>
        <thead><tr><th>Section</th><th>Size</th><th class="qty">Qty</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    SofaPlannerCSP.applyDataStyles(sheet); // CSP fix, see INLINE_FIXES.md
    window.print();
  }

  // ---------- General Custom Order Form ----------
  function dotsLines(n){
    let s = "";
    for(let i=0;i<n;i++) s += `<div class="ln"></div>`;
    return s;
  }
  function buildOrderForm(){
    const sheet = document.getElementById("printSheet");
    const b = bounds();
    sheet.className = "mode-form";

    // Render the plan into the drawing box (centered, scaled to fit)
    const BOXW = 300, BOXH = 300;
    let drawing = `<div class="empty-note">No layout yet</div>`;
    if(b){
      const ps = Math.min(BOXW / b.w, BOXH / b.h);
      const cw = b.w*ps, ch = b.h*ps;
      const offX = (BOXW - cw)/2, offY = (BOXH - ch)/2;
      let blocks = "";
      sofaPieces().forEach(p=>{
        const c = centre(p), hue = HUE[p.type];
        const w = p.w*ps, h = p.d*ps;
        const x = (c.x - p.w/2 - b.l)*ps + offX, y = (c.y - p.d/2 - b.t)*ps + offY;
        const small = (w < 40) || (h < 26);
        blocks += `<div class="pp" data-style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;transform:rotate(${p.rot||0}deg);transform-origin:50% 50%;background:${fill(hue)};border-color:${stroke(hue)};color:${textc(hue)}">`+
                  `<div data-style="transform:rotate(${-(p.rot||0)}deg)">${small?'':`<div class="nm">${p.name}</div>`}<div class="dm">${disp(p.w)}×${disp(p.d)}</div></div></div>`;
      });
      drawing = blocks;
    }

    const lengthVal = b ? `${disp(b.w)} ${uname()}` : "";
    const widthVal  = b ? `${disp(b.h)} ${uname()}` : "";

    sheet.innerHTML = `
      <div class="of-head">
        <div class="of-title">General Custom Order Form</div>
        <div class="of-logo"><img src="data:image/png;base64,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" alt="Levida" /></div>
      </div>

      <div class="of-cols2">
        <div class="of-col">
          <div class="of-h">Customer Information</div>
          <div class="of-field"><span class="lab">Name:</span><span class="dots"></span></div>
          <div class="of-field"><span class="lab">Invoice#:</span><span class="dots"></span></div>
          <div class="of-field"><span class="lab">Email:</span><span class="dots"></span></div>
          <div class="of-field"><span class="lab">Phone:</span><span class="dots"></span></div>
        </div>
        <div class="of-col">
          <div class="of-h">Shipping Address</div>
          <div class="of-field"><span class="lab">Street:</span><span class="dots"></span></div>
          <div class="of-field"><span class="lab">City:</span><span class="dots"></span></div>
          <div class="of-field"><span class="lab">State / Province:</span><span class="dots"></span></div>
          <div class="of-field"><span class="lab">Zip Code:</span><span class="dots"></span></div>
        </div>
      </div>

      <div class="of-product"><b>Product Name:</b><span class="dots val">${b ? sofaName : ""}</span></div>

      <div class="of-cols3">
        <div class="of-cell"><div class="of-h2">Coating:</div></div>
        <div class="of-cell"><div class="of-h2">Materials:</div></div>
        <div class="of-cell"><div class="of-h2">Others:</div></div>
      </div>

      <div class="of-cols2 of-draw-row">
        <div class="of-col of-draw-col">
          <div class="of-h2">Drawing Box:</div>
          <div class="of-drawing">${drawing}</div>
          <div class="of-dims">
            <span class="lab">Total, Length:</span><span class="dots-sm">${lengthVal}</span>
            <span class="lab">Width:</span><span class="dots-sm">${widthVal}</span>
          </div>
        </div>
        <div class="of-col">
          <div class="of-h2">Special Instructions or Requests:</div>
          <div class="of-lines">${dotsLines(13)}</div>
        </div>
      </div>

      <div class="of-terms">
        <div class="of-h2">Terms and Conditions:</div>
        <div class="agree"><span class="lab">I,</span><span class="dots"></span><span class="lab">agree to the Full terms and conditions of The Levida Sales Agreement.</span></div>
        <div class="of-final">All Custom Orders are Final Sale.</div>
        <div class="of-sig">
          <span class="lab">Signature:</span><span class="dots"></span>
          <span class="date"><span class="lab">Date:</span><span class="dots"></span></span>
        </div>
      </div>

      <div class="of-internal">
        <div class="row"><span class="lab">Internal Note:</span><span class="dots"></span></div>
        <div class="row"><span class="dots"></span></div>
        <div class="row last"><span class="lab">Supervisor:</span><span class="dots"></span>
          <span class="date"><span class="lab">Date:</span><span class="dots"></span></span>
        </div>
      </div>
    `;
    SofaPlannerCSP.applyDataStyles(sheet); // CSP fix, see INLINE_FIXES.md
    window.print();
  }

  // ---------- Sofa name picker ----------
  const nameBtn = document.getElementById("nameBtn");
  const nameMenu = document.getElementById("nameMenu");
  const nameList = document.getElementById("nameList");
  const nameCurrent = document.getElementById("nameCurrent");

  function saveNames(){
    try{ SofaPlannerStorage.setItem(NAME_STORE, JSON.stringify({ names:sofaNames, selected:sofaName })); }catch(_){}
  }
  function loadNames(){
    try{
      const raw = SofaPlannerStorage.getItem(NAME_STORE);
      if(raw){ const d = JSON.parse(raw);
        if(d && Array.isArray(d.names) && d.names.length){ sofaNames = d.names; }
        if(d && d.selected){ sofaName = d.selected; }
        if(!sofaNames.includes(sofaName)) sofaName = sofaNames[0];
      }
    }catch(_){}
  }
  function setSofaName(n){ sofaName = n; nameCurrent.textContent = n; saveNames(); }

  function renderNameList(){
    nameList.innerHTML = "";
    sofaNames.forEach((n, i)=>{
      const row = document.createElement("div");
      row.className = "name-row" + (n===sofaName ? " active":"");
      const pick = document.createElement("button");
      pick.className = "pick"; pick.textContent = n; pick.title = n;
      pick.addEventListener("click", ()=>{ setSofaName(n); closeNameMenu(); });
      // rename via edit button -> contenteditable-style inline
      const edit = document.createElement("button");
      edit.className = "mini"; edit.innerHTML = "✎"; edit.title = "Rename";
      edit.addEventListener("click", e=>{
        e.stopPropagation();
        startRename(pick, i);
      });
      const del = document.createElement("button");
      del.className = "mini del"; del.innerHTML = "×"; del.title = "Remove";
      del.addEventListener("click", e=>{
        e.stopPropagation();
        if(sofaNames.length<=1) return;
        const wasSel = sofaNames[i]===sofaName;
        sofaNames.splice(i,1);
        if(wasSel) setSofaName(sofaNames[0]);
        saveNames(); renderNameList();
      });
      row.appendChild(pick); row.appendChild(edit); row.appendChild(del);
      nameList.appendChild(row);
    });
  }

  function startRename(pickEl, i){
    pickEl.setAttribute("contenteditable","true");
    pickEl.focus();
    // select all text
    const r = document.createRange(); r.selectNodeContents(pickEl);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    const finish = (commit)=>{
      pickEl.removeAttribute("contenteditable");
      let val = pickEl.textContent.trim();
      if(commit && val){
        const old = sofaNames[i];
        sofaNames[i] = val;
        if(old===sofaName) setSofaName(val);
        saveNames();
      } else { pickEl.textContent = sofaNames[i]; }
      renderNameList();
    };
    pickEl.addEventListener("keydown", function kd(e){
      if(e.key===" " || e.key==="Spacebar"){
        // buttons treat Space as a click — insert a real space instead
        e.preventDefault();
        document.execCommand("insertText", false, " ");
      }
      else if(e.key==="Enter"){ e.preventDefault(); pickEl.removeEventListener("keydown",kd); finish(true); }
      else if(e.key==="Escape"){ e.preventDefault(); pickEl.removeEventListener("keydown",kd); finish(false); }
    });
    pickEl.addEventListener("blur", function bl(){ pickEl.removeEventListener("blur",bl); finish(true); }, { once:true });
  }

  function openNameMenu(){ renderNameList(); nameMenu.hidden = false; }
  function closeNameMenu(){ nameMenu.hidden = true; }
  nameBtn.addEventListener("click", e=>{ e.stopPropagation(); nameMenu.hidden ? openNameMenu() : closeNameMenu(); });
  nameMenu.addEventListener("click", e=> e.stopPropagation());
  document.addEventListener("click", ()=> closeNameMenu());
  document.getElementById("nameAdd").addEventListener("click", ()=>{
    const base = "New Sofa"; let n = base, k=2;
    while(sofaNames.includes(n)){ n = base+" "+(k++); }
    sofaNames.push(n); saveNames(); renderNameList();
    // immediately rename the new one
    const rows = nameList.querySelectorAll(".name-row");
    const last = rows[rows.length-1];
    if(last) startRename(last.querySelector(".pick"), sofaNames.length-1);
  });

  // ---------- Palette collapse ----------
  const PANEL_STORE = "sofaPlanner.panel.v1";
  const mainEl = document.getElementById("main");
  const asideEl = document.getElementById("palette");
  const paletteToggle = document.getElementById("paletteToggle");
  const chevEl = paletteToggle.querySelector(".chev");
  function setPaletteCollapsed(collapsed){
    mainEl.classList.toggle("palette-collapsed", collapsed);
    // Drive layout with inline styles so it works regardless of cascade quirks
    if(collapsed){
      asideEl.style.flexBasis = "0px";
      asideEl.style.width = "0px";
      asideEl.style.paddingLeft = "0px";
      asideEl.style.paddingRight = "0px";
      asideEl.style.opacity = "0";
      asideEl.style.overflow = "hidden";
      asideEl.style.borderRightColor = "transparent";
      paletteToggle.style.left = "0px";
      paletteToggle.style.transform = "translateX(0)";
      chevEl.style.transform = "rotate(180deg)";
    } else {
      asideEl.style.flexBasis = "";
      asideEl.style.width = "";
      asideEl.style.paddingLeft = "";
      asideEl.style.paddingRight = "";
      asideEl.style.opacity = "";
      asideEl.style.overflow = "";
      asideEl.style.borderRightColor = "";
      paletteToggle.style.left = "";
      paletteToggle.style.transform = "";
      chevEl.style.transform = "";
    }
    paletteToggle.title = collapsed ? "Show pieces panel" : "Hide pieces panel";
    try{ SofaPlannerStorage.setItem(PANEL_STORE, collapsed ? "1" : "0"); }catch(_){}
  }
  paletteToggle.addEventListener("click", ()=>{
    setPaletteCollapsed(!mainEl.classList.contains("palette-collapsed"));
  });
  try{ if(SofaPlannerStorage.getItem(PANEL_STORE)==="1") setPaletteCollapsed(true); }catch(_){}

  // ---------- Persistence ----------
  function save(){
    try{ SofaPlannerStorage.setItem(STORE, JSON.stringify({ pieces, uid, scale, unit, room, origin:"v2" })); }catch(_){}
  }
  function load(){
    try{
      const raw = SofaPlannerStorage.getItem(STORE);
      if(!raw) return false;
      const d = JSON.parse(raw);
      if(d && Array.isArray(d.pieces)){
        pieces = d.pieces; uid = d.uid || (pieces.length+1);
        // migrate layouts saved before the origin shift so the sofa stays aligned to the room
        if(d.origin !== "v2"){
          pieces.forEach(p=>{ p.x += MIGRATE.dx; p.y += MIGRATE.dy; });
        }
        scale = d.scale || 2.4;
        if(d.unit==='cm' || d.unit==='in') unit = d.unit;
        if(d.room && typeof d.room === 'object'){
          room.on = !!d.room.on;
          room.w = clamp(+d.room.w || 400, 50, 2000);
          room.d = clamp(+d.room.d || 300, 50, 2000);
          if(['cm','ft','in'].includes(d.room.unit)) room.unit = d.room.unit;
          if(d.room.notches && typeof d.room.notches==='object'){
            ["tl","tr","br","bl"].forEach(c=>{
              const n = d.room.notches[c];
              if(n && typeof n==='object') room.notches[c] = { x:+n.x||0, y:+n.y||0 };
            });
          }
          clampNotches();
          if(Array.isArray(d.room.openings)){
            room.openings = d.room.openings
              .filter(o=> o && (o.kind==="door"||o.kind==="window") && ["top","bottom","left","right"].includes(o.side))
              .map(o=>({ id: openingUid++, kind:o.kind, side:o.side, center:+o.center||0, len:+o.len||DOOR_LEN }));
            clampOpenings();
          }
        }
        document.getElementById("zoom").value = scale;
        return true;
      }
    }catch(_){}
    return false;
  }

  // ---------- Init ----------
  buildPalette();
  buildRoomPresets();
  loadNames();
  nameCurrent.textContent = sofaName;
  const had = load();
  // sync unit UI to loaded state
  document.querySelectorAll("#unitSeg button").forEach(b=> b.classList.toggle("active", b.dataset.u===unit));
  document.querySelectorAll(".u-label").forEach(s=> s.textContent = unit);
  if(unit!=="cm"){ buildPalette(); buildRoomPresets(); }
  syncRoomUI();
  document.getElementById("foot-note").textContent = "Recliner sizes assumed — tell me the real dims to update";
  if(had) save(); // persist origin migration so it isn't re-applied next load
  render();
  if(had){ requestAnimationFrame(()=> { room.on ? fitView() : (()=>{ const b=bounds(); if(b) wrap.scrollTo({left:b.l*scale-80, top:b.t*scale-60}); })(); }); }
  else { wrap.scrollTo({ left: LEFT_MARGIN*scale-60, top: 0 }); }

})();
