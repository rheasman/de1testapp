import { BLE, I_BLEResponseCallback } from "./BLE";
import { T_ScanResult, T_Request, T_IncomingMsg, MessageMaker } from "./MessageMaker";
import { DashboardController } from "./DashboardController";
import { E_Status, KeyStore } from "../models/KeyStore";
import { WSState } from "./WSClient";
import { MMRAddr } from "./MMRList";

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

export type T_AppMachineEvent = "EV_WSReady" | "EV_ScanDone" | "EV_ReqScan" | "EV_Connected" | "EV_UpdateFirmware" | "EV_ReadLog" | "EV_ReqDisconnect" | "EV_FirmwareUpdated" | "EV_LogRead" | "EV_Disconnected";
export type T_AppMachineState = "Init" | "ConnectWSC" | "StartBLEScan" | "SelectDE1" | "ShowMenu" | "ReadLog" | "DoFirmwareUpdate" | "Disconnect" | "Error";
 
function makeEvent(ev : T_AppMachineEvent) {
  return { type : ev };
}

export class AppController extends AsyncSimpleSM<I_SM_Event, T_AppMachineState>{
  // @ts-expect-error
  private static instance : AppController = AppController.instance || new AppController();
  static BLE0 = new BLE("BLE0", "ws://localhost:8765")
  public static getInstance() {
      return AppController.instance;
  }

  dashcontroller = new DashboardController();
  MM   : MessageMaker = new MessageMaker();
  CurrentConnection : string | null = null;


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
    AppController.BLE0.requestScanWithCallbacks(6, scancb);
  }

  A_ShowMenu = () => {};

  A_HideMenu = () => {};

  A_ShowBLEScan = () => {
    this.dashcontroller.setActiveDrawer("Devices");
  };

  A_HideBLEScan = () => {};

  A_DoFirmwareUpdate = () => {};

  A_ReadLog = async () => {
    if (!this.CurrentConnection) {
      return;
    }
    await AppController.BLE0.setUpForMMRReads(this.CurrentConnection);
    
    const result = await AppController.BLE0.requestAsyncMMRRead(this.CurrentConnection, MMRAddr.CPUFirmwareBuild, 0);
    console.log("A_ReadLog: ", result);
  };

  A_SendDisconnect = () => {};

  requestConnect = (addr : string) => {
    // Used by Devices view to tell us the addr to connect to
    const conncb : I_BLEResponseCallback = (request : T_Request, response : T_IncomingMsg) : boolean => {
      let update = this.MM.connStateFromUpdate(this.MM.updateFromMsg(response));
      if (update.CState === "CONNECTED") {
        this.CurrentConnection = addr;
        this.sendEventToSM({type: "EV_Connected"});
      }

      if (update.CState === "CANCELLED" || update.CState === "DISCONNECTED") {
        this.CurrentConnection = null;
        this.sendEventToSM({type: "EV_Disconnected"}); 
      }
      return false;
    }
    AppController.BLE0.requestGATTConnect(addr, conncb);
  }


  S_Init : I_SM_State_Fn<T_AppMachineState> = async (newtransition) => {
    AppController.BLE0.registerForReadyUpdates(this._updateReadyStatus);
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
          nextstate = "Init"
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
          nextstate = "Init"
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
        case "EV_UpdateFirmware":
          nextstate = "DoFirmwareUpdate";
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
      // Start another async task that does log reading.
      await this.A_ReadLog();
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

  S_DoFirmwareUpdate : I_SM_State_Fn<T_AppMachineState> = async (newtransition) => {
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
        const discb : I_BLEResponseCallback = (request : T_Request, response : T_IncomingMsg) : boolean => {
          console.log("S_Disconnect: Disconnect: ", response)
          this.sendEventToSM({type: "EV_Disconnected"});
          return false;
        }
        AppController.BLE0.requestGATTDisconnect(this.CurrentConnection, discb);
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
    setTimeout(this.run, 1);
  }
}
