/* js/assetLoader.js — versão corrigida
 *
 * Mudanças em relação à versão antiga:
 *  - virou CLASSE (main.js faz `new AssetLoader()`)
 *  - loadAll(assets, onProgress) devolve PROMISE (main.js faz `.then()`)
 *  - ganhou playSfx() / stopSfx() / stopAll(), que game.js chama
 *  - getImage() só devolve a imagem se ela realmente carregou
 */
class AssetLoader {
  constructor() {
    this.images = {};
    this.audio = {};
    this.failed = [];
    this._playing = new Set();
  }

  /**
   * Carrega tudo e resolve quando terminar (ou quando estourar o timeout).
   * Nunca rejeita: asset quebrado vira aviso no console, não trava o jogo.
   * @param {object} assets  normalmente window.ASSETS
   * @param {(done:number,total:number)=>void} [onProgress]
   * @returns {Promise<AssetLoader>}
   */
  loadAll(assets, onProgress) {
    const src = assets || window.ASSETS || {};
    const jobs = [];

    const walkImages = (obj, target) => {
      Object.keys(obj || {}).forEach((key) => {
        const value = obj[key];
        if (typeof value === 'string') {
          jobs.push(this._loadImage(value, target, key));
        } else if (value && typeof value === 'object') {
          target[key] = {};
          walkImages(value, target[key]);
        }
      });
    };
    walkImages(src.images, this.images);

    Object.keys(src.audio || {}).forEach((key) => {
      jobs.push(this._loadAudio(src.audio[key], key));
    });

    const total = jobs.length;
    let done = 0;
    const tick = () => {
      done += 1;
      if (typeof onProgress === 'function') {
        try { onProgress(done, total); } catch (e) { console.warn('[AssetLoader] onProgress falhou:', e); }
      }
    };
    jobs.forEach((p) => p.then(tick));

    // Promise.resolve() garante que o .then() do chamador rode sempre de forma
    // assíncrona, mesmo quando não há nenhum asset para carregar.
    return Promise.resolve()
      .then(() => Promise.all(jobs))
      .then(() => {
        if (this.failed.length) {
          console.warn(`[AssetLoader] ${this.failed.length} asset(s) não carregaram:`, this.failed);
        }
        return this;
      });
  }

  _loadImage(url, target, key) {
    return new Promise((resolve) => {
      const img = new Image();
      target[key] = img;

      let settled = false;
      let timer = null;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!ok) this.failed.push(url);
        resolve();
      };

      img.addEventListener('load', () => finish(true), { once: true });
      img.addEventListener('error', () => finish(false), { once: true });
      img.src = url;

      // Se o download demorar demais, seguimos em frente. A imagem continua
      // baixando em segundo plano e getImage() passa a devolvê-la quando ficar pronta.
      timer = setTimeout(() => finish(true), AssetLoader.TIMEOUT_MS);
    });
  }

  _loadAudio(url, key) {
    return new Promise((resolve) => {
      const snd = new Audio();
      snd.preload = 'auto';
      this.audio[key] = snd;

      let settled = false;
      let timer = null;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!ok) {
          this.failed.push(url);
          this.audio[key] = null;
        }
        resolve();
      };

      // canplaythrough não dispara em vários navegadores móveis — loadeddata cobre isso.
      snd.addEventListener('canplaythrough', () => finish(true), { once: true });
      snd.addEventListener('loadeddata', () => finish(true), { once: true });
      snd.addEventListener('error', () => finish(false), { once: true });

      snd.src = url;
      snd.load();
      timer = setTimeout(() => finish(true), AssetLoader.TIMEOUT_MS);
    });
  }

  /** getImage('escritorio.centro') → HTMLImageElement pronta, ou null. */
  getImage(keyPath) {
    const node = String(keyPath || '')
      .split('.')
      .reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : null), this.images);

    if (!(node instanceof HTMLImageElement)) return null;
    return node.complete && node.naturalWidth > 0 ? node : null;
  }

  getAudio(key) {
    return this.audio[key] || null;
  }

  /**
   * playSfx('jumpscare', { volume: 1 })
   * playSfx('ambience', { loop: true, volume: 0.5 })
   * Sons pontuais tocam em cópias, então vários podem se sobrepor.
   */
  playSfx(key, options) {
    const { loop = false, volume = 1, restart = true } = options || {};
    const base = this.audio[key];
    if (!base) {
      console.warn(`[AssetLoader] som "${key}" não existe em ASSETS.audio`);
      return null;
    }

    try {
      if (loop) {
        base.loop = true;
        base.volume = volume;
        if (restart) { try { base.currentTime = 0; } catch (e) { /* ainda não é seekable */ } }
        const p = base.play();
        if (p && p.catch) p.catch(() => {});
        this._playing.add(base);
        return base;
      }

      const shot = base.cloneNode(true);
      shot.volume = volume;
      const p = shot.play();
      if (p && p.catch) p.catch(() => {});
      this._playing.add(shot);
      shot.addEventListener('ended', () => this._playing.delete(shot), { once: true });
      return shot;
    } catch (e) {
      console.warn(`[AssetLoader] playSfx("${key}") falhou:`, e);
      return null;
    }
  }

  stopSfx(key) {
    const snd = this.audio[key];
    if (!snd) return;
    try { snd.pause(); snd.currentTime = 0; } catch (e) { /* ignora */ }
    this._playing.delete(snd);
  }

  /** Corta tudo — use ao voltar para o menu, senão a ambiência fica tocando. */
  stopAll() {
    this._playing.forEach((snd) => {
      try { snd.pause(); snd.currentTime = 0; } catch (e) { /* ignora */ }
    });
    this._playing.clear();
  }
}

AssetLoader.TIMEOUT_MS = 8000;

window.AssetLoader = AssetLoader;
