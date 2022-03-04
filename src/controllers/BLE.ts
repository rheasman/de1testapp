import { KeyboardTab, SignalWifiStatusbarConnectedNoInternet4 } from '@mui/icons-material';
import { updateDecorator } from 'typescript';
import { StringifyingMap } from '../components/StringifyingMap';
import KeyStore from '../models/KeyStore'
import { T_DeviceState, T_ConnectionState, T_Request, T_IncomingMsg, T_ScanResult, MessageMaker, T_GATTNotify } from './MessageMaker';
import { WSClientController, WSState } from './WSClient'

export class DeviceMap extends StringifyingMap<string, T_DeviceState> {
  protected stringifyKey(key: string): string {
      return key.toString();
  }
}

export class ConnMap extends StringifyingMap<string, T_ConnectionState> {
  protected stringifyKey(key: string): string {
      return key.toString();
  }
}

export interface I_BLEResponseCallback {
  // Return true if more callbacks are expected.
  // Return false to make the BLE class forget about this id and callback
  // Forgetting to return false will leak memory
  (request : T_Request, response : T_IncomingMsg) : boolean;
};

export interface I_BLEUpdateCallback {
  // Return true if more callbacks are expected.
  // Return false to make the BLE class forget about this callback
  (update : T_IncomingMsg) : boolean;
};

type IDBundle = {
  req : T_Request;
  cb  : I_BLEResponseCallback;
}

type T_NotifyKey = {
  MAC : string,  // MAC address a notify is coming from
  Char : string  // Characteristic that has changed
}

export interface ScanCallbackType {
  (done: boolean, entry : T_ScanResult) : void;
}

export interface ReadyCallback {
  ( ready : boolean ) : void;
}

class IDMap extends StringifyingMap<number, IDBundle> {
  protected stringifyKey(key: number): string {
    return key.toString();
  }
}

class NotifyMap extends StringifyingMap<T_NotifyKey, I_BLEUpdateCallback> {
  protected stringifyKey(key: T_NotifyKey): string {
    return key.MAC + key.Char;
  }
}

/**
 * Class to handle a BLE interface.
 * 
 */
export class BLE  {
  SeenDevices : DeviceMap = new DeviceMap(); // Seen BLE devices
  ConnectedDevices : ConnMap = new ConnMap(); // Devices we have a GATT connection to
  NotifyCallbackMap : NotifyMap = new NotifyMap();
  SentMap : IDMap = new IDMap();  // Map used to associate outgoing requests with responses
  LastID  : number;  // Last ID used for a request. Increments and wraps around at MAX_ID
  ReadyCallbackMap : Map<ReadyCallback, string> = new Map<ReadyCallback, string>();

  MM   : MessageMaker;
  URL  : string;
  Name : string;
  WSC  : WSClientController;
  WSCName : string;

  MAX_ID = 1000000000;

  registerForReadyUpdates(cb : ReadyCallback) {
    this.ReadyCallbackMap.set(cb, "");
  }

  UnregisterForReadyUpdates(cb : ReadyCallback) {
    this.ReadyCallbackMap.delete(cb);
  }

  isBLEReady = () => {
    return this.WSC.getReadyState() === WebSocket.OPEN;
  }

  _forget(id: number) {
    if (this.SentMap.has(id)) {
      this.SentMap.delete(id); // Forget association with this request
    }
  }

  _sendAsJSON(thing: T_Request) {
    this.WSC.send(JSON.stringify(thing));
  }

  _onmessage = (event : MessageEvent<any>) : boolean => {
    console.log("BLE._onmessage:", event);
    const data : T_IncomingMsg = this.MM.makeIncomingMsgFromJSON(event["data"]);

    if (data.id === 0) {
      // This is an unsolicted update
      // Usually a disconnect notification
      return this._handleUnsolicitedUpdate(data);
    }

    const bundle = this.SentMap.get(data.id);
    if (bundle === undefined) {
      // We have a response for an unknown request
      console.log("BLE", 'Unknown ID in response: ', data, this.SentMap);
      return false;
    }

    console.log("BLE", data);
    try {
      const keepmapping = bundle.cb(bundle.req, data);
      if (!keepmapping) {
        this._forget(data.id); // Forget association with this request
      }  
    } catch (err) {
      console.log("_onmessage() callback error: ", err)
    }
    return false;
  }

  _onstatechange = () => {
    console.log("_onstatechange: readyState:", this.WSC.getReadyState());
    if (this.WSC.getReadyState() === WebSocket.OPEN) {
      // // Request a new scan when we connect to the server
      // this.requestScanWithCallbacks(6, null);
      this.ReadyCallbackMap.forEach( (value, key, map) => { key(true) })
    }
    if (this.WSC.getReadyState() === WebSocket.CLOSED) {
      // No more devices known
      this.SeenDevices = new DeviceMap();
      KeyStore.getInstance().updateKey(this.Name, "DeviceSet", this.SeenDevices, true);
      this.ReadyCallbackMap.forEach( (value, key, map) => { key(false) })
    }
  }

  // Handle updates from the other side that have an id of zero.
  // This means that they are not a direct response to a request.
  // So, notifies and disconnections.
  _handleUnsolicitedUpdate(update : T_IncomingMsg) : boolean {
    if (update.type === "UPDATE") {
      if (update.update === "GATTNotify") {
        // A GATT Characteristic changed. Notify if someone cares.
        const notify : T_GATTNotify = update.results as T_GATTNotify;
        const key = { MAC : notify.MAC, Char : notify.Char } as T_NotifyKey;
        const callback = this.NotifyCallbackMap.get(key);
        if (callback !== undefined) {
          const keepmapping = callback(update);
        }
      }
    }
    return false;
  }

  /**
   * Increment the ID we use to generate BLE packet requests
   */

  incId() : number {
    let id = this.LastID + 1;
    if (id > this.MAX_ID) {
      this.LastID = 1
    } else {
      this.LastID = id;
    }
    return this.LastID;
  }

  /**
   * Trigger a BLE scan.
   * 
   * The callback will be called back multiple times, once for each device seen.
   * 
   * If "done" is true, then the device information is invalid, and the scan is over
   *
   * @param timeout  How many seconds to scan for
   * @param callback Function to call when we receive an update about a device during a scan. Can be null.
   */
  requestScanWithCallbacks(timeout: number, callback : ScanCallbackType | null) {
    const id = this.incId();

    const blecb = (request : T_Request, response : T_IncomingMsg): boolean => {
      console.log("blecb", request, response);
      if (response.type === "UPDATE") {
        const upd = this.MM.updateFromMsg(response);
        if (upd.update === 'ScanResult') {
          const dev : T_ScanResult = this.MM.scanResultFromUpdate(upd);
          const cstate = this.ConnectedDevices.get(dev.MAC) || "DISCONNECTED"
          const devstate : T_DeviceState = {
            MAC : dev.MAC,
            Name : dev.Name,
            UUIDs : dev.UUIDs,
            State : cstate
          }
          if (dev.MAC) {
            this.SeenDevices.set(dev.MAC, devstate);
            console.log("BLE", dev);
            KeyStore.getInstance().updateKey(this.Name, "DeviceSet", this.SeenDevices, true);
            if (callback) callback(false, dev);
            return true;
          } else {
            // This was our last update.
            if (callback) callback(true, dev);     // Notify listener
            return false; // Forget association with this request
          }
        }
      }
      // Should be impossible to get here. Should only get ScanResults
      return false;
    }

    try {
      const scanreq = this.MM.makeScan(timeout, id);
      this.SentMap.set(id, {req: scanreq, cb: blecb});
      this._sendAsJSON(scanreq);  
    } catch (error) {
      // I'm honestly not sure what kinds of things could go wrong here, yet.
      // For now just log it?
      console.log("Error in requestScanWithCallbacks:", error);
    }
  }

  /**
   * Request a BLE scan.
   * 
   * Returns when the scan is done. "DeviceSet" in the KeyStore will be up to date,
   * or read this.Devices.
   */
  async requestScan(timeout : number) {
    return new Promise<string>((resolve, reject) => {

      const id = this.incId();
      const blecb = (request : T_Request, response : T_IncomingMsg): boolean => {
        if (response.type === "UPDATE") {
          const upd = this.MM.updateFromMsg(response);
          if (upd.update === 'ScanResult') {
            const dev = this.MM.scanResultFromUpdate(upd);
            const cstate = this.ConnectedDevices.get(dev.MAC) || "DISCONNECTED"
            const devstate : T_DeviceState = {
              MAC : dev.MAC,
              Name : dev.Name,
              UUIDs : dev.UUIDs,
              State : cstate
            }
            if (dev.MAC) {
              this.SeenDevices.set(dev.MAC, devstate);
              KeyStore.getInstance().updateKey(this.Name, "DeviceSet", this.SeenDevices, true);
              return true;
            } else {
              // This was our last update.
              // Forget association with this request
              resolve("Scan done");
              return false;
            }
          }
        }
        // Should be impossible to get here. Should only get ScanResults
        console.log("ScanResults callback got called with bad data: ", response);
        reject(new Error(`ScanResult callback got called with bad data: ${response}`))
        return false;
      }

      try {
        const scanreq = this.MM.makeScan(timeout, id);
        this.SentMap.set(id, {req: scanreq, cb: blecb});
        this._sendAsJSON(scanreq);  
      } catch (error) {
        // I'm honestly not sure what kinds of things could go wrong here, yet.
        // For now just log it?
        console.log("Error in requestScanWithCallbacks:", error);
        reject(new Error("Caught exception in requestScan"));
      }
    });
  };

  // Accept a request, fill in a real ID, set up the callback map (SentMap),
  // convert to JSON and send.
  _sendRequest(reqtosend: T_Request, callback: I_BLEResponseCallback) {
    const id = this.incId();
    reqtosend.id = id;
    this.SentMap.set(id, {req: reqtosend, cb: callback});
    this._sendAsJSON(reqtosend);  
  }

  _updateConnState(mac : string, state : T_ConnectionState) {
    if (state === "CONNECTED") {
      this.ConnectedDevices.set(mac, state);
    } else {
      this.ConnectedDevices.delete(mac);
    }
    var devstate = this.SeenDevices.get(mac);
    if (devstate !== undefined) {
      devstate.State = state;
      this.SeenDevices.set(mac, devstate);
    } else {
      console.log("BLE: Connectionstate received for a device not in SeenDevices: ", mac, state);
    }

    KeyStore.getInstance().updateKey(this.Name, "DeviceSet", this.SeenDevices, true)
  }

  /**
   * Request a connection to the GATT server on a device
   * 
   * Will return with a connection state after connection fails or succeeds, and then
   * the callback will be forgotten.
   * 
   * Register for unsolicited callbacks using registerForNotifies to be informed
   * of things like disconnects.
   * 
   * @param mac MAC address of server, eg "20:C3:8F:E3:B6:A3"
   * @param callback Function to call back with the result
   */
  requestGATTConnect(mac : string, callback : I_BLEResponseCallback) {
    const conncb = (request: T_Request, response: T_IncomingMsg): boolean => {
      // We proxy the callback so we can update our list of connected devices.
      let update = this.MM.connStateFromUpdate(this.MM.updateFromMsg(response));
      this._updateConnState(update.MAC, update.CState);
      console.log("BLE: requestGATTConnect response:", update)
      callback(request, response);
      return false;
    }    
    this._sendRequest(this.MM.makeConnect(mac, 0), conncb);
  }

    /**
   * Request a disconnection from the GATT server on a device
   * 
   * Will return with a connection state after disconnection fails or succeeds, and then
   * the callback will be forgotten.
   * 
   * Register for unsolicited callbacks using registerForNotifies to be informed
   * of things like disconnects.
   * 
   * @param mac MAC address of server, eg "20:C3:8F:E3:B6:A3"
   * @param callback Function to call back with the result
   */
  requestGATTDisconnect(mac : string, callback : I_BLEResponseCallback) {
    const disconncb = (request: T_Request, response: T_IncomingMsg): boolean => {
      // We proxy the callback so we can update our list of disconnected devices.
      let update = this.MM.connStateFromUpdate(this.MM.updateFromMsg(response));
      this._updateConnState(update.MAC, update.CState);
      console.log("BLE: requestGATTDisconnect response:", update)
      callback(request, response);
      return false;
    }    
    this._sendRequest(this.MM.makeDisconnect(mac, 0), disconncb);
  }
  
  /**
   * Do a callback read from a GATT device
   * 
   * @param mac MAC address
   * @param char Characteristic to read
   * @param readlen Number of bytes to read (should just be the size of the characteristic, for now)
   * @param callback Callback to call with response. Return false from callback.
   */
  requestGATTRead(mac : string, char : string, readlen : number, callback : I_BLEResponseCallback) {
    this._sendRequest(this.MM.makeGATTRead(mac, char, readlen, 0), callback);
  }

  /**
   * Do an async read from a GATT device
   * 
   * @param mac MAC address
   * @param char Characteristic to read
   * @param readlen Number of bytes to read (should just be the size of the characteristic, for now)
   * @returns T_IncomingMsg, which is the result of your request.
   */
  async requestAsyncGATTRead(mac : string, char : string, readlen : number) : Promise<T_IncomingMsg> {
    return new Promise<T_IncomingMsg>((resolve, reject) => {
      const blecb = (request : T_Request, response : T_IncomingMsg): boolean => {
        resolve(response);
        return false;
      }

      this.requestGATTRead(mac, char, readlen, blecb);
    })
  }

  /**
   * Request a notification from a GATT Characteristic on a device
   * 
   * Requesting a disable will also cause the callback to be forgotten.
   * 
   * @param mac MAC address of device
   * @param char Characteristic to notify on
   * @param enable Enable or disable the notify
   * @param respcallback Callback to call when response to request for notify comes back
   * @param upcallback Callback to call when notifies come in, in future.
   * 
   * Throws an error if you attempt to enable a notify twice. Disable twice is ignored.
   */
  requestGATTSetNotify(mac : string, char : string, enable : boolean, respcallback: I_BLEResponseCallback, upcallback : I_BLEUpdateCallback) {
    const key : T_NotifyKey = { MAC : mac, Char : char} as T_NotifyKey;
    
    if (enable) {
      if (this.NotifyCallbackMap.has(key)) {
        // Key already exists, so complain
        throw new Error(`There is already a notify callback for ${key.MAC + key.Char}`);
      }
      this.NotifyCallbackMap.set(key, upcallback);
      this._sendRequest(this.MM.makeGATTSetNotify(mac, char, enable, 0), respcallback);
    } else {
      if (this.NotifyCallbackMap.has(key)) {
        this._sendRequest(this.MM.makeGATTSetNotify(mac, char, enable, 0), respcallback);
        this.NotifyCallbackMap.delete(key)      
      }
    }
  }

  constructor(name: string, url: string){
    console.log("BLE.constructor(%s, %s)", name, url);
    this.LastID = 1;
    this.MM = new MessageMaker();    
    this.URL = url;
    this.Name = name;
    this.WSCName = "wsc_"+name;
    this.WSC = new WSClientController(this.WSCName, url);
    this.WSC.addStateNotify(this._onstatechange);
    this.WSC.setMessageEventHandler(this._onmessage)
    this.WSC.connect()
   }

}
