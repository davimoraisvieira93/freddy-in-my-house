/* js/doors.js
 * createDoors(DOORS_CONFIG) -> { [doorId]: DoorState }
 * Cada porta (ou janela) guarda apenas se está fechada.
 */
function createDoors(config) {
  const doors = {};
  for (const def of config) {
    doors[def.id] = {
      id: def.id,
      label: def.label,
      isClosed: false,
      reset() {
        this.isClosed = false;
      },
      toggleClosed() {
        this.isClosed = !this.isClosed;
      },
    };
  }
  return doors;
}

window.createDoors = createDoors;
