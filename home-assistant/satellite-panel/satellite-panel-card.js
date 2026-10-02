/* satellite-panel-card — panel ścienny dla satelity Assist (VACA) z nakładką w stylu Pip-Boy */
const WX = {
  'clear-night': ['mdi:weather-night', 'Pogodnie'], cloudy: ['mdi:weather-cloudy', 'Pochmurno'],
  exceptional: ['mdi:alert-circle-outline', 'Uwaga'], fog: ['mdi:weather-fog', 'Mgła'],
  hail: ['mdi:weather-hail', 'Grad'], lightning: ['mdi:weather-lightning', 'Burza'],
  'lightning-rainy': ['mdi:weather-lightning-rainy', 'Burza z deszczem'],
  partlycloudy: ['mdi:weather-partly-cloudy', 'Częściowe zachmurzenie'], pouring: ['mdi:weather-pouring', 'Ulewa'],
  rainy: ['mdi:weather-rainy', 'Deszcz'], snowy: ['mdi:weather-snowy', 'Śnieg'],
  'snowy-rainy': ['mdi:weather-snowy-rainy', 'Deszcz ze śniegiem'], sunny: ['mdi:weather-sunny', 'Słonecznie'],
  windy: ['mdi:weather-windy', 'Wietrznie'], 'windy-variant': ['mdi:weather-windy-variant', 'Wietrznie'],
};
const VOICE = {
  listening: ['NASŁUCHUJĘ', 'Mów, słucham…'],
  processing: ['PRZETWARZAM', 'Analizuję polecenie…'],
  responding: ['WYKONUJĘ', 'Realizuję polecenie…'],
  done: ['WYKONANO', 'Gotowe.'],
};
const ACTIVE = ['listening', 'processing', 'responding'];
const ON = ['on', 'open', 'unlocked', 'playing', 'home', 'heat', 'cool'];

const PIP = `<svg class="pb" viewBox="0 0 72 52" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
<path d="M2 17h8M2 35h8"/><rect x="10" y="5" width="52" height="42" rx="7"/>
<rect class="scr" x="15" y="11" width="30" height="26" rx="3"/>
<circle cx="54" cy="17" r="4.2"/><path d="M54 14.5v2.5"/><circle cx="54" cy="32" r="3"/><path d="M62 13h4v9h-4M17 42h24"/>
<g class="s-idle"><path d="M20 19l4 3-4 3"/><path class="cur" d="M27 26h7"/></g>
<g class="s-listen"><path d="M21 24v0"/><path d="M25.5 20v8"/><path d="M30 16v16"/><path d="M34.5 20v8"/><path d="M39 24v0"/></g>
<g class="s-proc"><circle cx="30" cy="24" r="8"/><path class="ndl" d="M30 24l5-5"/></g>
<g class="s-resp"><path d="M20 20h20M20 25h14M20 30h17"/></g>
<g class="s-done"><path d="M22 24.5l5.5 5.5 11-12"/></g></svg>`;

const CSS = `
:host{display:block;--bg:#0d0f13;--tile:#1a1d24;--tile2:#22262f;--tx:#eceef1;--sub:#8d939e;--amber:#ffb84d;--red:#ff5d5d;--pb:#41ff8b;--pbd:#062b14;
 font-family:var(--paper-font-body1_-_font-family,Roboto,system-ui,sans-serif);color:var(--tx)}
*{box-sizing:border-box}
.root{background:var(--bg);min-height:calc(100vh - var(--header-height,0px));padding:18px 16px 16px;display:flex;flex-direction:column;gap:14px;
 -webkit-tap-highlight-color:transparent;user-select:none}
.top{display:flex;align-items:flex-start;justify-content:space-between}
.time{font-size:clamp(56px,20vw,120px);font-weight:200;line-height:.9;letter-spacing:-3px;font-variant-numeric:tabular-nums}
.date{font-size:clamp(15px,4.2vw,20px);color:var(--sub);margin-top:8px;text-transform:capitalize}
.pip{all:unset;cursor:pointer;width:72px;height:72px;border-radius:22px;display:grid;place-items:center;color:var(--pb);
 background:radial-gradient(circle at 50% 40%,#0b3b1d,var(--pbd));box-shadow:0 0 0 1px #1d6b3a inset,0 0 18px #41ff8b22;transition:.25s}
.pip .pb{width:52px;filter:drop-shadow(0 0 4px #41ff8b88)}
.wx{display:flex;align-items:center;gap:14px;background:var(--tile);border-radius:24px;padding:14px 18px}
.wx ha-icon{--mdc-icon-size:46px;color:var(--amber)}
.wxt{font-size:30px;font-weight:300}.wxs{font-size:14px;color:var(--sub)}
.info{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.chip{display:flex;align-items:center;gap:10px;background:var(--tile);border-radius:18px;padding:10px 12px;min-width:0}
.chip ha-icon{--mdc-icon-size:22px;color:var(--sub);flex:none}
.chip b{display:block;font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chip span{display:block;font-size:12px;color:var(--sub)}
.chip.warn{background:#3a1717}.chip.warn ha-icon,.chip.warn b{color:var(--red)}
h2{margin:4px 2px -6px;font-size:13px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:var(--sub)}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
@media (min-width:600px){.grid{grid-template-columns:repeat(3,1fr)}}
.tile{position:relative;background:var(--tile);border-radius:24px;padding:12px 14px;min-height:92px;display:flex;flex-direction:column;
 justify-content:space-between;cursor:pointer;transition:background .25s,transform .12s}
.tile:active{transform:scale(.96)}
.tile .ic{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--tile2);transition:.25s}
.tile .ic ha-icon{--mdc-icon-size:24px;color:var(--sub)}
.tile .nm{font-size:16px;font-weight:500;line-height:1.2}.tile .st{font-size:13px;color:var(--sub);margin-top:2px}
.tile.on{background:var(--amber);color:#1b1205}.tile.on .ic{background:#fff3}.tile.on .ic ha-icon{color:#1b1205}.tile.on .st{color:#1b1205b3}
.tile.na{opacity:.4}
.tile.cf::after,.sc.cf::after{content:'Dotknij ponownie';position:absolute;inset:0;border-radius:inherit;display:grid;place-items:center;
 background:#000c;color:var(--amber);font-weight:600;font-size:14px}
.scenes{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:12px}
.sc{position:relative;background:var(--tile);border-radius:20px;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;
 font-size:14px;cursor:pointer;text-align:center;transition:transform .12s}
.sc:active{transform:scale(.95)}.sc ha-icon{--mdc-icon-size:28px;color:var(--amber)}.sc.run{background:#3a2a0f}
.vbar{margin-top:auto;display:flex;align-items:center;gap:12px;background:var(--tile);border-radius:20px;padding:12px 14px;font-size:14px;color:var(--sub)}
.vbar ha-icon{color:var(--pb);flex:none}.vbar q{color:var(--tx)}.vbar div{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pb .scr{fill:currentColor;fill-opacity:.12}
.pb g{display:none}.root[data-v=idle] .s-idle,.root:not([data-v]) .s-idle{display:inline}
.root[data-v=listening] .s-listen,.root[data-v=processing] .s-proc,.root[data-v=responding] .s-resp,.root[data-v=done] .s-done{display:inline}
.cur{animation:blink 1.1s steps(1) infinite}
.s-listen path{transform-box:fill-box;transform-origin:center;animation:eq .7s ease-in-out infinite alternate}
.s-listen path:nth-child(2){animation-delay:-.2s}.s-listen path:nth-child(3){animation-delay:-.45s}.s-listen path:nth-child(4){animation-delay:-.1s}
.s-listen path:nth-child(1),.s-listen path:nth-child(5){stroke-width:3.4}
.ndl{transform-origin:30px 24px;animation:spin 1s linear infinite}
.s-resp path{stroke-dasharray:24;animation:type 1.2s steps(6) infinite}
.root[data-v=listening] .pip,.root[data-v=processing] .pip,.root[data-v=responding] .pip{animation:glow 1.2s ease-in-out infinite alternate}
.ov{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:#000d;
 opacity:0;pointer-events:none;transition:opacity .3s}
.ov.show{opacity:1;pointer-events:auto}
.crt{position:relative;width:100%;max-width:560px;min-height:72vh;border-radius:28px;padding:22px;overflow:hidden;color:var(--pb);
 font-family:'Share Tech Mono','VT323','Courier New',monospace;text-shadow:0 0 6px #41ff8baa;
 background:radial-gradient(ellipse at center,#0b3a1c 0%,#04170b 70%,#020a05 100%);box-shadow:0 0 0 3px #1b5c32,0 0 60px #41ff8b33;
 display:flex;flex-direction:column;gap:16px;transform:scale(.94);transition:transform .35s;animation:flick 4s infinite}
.ov.show .crt{transform:none}
.crt::before{content:'';position:absolute;inset:0;pointer-events:none;
 background:repeating-linear-gradient(0deg,#0000 0 2px,#0006 2px 4px);mix-blend-mode:multiply}
.crt::after{content:'';position:absolute;left:0;right:0;height:90px;top:-90px;pointer-events:none;
 background:linear-gradient(#41ff8b00,#41ff8b14,#41ff8b00);animation:scan 3.5s linear infinite}
.oh{display:flex;justify-content:space-between;font-size:13px;letter-spacing:2px;border-bottom:2px solid #41ff8b55;padding-bottom:8px}
.big{display:grid;place-items:center;margin-top:6px}.big .pb{width:min(52vw,230px);filter:drop-shadow(0 0 10px #41ff8b)}
.ot{text-align:center;font-size:clamp(30px,9vw,46px);letter-spacing:6px}.ot i{font-style:normal;animation:blink 1s steps(1) infinite}
.os{text-align:center;font-size:16px;opacity:.75;margin-top:-10px}
.wave{display:flex;gap:5px;justify-content:center;align-items:center;height:56px}
.wave i{width:6px;height:100%;background:var(--pb);border-radius:3px;box-shadow:0 0 6px var(--pb);transform:scaleY(.12);opacity:.35}
.crt[data-v=listening] .wave i{animation:eq .55s ease-in-out infinite alternate;opacity:1}
.prog{height:12px;border:2px solid var(--pb);border-radius:3px;padding:2px;display:none}
.prog b{display:block;height:100%;width:30%;background:repeating-linear-gradient(90deg,var(--pb) 0 8px,#0000 8px 11px);animation:load 1.3s ease-in-out infinite}
.crt[data-v=processing] .prog,.crt[data-v=responding] .prog{display:block}
.crt[data-v=processing] .wave,.crt[data-v=responding] .wave,.crt[data-v=done] .wave{display:none}
.ln{font-size:18px;line-height:1.35;min-height:1.35em;word-break:break-word}.ln u{text-decoration:none;opacity:.6;margin-right:8px}
.ln.r{display:none}.crt[data-v=responding] .ln.r,.crt[data-v=done] .ln.r{display:block}
.of{margin-top:auto;display:flex;justify-content:space-between;font-size:13px;letter-spacing:1.5px;opacity:.7;border-top:2px solid #41ff8b55;padding-top:8px}
@keyframes blink{50%{opacity:0}}
@keyframes eq{from{transform:scaleY(.25)}to{transform:scaleY(1)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes type{from{stroke-dashoffset:24}to{stroke-dashoffset:0}}
@keyframes glow{to{box-shadow:0 0 0 2px var(--pb) inset,0 0 34px #41ff8baa}}
@keyframes scan{to{top:100%}}
@keyframes load{0%{margin-left:0}50%{margin-left:70%}100%{margin-left:0}}
@keyframes flick{0%,96%,100%{opacity:1}97%{opacity:.86}98%{opacity:1}99%{opacity:.92}}`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

class SatellitePanelCard extends HTMLElement {
  setConfig(config) {
    if (!config.satellite) throw new Error('Podaj "satellite: assist_satellite.xxx"');
    const base = config.satellite.split('.')[1];
    this._c = {
      tiles: [], scenes: [], info: [], tiles_title: 'Urządzenia', scenes_title: 'Sceny', hold_ms: 3000,
      stt: `sensor.${base}_stt`, tts: `sensor.${base}_tts`, wake: `button.${base}_wake`, ...config,
    };
    this._built = false;
    if (this._h) this._render();
  }

  set hass(h) {
    this._h = h;
    this._render();
  }

  getCardSize() { return 12; }

  connectedCallback() {
    this._tick = setInterval(() => this._clock(), 1000);
    this._clock();
  }

  disconnectedCallback() {
    clearInterval(this._tick);
    clearTimeout(this._doneT);
  }

  _render() {
    if (!this._built) this._build();
    this._update();
  }

  _build() {
    const c = this._c;
    const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
    const tile = (t, i) => `<div class="tile" data-i="${i}"><div class="ic"><ha-icon></ha-icon></div><div><div class="nm"></div><div class="st"></div></div></div>`;
    root.innerHTML = `<style>${CSS}</style><div class="root" id="root">
<div class="top"><div><div class="time" id="time">--:--</div><div class="date" id="date"></div></div>
<button class="pip" id="pip" title="Wywołaj asystenta">${PIP}</button></div>
${c.weather ? '<div class="wx"><ha-icon id="wxi"></ha-icon><div><div class="wxt" id="wxt"></div><div class="wxs" id="wxs"></div></div></div>' : ''}
${c.info.length ? `<div class="info">${c.info.map((x, i) => `<div class="chip" data-i="${i}"><ha-icon></ha-icon><div style="min-width:0"><b></b><span>${esc(x.name || '')}</span></div></div>`).join('')}</div>` : ''}
${c.tiles.length ? `<h2>${esc(c.tiles_title)}</h2><div class="grid" id="tiles">${c.tiles.map(tile).join('')}</div>` : ''}
${c.scenes.length ? `<h2>${esc(c.scenes_title)}</h2><div class="scenes" id="scenes">${c.scenes.map((s, i) => `<div class="sc" data-i="${i}"><ha-icon icon="${esc(s.icon || 'mdi:play')}"></ha-icon>${esc(s.name || s.entity)}</div>`).join('')}</div>` : ''}
<div class="vbar" id="vbar"><ha-icon icon="mdi:microphone-message"></ha-icon><div id="vlast">Powiedz „${esc(c.wake_word || 'Okay Nabu')}” lub dotknij ikony</div></div>
<div class="ov" id="ov"><div class="crt" id="crt">
<div class="oh"><span>${esc((c.name || 'SATELITA').toUpperCase())} // TERMINAL GŁOSOWY</span><span id="oclk"></span></div>
<div class="big">${PIP}</div><div class="ot"><span id="ot"></span><i>_</i></div><div class="os" id="os"></div>
<div class="wave">${Array.from({ length: 22 }, (_, i) => `<i style="animation-delay:-${((i * 137) % 550) / 1000}s"></i>`).join('')}</div>
<div class="prog"><b></b></div>
<div class="ln"><u>&gt; TY:</u><span id="ls"></span></div><div class="ln r"><u>&gt; DOM:</u><span id="lr"></span></div>
<div class="of"><span>STATUS: <span id="ost"></span></span><span>SYS OK</span></div></div></div></div>`;
    const $ = (id) => root.getElementById(id);
    this._$ = $;
    $('pip').addEventListener('click', () => this._press(c.wake));
    $('vbar').addEventListener('click', () => this._press(c.wake));
    $('ov').addEventListener('click', () => { if (this._vs === 'done' || !ACTIVE.includes(this._vs)) this._hideVoice(); });
    root.querySelectorAll('.tile').forEach((el) => this._bindTile(el, c.tiles[+el.dataset.i]));
    root.querySelectorAll('.chip').forEach((el) => el.addEventListener('click', () => this._moreInfo(c.info[+el.dataset.i].entity)));
    root.querySelectorAll('.sc').forEach((el) => {
      const s = c.scenes[+el.dataset.i];
      el.addEventListener('click', () => this._confirm(el, s.confirm, () => {
        const [d] = s.entity.split('.');
        const svc = d === 'script' ? ['script', 'turn_on'] : d === 'scene' ? ['scene', 'turn_on'] : d === 'button' ? ['button', 'press'] : ['homeassistant', 'toggle'];
        this._h.callService(svc[0], svc[1], { entity_id: s.entity });
        el.classList.add('run');
        setTimeout(() => el.classList.remove('run'), 1200);
      }));
    });
    this._built = true;
    this._clock();
  }

  _bindTile(el, t) {
    let timer;
    let held = false;
    el.addEventListener('pointerdown', () => {
      held = false;
      timer = setTimeout(() => { held = true; this._moreInfo(t.entity); }, 550);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => el.addEventListener(e, () => clearTimeout(timer)));
    el.addEventListener('click', () => {
      if (held) return;
      this._confirm(el, t.confirm, () => {
        const [d] = t.entity.split('.');
        if (d === 'script' || d === 'scene') this._h.callService(d, 'turn_on', { entity_id: t.entity });
        else if (d === 'lock') this._h.callService('lock', this._h.states[t.entity]?.state === 'locked' ? 'unlock' : 'lock', { entity_id: t.entity });
        else this._h.callService('homeassistant', 'toggle', { entity_id: t.entity });
      });
    });
  }

  // Dwuetapowe potwierdzenie bez window.confirm (WebView w VACA go nie obsługuje pewnie)
  _confirm(el, needed, fn) {
    if (!needed || el.classList.contains('cf')) {
      el.classList.remove('cf');
      clearTimeout(el._cfT);
      fn();
      return;
    }
    el.classList.add('cf');
    el._cfT = setTimeout(() => el.classList.remove('cf'), 3000);
  }

  _press(entity) {
    if (this._h?.states[entity]) this._h.callService('button', 'press', { entity_id: entity });
  }

  _moreInfo(entityId) {
    this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
  }

  _fmt(st) {
    if (!st) return '—';
    try { return this._h.formatEntityState ? this._h.formatEntityState(st) : st.state; } catch (e) { return st.state; }
  }

  _clock() {
    if (!this._$) return;
    const now = new Date();
    const time = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    this._$('time').textContent = time;
    this._$('oclk').textContent = time;
    this._$('date').textContent = now.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  _update() {
    const h = this._h;
    const c = this._c;
    const $ = this._$;
    const root = this.shadowRoot;
    if (c.weather) {
      const w = h.states[c.weather];
      if (w) {
        const [icon, label] = WX[w.state] || ['mdi:weather-cloudy', w.state];
        $('wxi').setAttribute('icon', icon);
        $('wxt').textContent = `${Math.round(w.attributes.temperature)}°`;
        $('wxs').textContent = `${label} · wilgotność ${w.attributes.humidity ?? '–'}%`;
      }
    }
    root.querySelectorAll('.chip').forEach((el) => {
      const x = c.info[+el.dataset.i];
      const st = h.states[x.entity];
      const d = x.entity.split('.')[0];
      el.querySelector('ha-icon').setAttribute('icon', x.icon || st?.attributes.icon || 'mdi:information-outline');
      el.querySelector('b').textContent = this._fmt(st);
      const warn = x.warn ? x.warn.includes(st?.state) : (d === 'lock' && st?.state !== 'locked') || (d === 'binary_sensor' && st?.state === 'on');
      el.classList.toggle('warn', !!st && warn);
    });
    root.querySelectorAll('.tile').forEach((el) => {
      const t = c.tiles[+el.dataset.i];
      const st = h.states[t.entity];
      const on = !!st && ON.includes(st.state);
      el.classList.toggle('on', on);
      el.classList.toggle('na', !st || st.state === 'unavailable');
      el.querySelector('ha-icon').setAttribute('icon', (on && t.icon_on) || t.icon || st?.attributes.icon || 'mdi:power');
      el.querySelector('.nm').textContent = t.name || st?.attributes.friendly_name || t.entity;
      let txt = this._fmt(st);
      if (on && st.attributes.brightness != null) txt += ` · ${Math.round((st.attributes.brightness / 255) * 100)}%`;
      el.querySelector('.st').textContent = txt;
    });
    this._voice();
  }

  _voice() {
    const h = this._h;
    const c = this._c;
    const sat = h.states[c.satellite];
    const s = sat?.state;
    if (ACTIVE.includes(s)) {
      // czas serwera HA, żeby nie zależeć od zegara telefonu
      if (!ACTIVE.includes(this._vs)) this._vStart = new Date(sat.last_changed).getTime() - 500;
      clearTimeout(this._doneT);
      this._doneT = null;
      this._setVoice(s);
    } else if (ACTIVE.includes(this._vs)) {
      this._setVoice('done');
      this._doneT = setTimeout(() => this._hideVoice(), c.hold_ms);
    } else if (this._vs === 'done') {
      this._setVoice('done');
    }
    const stt = h.states[c.stt];
    const tts = h.states[c.tts];
    const fresh = (st) => (st && this._vStart && new Date(st.last_changed).getTime() >= this._vStart ? st.state : '');
    if (this._vs && this._vs !== 'idle') {
      this._$('ls').textContent = fresh(stt) || (this._vs === 'listening' ? '…' : '');
      this._$('lr').textContent = fresh(tts) || '…';
    }
    if (stt && stt.state && !['unknown', 'unavailable'].includes(stt.state)) {
      const r = tts && !['unknown', 'unavailable'].includes(tts.state) ? ` → ${esc(tts.state)}` : '';
      this._$('vlast').innerHTML = `Ostatnio: <q>${esc(stt.state)}</q>${r}`;
    }
  }

  _setVoice(v) {
    this._vs = v;
    const $ = this._$;
    $('root').dataset.v = v;
    $('crt').dataset.v = v;
    $('ov').classList.add('show');
    $('ot').textContent = VOICE[v][0];
    $('os').textContent = VOICE[v][1];
    $('ost').textContent = v === 'done' ? 'ZAKOŃCZONO' : `${VOICE[v][0]}…`;
  }

  _hideVoice() {
    this._vs = 'idle';
    clearTimeout(this._doneT);
    this._$('ov').classList.remove('show');
    this._$('root').dataset.v = 'idle';
  }
}

if (!customElements.get('satellite-panel-card')) customElements.define('satellite-panel-card', SatellitePanelCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'satellite-panel-card', name: 'Satellite Panel', description: 'Panel ścienny dla satelity Assist ze wskaźnikiem Pip-Boy' });
