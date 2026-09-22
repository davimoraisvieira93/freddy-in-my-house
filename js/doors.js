/* js/doors.js
 * createDoors(DOORS_CONFIG) -> { [doorId]: DoorState }
 * Cada porta guarda se está fechada e se a luz está acesa. As duas mecânicas
 * são INDEPENDENTES: fechar/abrir a porta não mexe na luz, e a luz pode ser
 * ligada/desligada com a porta em qualquer estado.
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
      },
      toggleLight() {
        this.lightOn = !this.lightOn;
      },
    };
  }
  return doors;
}

window.createDoors = createDoors;
