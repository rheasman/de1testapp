import { StringifyingMap } from '../components/StringifyingMap';
import KeyStore from '../models/KeyStore'
import { WSClientController } from './WSClient'

type T_MsgType = "REQ" | "RESP";
type T_ReqCommand = "Scan" | "GATTConnect" | "GATTDisconnect" | "GATTRead" | "GATTSetNotify" | "GATTWrite";
type T_Request = {
  type    : T_MsgType,
  command : T_ReqCommand,
  params  : any,
  id      : number
}

/**
 * Class to make the various message types we'll need
 * 
 * Doesn't really need to be a class, but thought it would be nice
 * to keep it all together, and I might add methods later to turn
 * on various debugging functions.
 */

class MessageMaker {
  makeReq(command : T_ReqCommand, rid: number, params: any): T_Request {
    return {
      type    : 'REQ',
      command : command,
      params  : params,
      id      : rid
    }
  }

  makeScan(timeout: number, rid: number) {
    // Scan(timeout : U32)
    var params = {
        Timeout : timeout
    }
    return this.makeReq("Scan", rid, params)
  }

  makeMMRRead(address : number, bytelen : number) {

  }
}

type T_Device_Entry = {
  addr : string,
  name : string
}

export class DeviceMap extends StringifyingMap<T_Device_Entry, T_Device_Entry> {
  protected stringifyKey(key: T_Device_Entry): string {
      return key.addr.toString();
  }
}


/**
 * Class to handle a BLE device.
 * 
 */
export class BLE  {
  Devices : DeviceMap = new DeviceMap();

  _onmessage = (event : MessageEvent<any>) : boolean => {
    console.log("BLE._onmessage:", event);
    const data = JSON.parse(event["data"]);
    console.log("BLE", data);
    if ((data.type === "UPDATE") && (data.update === "ScanResult")) {
      const result = data.results;
      const dev = { addr: result.MAC, name: result.Name };
      this.Devices.set(dev, dev);
      KeyStore.instance.updateKey(this.name, "DeviceSet", this.Devices, true);
    }
    return false;
  }

  _onstatechange = () => {
    this.wsc.setMessageEventHandler(this._onmessage)
    console.log("_onstatechange");
    if (this.wsc.ws.readyState === 1) {
      this.wsc.send(JSON.stringify(this.MM.makeScan(6, 1)));
    }
  }

  MM   : MessageMaker;
  url  : string;
  name : string;
  wsc  : WSClientController;

  constructor(name: string, url: string){
    this.MM = new MessageMaker();    
    this.url = url;
    this.name = name;
    this.wsc = new WSClientController("wsc_"+name, url);
    this.wsc.addStateNotify(this._onstatechange);
    this.wsc.connect()
   }

}
