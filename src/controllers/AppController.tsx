import { BLE, I_ConnectionStateCallback } from "./BLE";
import { T_ScanResult, T_Request, MessageMaker, T_ConnectionStateNotify } from "./MessageMaker";
import { DashboardController } from "./DashboardController";
import { E_Status, KeyStore } from "../models/KeyStore";
import { WSState } from "./WSClient";
import { MMRAddr } from "./MMRList";
import { DebugLogListItem } from "../views/Dashboard/listItems";
import { upload_Firmware } from "./DE1Utils";
import { Updater } from "../views/Updater";

export interface I_SM_Event {
  type : T_AppMachineEvent;
}

// export type I_Promised<T> = Promise<T | undefined>;

export interface I_SM_State_Fn<T> {
  (newtransition: boolean) : Promise<T | null>;
}

class AsyncSimpleSM<EventType, StateType> {  
  CurrentState : StateType;   // The current state of the machine
  LastState : StateType; // The last state of the machine
  EventQ : EventType[] = [];  // The queue of events to be processed
  Transition = false;         // Transition is true if a transition has occured.

  StateCode : Map<StateType, I_SM_State_Fn<StateType>> = new Map<StateType, I_SM_State_Fn<StateType>>();

  sendEventToSM = (event : EventType) => {
    console.log("sendEventToSM: Adding event ", event)
    this.EventQ.push(event);
  }

  getEvent = () : EventType | undefined => {
    return this.EventQ.shift()
  }

  // Override this to see transitions
  onTransition = () => {};

  _needToEvalSM = () : boolean => {
    return this.Transition || this.EventQ.length > 0;
  }

  /**
   * Evaluate the state machine.
   * 
   * States are functions that return the new state to go to, or null to indicate that nothing should be done.
   * They are responsible for call entry and exit actions when a state is being entered or exited.
   * If a state returns itself as the target that means the state is looping back on itself, and the entry actions should be executed.
   * If a state returns null that means that we are still in this state, and no transitions have occurred
   */
  evalSM = async () => {
    do {
      // Keep running until there are no more transitions or events
      if (this.Transition) {
        this.onTransition();
      }
      const statecode = this.StateCode.get(this.CurrentState);
      if (statecode === undefined) {
        console.log(`evalSM: No function for the current state ${this.CurrentState}`)
        throw new Error(`evalSM: No function for the current state ${this.CurrentState}`)
      } else {
        const nextstate = await statecode(this.Transition);
        if (nextstate !== null) {
          this.LastState = this.CurrentState;
          this.CurrentState = nextstate;
          this.Transition = true;
        } else {
          this.Transition = false;
        }
      }  
    } while (this._needToEvalSM());
  }

  // Call this after contruction of a derived class to set up your
  // mapping of state names to state functions.
  setStateCode(states : Map<StateType, I_SM_State_Fn<StateType>>) {
    this.StateCode = states;
  }

  constructor(initialstate : StateType) {
    this.CurrentState = initialstate;
    this.LastState = initialstate;
    this.Transition = true;
  }
}

/**
 * This is where the meat of the app lives.
 * 
 * The AppController coordinates everything else to present the app UI.
 * 
 * The idea is that things that create HTML live in /views/*.tsx, things that control
 * behaviour live in /controllers/*.ts, and they should communicate with each other using the
 * KeyStore singleton.
 */

export type T_AppMachineEvent = "EV_WSReady"   | 
                                "EV_ScanDone"  | 
                                "EV_ReqScan"   | 
                                "EV_Connected"  | 
                                "EV_SelectFirmware"   | 
                                "EV_FirmwareSelected" |
                                "EV_ReadLog"          | 
                                "EV_ReqDisconnect"    | 
                                "EV_FirmwareUpdated"  | 
                                "EV_LogRead"          | 
                                "EV_Disconnected";
export type T_AppMachineState = "Init" | 
                                "ConnectWSC" | 
                                "StartBLEScan" | 
                                "SelectDE1" | 
                                "ShowMenu" | 
                                "ReadLog" | 
                                "DoFirmwareSelect" | 
                                "DoFirmwareUpdate" | 
                                "Disconnect" | 
                                "Error";
 
function makeEvent(ev : T_AppMachineEvent) {
  return { type : ev };
}

type T_Connection = {
  name : string,
  mac  : string
}

export class AppController extends AsyncSimpleSM<I_SM_Event, T_AppMachineState>{
  // @ts-expect-error
  private static instance : AppController = AppController.instance || new AppController();
  static BLE0 = new BLE("BLE0", "ws://192.168.68.67:8765")
  // static BLE0 = new BLE("BLE0", "ws://127.0.0.1:8765")
  public static getInstance() {
      return AppController.instance;
  }

  dashcontroller = new DashboardController();
  MM   : MessageMaker = new MessageMaker();
  CurrentConnection : T_Connection | null = null;
  DebugLogList : DebugLogListItem[] = [];

  _updateReadyStatus = ( ready : boolean ) => {
    if (ready) {
      this.sendEventToSM({type : "EV_WSReady"});
    } else {
      this.sendEventToSM({type : "EV_Disconnected"});
    }
  }

  A_StartBLEScan = () => {
    console.log("AppMachine: A_StartBLEScan");
    const scancb = (done: boolean, entry : T_ScanResult) => {
      if (done) {
        this.sendEventToSM({type: "EV_ScanDone"});
      }
    }
    AppController.BLE0.requestScanWithCallbacks(3, scancb);
  }

  A_ShowMenu = () => {};

  A_HideMenu = () => {};

  A_ShowBLEScan = () => {
    this.dashcontroller.setActiveDrawer("Devices");
  };

  A_HideBLEScan = () => {};

  A_DoFirmwareUpdate = async () => {
    const filelist = KeyStore.getInstance().readKey("Updater", "firmwarefile") as FileList|null;
    if (!filelist || !this.CurrentConnection) return;

    const filedata = await filelist[0].arrayBuffer()
    console.log("this.CurrentConnection:", this.CurrentConnection)
    const res = await upload_Firmware(AppController.BLE0, this.CurrentConnection.mac, filedata);
    if (res.success) {
      console.log("Firmware upload succeeded")
    } else {
      console.log("Firmware upload failed: ", res.error)
    }

  };

  _readLEUInt32(buf : Buffer, offset : number = 0) : number {
    var arrbuff = Uint8Array.from(buf).buffer;
    var dv = new DataView(arrbuff, offset);
    return dv.getUint32(0, true);
  }

  
  wait = (ms : number) => {
    return new Promise((r, j)=>setTimeout(r, ms))
  }

  A_ReadLog = async () => {
    if (!this.CurrentConnection) {
      return;
    }
    const mac = this.CurrentConnection.mac

    var fro = await AppController.BLE0.setUpForMMRReads(mac);
    if (!fro.success) {
      console.log("A_ReadLog: Cound not enable MMR reads")
      return
    }
    
    console.log("Starting debug log read");
    const loglenresp = await AppController.BLE0.requestAsyncMMRRead(mac, MMRAddr.DebugLen, 0);
    console.log("A_ReadLog: ", loglenresp);
    const loglen = this._readLEUInt32(loglenresp.payload, 0);
    console.log("A_ReadLog: Log length is", loglen);
    if (loglen > 4096) {
      throw new Error(`Loglen of ${loglen} is out of range`);
    }
    if (loglen === 0) {
      return;
    }

    var resultarray = new Uint8Array(loglen);
    var pos = 0;
    while (pos < loglen) {
      console.log(`A_ReadLog: Reading at offset ${pos} out of ${loglen}`);
      try {
        var dataresp = await AppController.BLE0.requestAsyncMMRRead(mac, MMRAddr.DebugBuffer+pos, 3); // Read 16 bytes (16 >> 2)-1 = 3        
        resultarray.set(Array.from(dataresp.payload), pos);
        KeyStore.getInstance().updateKey("AppController", "debuglogprogress", pos*100.0/loglen)
      } catch (error) {
        console.log(error);        
      }
      pos += 16;
      // if ((pos % 1024) === 0) {
      //    await this.wait(1000);
      // }
    }
    await AppController.BLE0.requestAsyncMMRRead(mac, MMRAddr.DebugConfig, 0);

    var logstr : string = "";
    logstr += String.fromCharCode(...resultarray);      
    KeyStore.getInstance().updateKey('AppController', 'debuglog', logstr);
    this.DebugLogList.push({ name: (new Date()).toJSON(), log: logstr })
    KeyStore.getInstance().updateKey('AppController', 'debugloglist', this.DebugLogList, true);

    console.log("Debug log: ", logstr);

  };

  /*
  def write_FWMapRequest(ctic, WindowIncrement=0, FWToErase=0, FWToMap=0, FirstError=0, withResponse=True):
  data = struct.pack('>HBB3s', WindowIncrement, FWToErase, FWToMap, toU24P0(FirstError))
  ctic.write(data, withResponse=withResponse)
  */

  A_SendDisconnect = () => {};

  requestConnect = (name: string, mac : string) => {
    // Used by Devices view to tell us the addr to connect to
    const conncb : I_ConnectionStateCallback = (request : T_Request, update : T_ConnectionStateNotify) : boolean => {
      if (update.CState === "CONNECTED") {
        this.CurrentConnection = { name, mac };
        this.sendEventToSM({type: "EV_Connected"});
      }

      if (update.CState === "CANCELLED" || update.CState === "DISCONNECTED") {
        this.CurrentConnection = null;
        this.sendEventToSM({type: "EV_Disconnected"}); 
      }
      return false;
    }

    AppController.BLE0.requestGATTConnect(mac, conncb);
  }


  S_Init : I_SM_State_Fn<T_AppMachineState> = async (newtransition) => {
    AppController.BLE0.registerForReadyUpdates(this._updateReadyStatus);
    AppController.getInstance().dashcontroller.setActiveDrawer("Devices")
    return "ConnectWSC";
  }

  S_ConnectWSC : I_SM_State_Fn<T_AppMachineState> = async (newtransition) => {
    if (newtransition) {
      // If WSC is already connected, then no need to wait for a connection.
      if (AppController.BLE0.WSC.getReadyState() == WebSocket.OPEN) {
        // WebSocket is connected. Skip to next state.
        return "StartBLEScan";
      }
    }
    var nextstate : T_AppMachineState | null = null;
    const ev = this.getEvent()
    if (ev) {
      switch (ev.type) {
        case "EV_WSReady":
          nextstate =  "StartBLEScan";
          break;

        case "EV_Disconnected":
          nextstate = "Init";
          break;  
        
        default:
          // Illegal event?
          console.log("Unexpected event in S_ConnectWSC: ", ev)
          nextstate =  "Init"
          break;
      }
    }

    return nextstate;
  }

  S_StartBLEScan : I_SM_State_Fn<T_AppMachineState> = async (newtransition) => {
    if (newtransition) {
      this.dashcontroller.setActiveDrawer("Devices");
      this.A_StartBLEScan();
      AppController.getInstance().dashcontroller.setItemVisible("Devices", "Devices", true);
      return null;
    }

    var nextstate : T_AppMachineState | null = null;
    const ev = this.getEvent()
    if (ev) {
      switch (ev.type) {
        case "EV_ScanDone":
          nextstate = "SelectDE1"
          break;

        case "EV_Disconnected":
          nextstate = "Init";
          break;  
        
        default:
          console.log("Unexpected event in S_StartBLEScan: ", ev)
          // nextstate = "Init"
          break;
      }
    }

    return nextstate;
  }

  S_SelectDE1 : I_SM_State_Fn<T_AppMachineState> = async (newtransition) => {
    var nextstate : T_AppMachineState | null = null;
    const ev = this.getEvent()
    if (ev) {
      switch (ev.type) {
        case "EV_Connected":
          nextstate = "ShowMenu"
          break;
      
        case "EV_ReqScan":
          nextstate = "StartBLEScan";
          break;

        case "EV_Disconnected":
          nextstate = "Init";
          break;  

        default:
          console.log("Unexpected event in S_SelectDE1: ", ev)
          // nextstate = "Init"
          break;
      }
    }
    
    return nextstate;
  }

  S_ShowMenu : I_SM_State_Fn<T_AppMachineState> = async (newtransition) => { 
    if (newtransition) {
      // Hide selection menu
      // Show User Menu
      AppController.getInstance().dashcontroller.setItemVisible("UserMenu", "Devices", true);
      AppController.getInstance().dashcontroller.setItemVisible("Devices", "Devices", false);
    }
    var nextstate : T_AppMachineState | null = null;
    const ev = this.getEvent()
    if (ev) {
      switch (ev.type) {
        case "EV_ReadLog":
          nextstate = "ReadLog";
        break;
        case "EV_SelectFirmware":
          nextstate = "DoFirmwareSelect";
        break;
        case "EV_ReqDisconnect":
          nextstate = "Disconnect";
        break;
        case "EV_Disconnected":
          nextstate = "Init";
        break;
            
        default:
          break;
      }
    }

    if (nextstate !== null) {
      // We are exiting this state, so do any actions required
      AppController.getInstance().dashcontroller.setItemVisible("UserMenu", "Devices", false);
    }

    return nextstate;
  }

  S_ReadLog : I_SM_State_Fn<T_AppMachineState> = async (newtransition) => { 
    if (newtransition) {
      AppController.getInstance().dashcontroller.setItemVisible("DE1Info", "Devices", true);

      await this.A_ReadLog()
    }
    var nextstate : T_AppMachineState | null = null;
    const ev = this.getEvent()
    if (ev) {
      switch (ev.type) {
        case "EV_Disconnected":
          nextstate = "Init";
        break;
            
        default:
          break;
      }
    }

    if (nextstate !== null) {
      // We are exiting this state; do any actions required
      
    }

    return nextstate;
  }

  S_DoFirmwareSelect : I_SM_State_Fn<T_AppMachineState> = async (newtransition) => {
    if (newtransition) {
      // Start another async task that does firmware update
      const dc = AppController.getInstance().dashcontroller

      if (this.CurrentConnection) {
        dc.addItem("Updater", "Firmware", <Updater mac={this.CurrentConnection.mac} name={this.CurrentConnection.name} />, true);
        dc.setActiveDrawer("Firmware")
      }
    }
    
    var nextstate : T_AppMachineState | null = null;
    const ev = this.getEvent()
    if (ev) {
      switch (ev.type) {
        case "EV_Disconnected":
          nextstate = "Init";
        break;

        case "EV_FirmwareSelected":
          nextstate = "DoFirmwareUpdate"
        break;
            
        default:
          break;
      }
    }

    if (nextstate !== null) {
      // We are exiting this state; do any actions required
      
    }

    return nextstate;
  }

  S_DoFirmwareUpdate : I_SM_State_Fn<T_AppMachineState> = async (newtransition) => {
    if (newtransition) {
      await this.A_DoFirmwareUpdate()
    }
    
    var nextstate : T_AppMachineState | null = null;
    const ev = this.getEvent()
    if (ev) {
      switch (ev.type) {
        case "EV_Disconnected":
          nextstate = "Init";
        break;

        default:
          break;
      }
    }

    if (nextstate !== null) {
      // We are exiting this state; do any actions required
      
    }

    return nextstate;
  }

  S_Disconnect : I_SM_State_Fn<T_AppMachineState> = async (newtransition) => {
    if (newtransition) {
      console.log("AppMachine S_Disconnect() requesting disconnect from ", this.CurrentConnection)
      if (this.CurrentConnection) {
        const discb : I_ConnectionStateCallback = (request : T_Request, response : T_ConnectionStateNotify) : boolean => {
          console.log("S_Disconnect: Disconnect: ", response)
          this.sendEventToSM({type: "EV_Disconnected"});
          return false;
        }
        AppController.BLE0.requestGATTDisconnect(this.CurrentConnection.mac, discb);
      }
    }
    var nextstate : T_AppMachineState | null = null;
    const ev = this.getEvent()
    if (ev) {
      switch (ev.type) {
        case "EV_Disconnected":
          nextstate = "Init";
        break;
            
        default:
          break;
      }
    }

    if (nextstate !== null) {
      // We are exiting this state; do any actions required
      
    }

    return nextstate;
  }

  S_Error : I_SM_State_Fn<T_AppMachineState> = async (newtransition) => { return null }

  StateMap: Map<T_AppMachineState, I_SM_State_Fn<T_AppMachineState>> = new Map<T_AppMachineState, I_SM_State_Fn<T_AppMachineState>>(
    [
      ["Init", this.S_Init],
      ["ConnectWSC", this.S_ConnectWSC],
      ["StartBLEScan", this.S_StartBLEScan],
      ["SelectDE1", this.S_SelectDE1],
      ["ShowMenu", this.S_ShowMenu],
      ["ReadLog", this.S_ReadLog],
      ["DoFirmwareSelect", this.S_DoFirmwareSelect],
      ["DoFirmwareUpdate", this.S_DoFirmwareUpdate],
      ["Disconnect", this.S_Disconnect],
      ["Error", this.S_Error]
    ]);

  constructor() {
    super("Init"); // "Init" is the initial state of the machine.
    this.setStateCode(this.StateMap);
    KeyStore.getInstance().updateKey("AppController", "AppMachineState", this.CurrentState)
  }

  onTransition = () => {
    console.log(`AppMachine state transition: ${this.LastState} -> ${this.CurrentState}`);
    KeyStore.getInstance().updateKey("AppController", "AppMachineState", this.CurrentState)
  }

  _wschange = (owner: string, key: string, status: E_Status, before: any, after: any) => {
    // after is a WSState
    const state = after as WSState;
    if (state === WebSocket.OPEN) {
      this.sendEventToSM({type : "EV_WSReady"});
    };

    if (state === WebSocket.CLOSED) {
      this.sendEventToSM({type: "EV_Disconnected"});
    }
  }


  run = async () => {
    try {
      await this.evalSM();      
    } catch (error) {
      console.log("Exception in AppMachine.run(): ", error)
    }
    setTimeout(this.run, 10);
  }
}
