/* js/power.js
 * Dreno de energia por segundo, somando porta fechada / luz acesa / monitor
 * aberto, multiplicado pelo powerDrainMultiplier da noite atual.
 */
class PowerSystem {
  constructor(constants, onBlackout) {
    this.constants = constants;
    this.onBlackout = onBlackout;
    this.reset();
  }

  reset() {
    this.value = this.constants.POWER_MAX;
    this.isBlackedOut = false;
  }

  get percentage() {
    return Math.max(0, this.value);
  }

  isLow() {
    return !this.isBlackedOut && this.value <= this.constants.POWER_LOW_WARNING_THRESHOLD;
  }

  tick(dtSec, doorsArray, monitorOpen, drainMultiplier = 1) {
    if (this.isBlackedOut) return;
    const c = this.constants;

    let drain = c.POWER_DRAIN_BASE_PER_SEC;
    for (const door of doorsArray) {
      if (door.isClosed) drain += c.POWER_DRAIN_PER_DOOR_CLOSED_PER_SEC;
      if (door.lightOn) drain += c.POWER_DRAIN_PER_LIGHT_ON_PER_SEC;
    }
    if (monitorOpen) drain += c.POWER_DRAIN_MONITOR_OPEN_PER_SEC;
    drain *= drainMultiplier;

    this.value = Math.max(0, this.value - drain * dtSec);
    if (this.value <= 0 && !this.isBlackedOut) {
      this.isBlackedOut = true;
      this.onBlackout && this.onBlackout();
    }
  }
}

window.PowerSystem = PowerSystem;
