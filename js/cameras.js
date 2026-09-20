/* js/cameras.js
 * Estado do monitor de câmeras: aberto/fechado e sala atual. O desenho de
 * verdade (fundo + inimigo por cima) é feito em ui.js/renderCameraMonitor.
 */
class CameraSystem {
  constructor(rooms) {
    this.rooms = rooms;
    this.isOpen = false;
    this.currentRoomId = rooms[0].id;
  }

  reset() {
    this.isOpen = false;
    this.currentRoomId = this.rooms[0].id;
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
