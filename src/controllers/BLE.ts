import { StringifyingMap } from '../components/StringifyingMap'
import KeyStore from '../models/KeyStore'
import { T_DeviceState, T_ConnectionState, T_Request, T_IncomingMsg, T_ScanResult, MessageMaker, T_Results_GATTNotify, T_Response, T_Update, T_UpdateGATTNotify, T_Base64String, T_ErrorDesc, T_ConnectionStateNotify } from './MessageMaker';
import { WSClientController, WSState } from './WSClient'
import { FullOption, SimpleOption, SuccessOption } from "../Option"

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

export type T_FullResponseOption = FullOption<T_Response, T_ErrorDesc>;

export interface I_BLEIncomingMsgCallback {
  // Return true if more callbacks are expected.
  // Return false to make the BLE class forget about this id and callback
  // Forgetting to return false will leak memory
  (request : T_Request, response : T_IncomingMsg) : boolean;
};

export interface I_BLEResponseCallback {
  // Return true if more callbacks are expected.
  // Return false to make the BLE class forget about this id and callback
  // Forgetting to return false will leak memory
  (request : T_Request, response : T_FullResponseOption) : boolean;
};

export interface I_BLEUpdateCallback {
  // Return true if more callbacks are expected.
  // Return false to make the BLE class forget about this callback
  (update : T_Update) : boolean;
};

export interface I_ConnectionStateCallback {
  // Return true if more callbacks are expected.
  // Return false to make the BLE class forget about this callback
  (request : T_Request, update : T_ConnectionStateNotify) : boolean;
}

type IDBundle = {
  req : T_Request;
  cb  : I_BLEIncomingMsgCallback;
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

type MMRAddress = {
  MAC : string,
  Addr : number
}

export interface MMRCallback {
  // If success == false, then payload === null
  ( success : boolean, mac : string, wordlen : number, addr : number, payload : Buffer|null) : void;
}

interface MMRReadReq {
  mac: string,
  mmraddress : number, 
  wordlen : number, 
  callback : MMRCallback;
}

interface MMRReadResponse {
  mac: string,
  mmraddress : number, 
  wordlen : number, 
  payload : Buffer
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

class MMRNotifyMap extends StringifyingMap<MMRAddress, MMRCallback> {
  protected stringifyKey(key: MMRAddress): string {
    return key.MAC.toString() + key.Addr.toString();
  }
}

/**
 * Class to handle a BLE interface.
 * 
 * TODO: replace all exceptions with Result from the neverthrow library
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
  MMRMap : MMRNotifyMap = new MMRNotifyMap();
  PendingMMRReads : MMRReadReq[];

  MAX_ID = 1000000000;

  registerForReadyUpdates(cb : ReadyCallback) {
    this.ReadyCallbackMap.set(cb, "");
  }

  unregisterForReadyUpdates(cb : ReadyCallback) {
    this.ReadyCallbackMap.delete(cb);
  }

  isBLEReady = () => {
    return this.WSC.getReadyState() === WebSocket.OPEN;
  }

  static asUpdate(msg : T_IncomingMsg) : SimpleOption<T_Update> {
    if (msg.type === "UPDATE") {
      return { success: true, result : msg as T_Update }
    }

    return { success: false };
  }

  static asResponseOption(msg : T_IncomingMsg) : T_FullResponseOption {
    console.log("asResponse: ", msg)
    if (msg.type === "RESP") {
      return { success: true, result: msg as T_Response}
    }

    return { success: false, error: msg.results as T_ErrorDesc}
  }

  // Convert a I_BLEIncomingMsgCallback to I_BLEResponseCallback
  static _makeResponseTrampoline( callback : I_BLEResponseCallback) {
    const trampoline = (request: T_Request, msg : T_IncomingMsg): boolean => {
      callback(request, BLE.asResponseOption(msg))

      return false;
    }

    return trampoline
  }

  _forget(id: number) {
    if (this.SentMap.has(id)) {
      this.SentMap.delete(id); // Forget association with this request
    }
  }

  _sendAsJSON(thing: T_Request) {
    console.log("_sendAsJSON: ", thing);
    this.WSC.send(JSON.stringify(thing));
  }

  _onmessage = (event : MessageEvent<any>) : boolean => {
    console.log("BLE._onmessage:", event);
    const data : T_IncomingMsg = this.MM.makeIncomingMsgFromJSON(event["data"]);

    // If there's a chance we could now trigger a new read, do so.
    if (this.PendingMMRReads.length > 0) {
      setTimeout(this._procPendingMMRReads, 0);
    }
    
    if (data.id === 0) {
      // This is an unsolicted update
      // Usually a disconnect notification
      console.log("BLE", 'Unsolicited update: ', data);
      return this._handleUnsolicitedUpdate(data);
    }

    const bundle = this.SentMap.get(data.id);
    if (bundle === undefined) {
      // We have a response for an unknown request
      console.log("BLE", 'Unknown ID in response: ', data, this.SentMap);
      return false;
    }

    console.log("BLE: calling back:", bundle, data);
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
      this.reset();
      KeyStore.getInstance().updateKey(this.Name, "DeviceSet", this.SeenDevices, true);
      this.ReadyCallbackMap.forEach( (value, key, map) => { key(false) })
    }
  }

  // Handle updates from the other side that have an id of zero.
  // This means that they are not a direct response to a request.
  // So, notifies and disconnections.
  _handleUnsolicitedUpdate = (update : T_IncomingMsg) : boolean => {
    if (update.type === "UPDATE") {
      if (update.update === "GATTNotify") {
        // A GATT Characteristic changed. Notify if someone cares.
        const notify : T_Results_GATTNotify = update.results as T_Results_GATTNotify;
        const key = { MAC : notify.MAC, Char : notify.Char } as T_NotifyKey;
        const callback = this.NotifyCallbackMap.get(key);
        if (callback !== undefined) {
          callback(update);
        }
      }
    }
    return false;
  }

  /**
   * Increment the ID we use to generate BLE packet requests
   */

  incId = () : number => {
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
  requestScan = async (timeout : number) => {
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
  _sendRequest(reqtosend: T_Request, callback: I_BLEIncomingMsgCallback) {
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
  requestGATTConnect = (mac : string, callback : I_ConnectionStateCallback) => {
    const conncb = (request: T_Request, response: T_IncomingMsg): boolean => {
      // We proxy the callback so we can update our list of connected devices.
      const update = this.MM.updateFromMsg(response)
      let connstate = this.MM.connStateFromUpdate(update);
      this._updateConnState(connstate.MAC, connstate.CState);
      console.log("BLE: requestGATTConnect response:", connstate)
      callback(request, connstate);
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
  requestGATTDisconnect = (mac : string, callback : I_ConnectionStateCallback) => {
    const disconncb = (request: T_Request, response: T_IncomingMsg): boolean => {
      // We proxy the callback so we can update our list of disconnected devices.
      let connstate = this.MM.connStateFromUpdate(this.MM.updateFromMsg(response));
      this._updateConnState(connstate.MAC, connstate.CState);
      console.log("BLE: requestGATTDisconnect response:", connstate)
      callback(request, connstate);
      return false;
    }    
    this._sendRequest(this.MM.makeDisconnect(mac, 0), disconncb);
  }

    /**
   * Do a callback write to a GATT device
   * 
   * @param mac MAC address
   * @param char Characteristic to write
   * @param data Data to write (should just be the size of the characteristic, for now)
   * @param requireresponse Set true if Bluetooth should guarantee the delivery of the transaction (requires the other side to acknowledge the write)
   * @param callback Callback to call with response. Return false from callback.
   */
     requestGATTWrite = (mac : string, char : string, data : Buffer, requireresponse: boolean, callback : I_BLEResponseCallback) => {   
      this._sendRequest(this.MM.makeGATTWrite(mac, char, data, 0, requireresponse), BLE._makeResponseTrampoline(callback));
    }

   /**
   * Do an async write to a GATT device
   * 
   * @param mac MAC address
   * @param char Characteristic to write
   * @param data Data to write (should just be the size of the characteristic, for now)
   * @param requireresponse Set true if Bluetooth should guarantee the delivery of the transaction (requires the other side to acknowledge the write)
   * @returns T_IncomingMsg, which is the result of your request.
   * 
   */
  requestAsyncGATTWrite = async (mac : string, char : string, data : Buffer, requireresponse : boolean) : Promise<FullOption<T_Response, T_ErrorDesc>> => {
    return new Promise<FullOption<T_Response, T_ErrorDesc>>((resolve, reject) => {
      const blecb = (request : T_Request, msg : T_FullResponseOption): boolean => {
        resolve(msg);
        return false;
      }

      this.requestGATTWrite(mac, char, data, requireresponse, blecb);
    })
  }
    
  /**
   * Do a callback read from a GATT device
   * 
   * @param mac MAC address
   * @param char Characteristic to read
   * @param readlen Number of bytes to read (should just be the size of the characteristic, for now)
   * @param callback Callback to call with response. Return false from callback.
   */
  requestGATTRead = (mac : string, char : string, readlen : number, callback : I_BLEResponseCallback) => {
    this._sendRequest(this.MM.makeGATTRead(mac, char, readlen, 0), BLE._makeResponseTrampoline(callback));
  }

  /**
   * Do an async read from a GATT device
   * 
   * @param mac MAC address
   * @param char Characteristic to read
   * @param readlen Number of bytes to read (should just be the size of the characteristic, for now)
   * @returns T_IncomingMsg, which is the result of your request.
   */
  requestAsyncGATTRead = async (mac : string, char : string, readlen : number) : Promise<FullOption<T_Response, T_ErrorDesc>> => {
    return new Promise<FullOption<T_Response, T_ErrorDesc>>((resolve, reject) => {
      const blecb = (request : T_Request, response : T_FullResponseOption): boolean => {
        resolve(response)
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
  requestGATTSetNotify = (mac : string, char : string, enable : boolean, respcallback: I_BLEResponseCallback, upcallback : I_BLEUpdateCallback) => {
    const key : T_NotifyKey = { MAC : mac, Char : char} as T_NotifyKey;
    
    const trampoline = BLE._makeResponseTrampoline(respcallback)

    if (enable) {
      // if (this.NotifyCallbackMap.has(key)) {
      //   // Key already exists, so complain
      //   throw new Error(`There is already a notify callback for ${key.MAC + key.Char}`);
      // }
      this.NotifyCallbackMap.set(key, upcallback);
      this._sendRequest(this.MM.makeGATTSetNotify(mac, char, enable, 0), trampoline);
    } else {
      if (this.NotifyCallbackMap.has(key)) {
        this._sendRequest(this.MM.makeGATTSetNotify(mac, char, enable, 0), trampoline);
        this.NotifyCallbackMap.delete(key)      
      }
    }
  }

/**
 * Request a notification from a GATT Characteristic on a device.
 * 
 * This is just like requestGATTSetNotify, but is async, and throws an
 * exception if the attempt to set the notify fails, instead of requiring you to
 * set a callback.
 * 
 * Requesting a disable will cause the callback to be forgotten.
 * 
 * @param mac MAC address of device
 * @param char Characteristic to notify on
 * @param enable Enable or disable the notify
 * @param upcallback Callback to call when notifies come in, in future.
 * 
 * Throws an error if you attempt to enable a notify twice. Disable twice is ignored.
 */
  requestAsyncGATTSetNotify = async (mac : string, char : string, enable : boolean, upcallback : I_BLEUpdateCallback) : Promise<FullOption<T_Response, T_ErrorDesc>> => {
    return new Promise<FullOption<T_Response, T_ErrorDesc>>((resolve, reject) => {
      const respcallback : I_BLEResponseCallback = (request : T_Request, msg : T_FullResponseOption) : boolean => {
        resolve(msg)

        return false;  
      }

      this.requestGATTSetNotify(mac, char, enable, respcallback, upcallback);
    })
  }

  // This is a DE1 specific BLE request. Decided that I'd put it here, even though it's not
  // a generic BLE operation.

  /**
   * This sets up internal state so that this BLE object can transparently handle
   * MMR reads for you, to a DE1.
   * 
   * @param mac MAC address of a DE1
   * @returns  
   */
  setUpForMMRReads = async (mac: string) : Promise<SuccessOption<T_ErrorDesc>> => {
    return new Promise<SuccessOption<T_ErrorDesc>>((resolve, reject) => {
      const respcallback : I_BLEResponseCallback = (request : T_Request, response : T_FullResponseOption) : boolean => {
        resolve(response);
        return false;  
      }

      this.requestGATTSetNotify(mac, BLE.MMRReadChar, true, respcallback, this._wrapWithMAC(mac, this._localMMRUpdateCB));
    })
  }

  // Convert a Base64 representation of an MMR to its constituent fields.
  static _unpackMMRData(data : T_Base64String) {
    const bindata = Buffer.from(data, "base64");
    const wordlen = bindata[0];
    const addr = (bindata[1] << 16) + (bindata[2] << 8) + (bindata[3]);
    const payload = bindata.slice(4);
    return { wordlen, addr, payload };
  }

  // Make a buffer that represents a MMR read
  static _packMMRRead(wordlen : number, addr : number) : Buffer {
    const data = new Uint8Array(20);
    var header = [
      wordlen,
      (addr >> 16) & 0xFF,
      (addr >>  8) & 0xFF,
      addr        & 0xFF
    ]
    data.set(header, 0);
    return Buffer.from(data);
  }
  
  // Wrap a call so that the called function knows the MAC address of the counterparty BLE device.
  _wrapWithMAC = (mac : string, callback : CallableFunction ) : I_BLEUpdateCallback => {
    const cbfn : I_BLEUpdateCallback = ( msg : T_IncomingMsg ): boolean=> {
      callback(mac, msg);
      return false;
    }
    return cbfn;
  }

  // Called back when we get a notify update from the DE1. We don't know which DE1, so accept a MAC too.
  _localMMRUpdateCB = (mac : string, msg : T_IncomingMsg) => {
    if ((msg.type === "UPDATE") && (msg.update === "GATTNotify")) {
      const gattn = msg as T_UpdateGATTNotify;
      const res = BLE._unpackMMRData(gattn.results.Data);

      const cb = this.MMRMap.get({ MAC : mac, Addr: res.addr });
      if (cb !== undefined) {
        cb(true, mac, res.wordlen, res.addr, res.payload);
      };

      console.log(`_locallMMRUpdateCB(${mac}, ${msg}):`, res);
    }
    
    // If there's a chance we could now trigger a new read, do so.
    if (this.PendingMMRReads.length > 0) {
      setTimeout(this._procPendingMMRReads, 0);
    }

    return true;
  }

  static MMRReadChar = "0000a005-0000-1000-8000-00805f9b34fb";

  // Look to see if we have any MMR reads we could do
  // Returns true if it pulled a read out of the queue
  _procPendingMMRRead = () : boolean => {
    console.log("_procPendingMMRRead length: ", this.PendingMMRReads.length);
    const oldestitem = this.PendingMMRReads.at(0);
    if (oldestitem) {
      const key = { MAC: oldestitem.mac, Addr: oldestitem.mmraddress };
      if (!this.MMRMap.has(key)) {
        // Okay. No existing read for this address. Let's do it.
        // We can only have one read outstanding per address, as we only
        // have the address to key on.
        this.PendingMMRReads.shift(); // Discard from queue
        const item = oldestitem;
        const blecb = (request : T_Request, response : T_FullResponseOption): boolean => {
          console.log("blecb: ", request, response)
          // If the write succeeded 
          if (response.success) {
              // Success, add notify to map, for response
              // (this is now redundant, as we add it below)
              // this.MMRMap.set({ MAC: item.mac, Addr: item.mmraddress }, item.callback);
          } else {
              // Something went wrong, so return error to callback, delete MMR callback entry
              this.MMRMap.delete({ MAC: item.mac, Addr: item.mmraddress })
              item.callback(false, item.mac, item.wordlen, item.mmraddress, null);
          }

          setTimeout(this._procPendingMMRReads, 1);
          return false;
        }

        var data = BLE._packMMRRead(item.wordlen, item.mmraddress);
        // Do the GATT write that will trigger a notify callback
        // Apparently we can get the notify before the response comes back, so record the callback now.
        this.MMRMap.set({ MAC: item.mac, Addr: item.mmraddress }, item.callback);
        this.requestGATTWrite(item.mac, BLE.MMRReadChar, data, true, blecb);
        return true; 
      }
    }

    return false;
  }

  // This method reads as many as possible pending MMR requests out of the queue and sends them.
  _procPendingMMRReads = () => {
    do {
      console.log("PendingMMRReads:", this.PendingMMRReads.length);
      var didread = this._procPendingMMRRead()
    } while (didread);
  }

  /**
   * Request a read from an MMR
   * @param mac MAC address of target device
   * @param mmraddress Address to read from
   * @param wordlen Number of words to read
   * @param callback MMRCallback to call when we have data
   */
  requestMMRRead = (mac: string, mmraddress : number, wordlen : number, callback : MMRCallback) => {
    console.log("requestMMRRead");
    const key : T_NotifyKey = { MAC : mac, Char : BLE.MMRReadChar} as T_NotifyKey;
  
    if (!this.NotifyCallbackMap.has(key)) {
      throw new Error("Call setUpForMMRReads() once first, to enable MMR reads");
    }

    const readreq : MMRReadReq = {
      mac, mmraddress, wordlen, callback
    }

    // Put the MMR read request on the pending queue.
    const len = this.PendingMMRReads.push(readreq);
    console.log("PendingMMRReads len:", len);

    console.log("requestMMRRead pushed read: ", this.PendingMMRReads);
    // Now pick reads off the queue
    this._procPendingMMRReads();
  }


  /**
   * Request a read from an MMR
   * @param mac MAC address of target device
   * @param mmraddress Address to read from
   * @param wordlen Number of words to read
   * @returns MMRReadResponse 
   */
  requestAsyncMMRRead = async (mac: string, mmraddress : number, wordlen : number, ) => {
    console.log("requestAsyncMMRRead");
    return new Promise<MMRReadResponse>( (resolve, reject) => {
      const mmrcb : MMRCallback = (success, mac, wordlen, addr, payload) => {
        if (success && (payload !== null)) {
          resolve({mac, mmraddress, wordlen, payload});
        } else {
          reject(new Error(`MMR read to ${mac} ${mmraddress.toString(16)} failed for unknown reason.`))
        }
      }  

      // Request the read, could throw an error.
      this.requestMMRRead(mac, mmraddress, wordlen, mmrcb);
    });
  }


  /**
   * It's not entirely clear to me what we should do when the websocket connection is lost.
   * 
   * Should I just reset everything?
   * 
   * I starting to think that I shouldn't even keep a local list of seen and connected devices,
   * as we run the risk of getting out of sync.
   */
  reset = () => {
    this.SeenDevices.clear();
    this.ConnectedDevices.clear();
    this.NotifyCallbackMap.clear();
    this.SentMap.clear();
    this.PendingMMRReads = [];
  }

  constructor(name: string, url: string){
    console.log("BLE.constructor(%s, %s)", name, url);
    this.PendingMMRReads = [];
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
