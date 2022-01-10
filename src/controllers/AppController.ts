import { BLE } from "./BLE";

export class AppController {
  BLE0 = new BLE("BLE0", "ws://localhost:8765")
  constructor() {
    console.log("AppController()");
  }
}
