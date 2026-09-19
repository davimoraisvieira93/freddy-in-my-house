/* js/assetLoader.js
 * Carrega as imagens listadas em ASSETS.images (achatando o objeto aninhado
 * em chaves tipo "enemies.freddy.cam8") e guarda os caminhos de ASSETS.audio
 * para tocar sob demanda. playSfx('ambience', {loop:true}) reaproveita a
 * mesma instância; qualquer outro som cria uma instância nova (permite sons
 * sobrepostos, tipo knock + risada ao mesmo tempo).
 */
class AssetLoader {
  constructor() {
    this.images = {};
    this.audioSrc = {};
    this.loopInstances = {};
  }

  loadAll(assets, onProgress) {
    const entries = [];
    const walk = (obj, prefix) => {
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'string') entries.push([key, v]);
        else walk(v, key);
      }
    };
    walk(assets.images || {}, '');
    Object.assign(this.audioSrc, assets.audio || {});

    const total = entries.length;
    let done = 0;
    onProgress && onProgress(0, total);

    if (!total) return Promise.resolve();

    return Promise.all(
      entries.map(
        ([key, src]) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              this.images[key] = img;
              done++;
              onProgress && onProgress(done, total);
              resolve();
            };
            img.onerror = () => {
              console.warn(`[assetLoader] falhou ao carregar ${key}: ${src}`);
              done++;
              onProgress && onProgress(done, total);
              resolve();
            };
            img.src = src;
          }),
      ),
    );
  }

  getImage(key) {
    return this.images[key] || null;
  }

  playSfx(name, { loop = false, volume = 1 } = {}) {
    const src = this.audioSrc[name];
    if (!src) return null;

    if (loop) {
      let audio = this.loopInstances[name];
      if (!audio) {
        audio = new Audio(src);
        audio.loop = true;
        this.loopInstances[name] = audio;
      }
      audio.volume = volume;
      audio.play().catch(() => {});
      return audio;
    }

    const audio = new Audio(src);
    audio.volume = volume;
    audio.play().catch(() => {});
    return audio;
  }

  stopAll() {
    Object.values(this.loopInstances).forEach((a) => {
      try {
        a.pause();
        a.currentTime = 0;
      } catch (e) { /* noop */ }
    });
  }
}

window.AssetLoader = AssetLoader;
