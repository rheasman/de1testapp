import { BLE, I_BLEResponseCallback } from "./BLE";
import { T_ScanResult, T_Request, T_IncomingMsg, MessageMaker } from "./MessageMaker";
import { DashboardController } from "./DashboardController";
import { E_Status, KeyStore } from "../models/KeyStore";
import { WSState } from "./WSClient";

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

export type T_AppMachineEvent = "EV_WSReady" | "EV_ScanDone" | "EV_Connected" | "EV_UpdateFirmware" | "EV_ReadLog" | "EV_ReqDisconnect" | "EV_FirmwareUpdated" | "EV_LogRead" | "EV_Disconnected";
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

  A_ReadLog = () => {};

  A_SendDisconnect = () => {};

  requestConnect = (addr : string) => {
    // Used by Devices view to tell us the addr to connect to
    const conncb : I_BLEResponseCallback = (request : T_Request, response : T_IncomingMsg) : boolean => {
      let update = this.MM.connStateFromUpdate(this.MM.updateFromMsg(response));
      if (update.CState === "CONNECTED") {
        this.sendEventToSM({type: "EV_Connected"});
      }

      if (update.CState === "CANCELLED" || update.CState === "DISCONNECTED") {
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
    const ev = this.getEvent()
    if (ev) {
      switch (ev.type) {
        case "EV_WSReady":
          return "StartBLEScan";
          break;
      
        default:
          // Illegal event?
          console.log("Unexpected event in S_ConnectWSC: ", ev)
          break;
      }
    }

    return null;
  }

  S_StartBLEScan : I_SM_State_Fn<T_AppMachineState> = async (newtransition) => {
    if (newtransition) {
      this.dashcontroller.setActiveDrawer("Devices");
      this.A_StartBLEScan();
      return null;
    }
    const ev = this.getEvent()
    if (ev) {
      switch (ev.type) {
        case "EV_ScanDone":
          return "SelectDE1"
          break;
      
        default:
          console.log("Unexpected event in S_StartBLEScan: ", ev)
          break;
      }
    }

    return null;
  }

  S_SelectDE1 : I_SM_State_Fn<T_AppMachineState> = async (newtransition) => {
    const ev = this.getEvent()
    if (ev) {
      switch (ev.type) {
        case "EV_Connected":
          return "ShowMenu"
          break;
      
        default:
          console.log("Unexpected event in S_SelectDE1: ", ev)
          break;
      }
    }
    
    return null;
  }

  S_ShowMenu : I_SM_State_Fn<T_AppMachineState> = async (newtransition) => { 

    return null;
  }
  S_ReadLog : I_SM_State_Fn<T_AppMachineState> = async (newtransition) => { return "Error" }
  S_DoFirmwareUpdate : I_SM_State_Fn<T_AppMachineState> = async (newtransition) => { return "Error" }
  S_Disconnect : I_SM_State_Fn<T_AppMachineState> = async (newtransition) => { return "Error" }
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
    await this.evalSM();
    setTimeout(this.run, 1);
  }
}
