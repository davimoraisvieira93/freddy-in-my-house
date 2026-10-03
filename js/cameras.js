/* js/cameras.js
 * Estado do monitor de câmeras: aberto/fechado e sala atual. O desenho de
 * verdade (fundo + inimigo por cima) é feito em ui.js/renderCameraMonitor.
 *
 * REBOOT (estilo FNAF 3): de tempos em tempos o sistema cai (status 'down').
 * Com ele fora do ar o monitor só mostra chiado. Para consertar, o jogador vai
 * até a visão do Sistema (à esquerda do computador), abre o tablet e manda
 * reiniciar (status 'rebooting' por CAMERA_REBOOT_MS, depois volta a 'ok').
 */
class CameraSystem {
  constructor(rooms) {
    this.rooms = rooms;
    this.isOpen = false;
    this.currentRoomId = rooms[0].id;
    this.status = 'ok';        // 'ok' | 'down' | 'rebooting'
    this.failInMs = 0;         // contagem até a próxima queda
    this.rebootElapsedMs = 0;
    this._scheduleFailure();
  }

  reset() {
    this.isOpen = false;
    this.currentRoomId = this.rooms[0].id;
    this.status = 'ok';
    this.rebootElapsedMs = 0;
    this._scheduleFailure();
  }

  get isWorking() { return this.status === 'ok'; }

  /** 0–1: progresso do reboot em andamento. */
  get rebootProgress() {
    const total = window.GAME_CONSTANTS.CAMERA_REBOOT_MS;
    return this.status === 'rebooting' ? Math.min(1, this.rebootElapsedMs / total) : 0;
  }

  _scheduleFailure() {
    const c = window.GAME_CONSTANTS;
    const min = c.CAMERA_FAIL_MIN_MS;
    const max = c.CAMERA_FAIL_MAX_MS;
    this.failInMs = min + Math.random() * (max - min);
  }

  /** Chamar a cada frame de jogo. */
  update(deltaMs) {
    const c = window.GAME_CONSTANTS;
    if (this.status === 'ok') {
      this.failInMs -= deltaMs;
      if (this.failInMs <= 0) this.status = 'down';
    } else if (this.status === 'rebooting') {
      this.rebootElapsedMs += deltaMs;
      if (this.rebootElapsedMs >= c.CAMERA_REBOOT_MS) {
        this.status = 'ok';
        this.rebootElapsedMs = 0;
        this._scheduleFailure();
      }
    }
  }

  /** Inicia o reboot (também vale como reboot preventivo com o sistema ok). */
  startReboot() {
    if (this.status === 'rebooting') return false;
    this.status = 'rebooting';
    this.rebootElapsedMs = 0;
    return true;
  }

  toggle(open) {
    this.isOpen = open === undefined ? !this.isOpen : open;
    return this.isOpen;
  }

  close() {
    this.isOpen = false;
  }

  switchRoom(roomId) {
    if (this.rooms.some((r) => r.id === roomId)) this.currentRoomId = roomId;
  }
}

window.CameraSystem = CameraSystem;
