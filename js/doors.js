/* js/doors.js
 * createDoors(DOORS_CONFIG) -> { [doorId]: DoorState }
 * Cada porta guarda se está fechada e se a luz está acesa. Fechar a porta
 * apaga a luz (não dá pra segurar a luz com a porta fechada).
 */
function createDoors(config) {
  const doors = {};
  for (const def of config) {
    doors[def.id] = {
      id: def.id,
      label: def.label,
      isClosed: false,
      lightOn: false,
      reset() {
        this.isClosed = false;
        this.lightOn = false;
      },
      toggleClosed() {
        this.isClosed = !this.isClosed;
        if (this.isClosed) this.lightOn = false;
      },
      toggleLight() {
        if (this.isClosed) return;
        this.lightOn = !this.lightOn;
      },
    };
  }
  return doors;
}

window.createDoors = createDoors;
