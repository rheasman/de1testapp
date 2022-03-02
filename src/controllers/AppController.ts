import { BLE, T_ScanResult, I_BLEResponseCallback, T_Request, T_IncomingMsg, MessageMaker } from "./BLE";
import { createMachine, EventObject, interpret } from 'xstate';
import { DashboardController } from "./DashboardController";
import { E_Status, KeyStore } from "../models/KeyStore";
import { WSState } from "./WSClient";
import { isWithStatement } from "typescript";
import { StarBorderPurple500 } from "@mui/icons-material";

export type T_AppMachineEvent = "EV_WSReady" | "EV_ScanDone" | "EV_Connected" | "EV_UpdateFirmware" | "EV_ReadLog" | "EV_ReqDisconnect" | "EV_FirmwareUpdated" | "EV_LogRead" | "EV_Disconnected";

export interface I_AppMachineContext {
  // Don't know if we'll use this for anything yet
}

export interface I_AppMachineEvent extends EventObject {
  type: T_AppMachineEvent;
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

export class AppController {
  // @ts-expect-error
  private static instance : AppController = AppController.instance || new AppController();
  static BLE0 = new BLE("BLE0", "ws://localhost:8765")
  public static getInstance() {
      return AppController.instance;
  }

  dashcontroller = new DashboardController();
  MM   : MessageMaker = new MessageMaker();

  _wschange = (owner: string, key: string, status: E_Status, before: any, after: any) => {
    // after is a WSState
    const state = after as WSState;
    if (state == WebSocket.OPEN) {
      this.sendEventToAppMachine({type : "EV_WSReady"});
    };

    if (state == WebSocket.CLOSED) {
      this.sendEventToAppMachine({type: "EV_Disconnected"});
    }
  }

  A_Init = (context : any, event: any) => {
    console.log("AppMachine: A_Init: ", context, event);
    console.log("this, this._wschange", this);
    KeyStore.getInstance().requestNotifyOnChanged(AppController.BLE0.WSCName, "readyState", this._wschange);
  }

  A_StartBLEScan = (context: any, event: any) => {
    console.log("AppMachine: A_StartBLEScan: ", context, event);
    const scancb = (done: boolean, entry : T_ScanResult) => {
      if (done) {
        this.sendEventToAppMachine({type: "EV_ScanDone"});
      }
    }
    AppController.BLE0.requestScanWithCallbacks(6, scancb);
  }

  A_ShowMenu = (context: any, event: any) => {};

  A_HideMenu = (context: any, event: any) => {};

  A_ShowBLEScan = (context: any, event: any) => {
    this.dashcontroller.setActiveDrawer("Devices");
  };

  A_HideBLEScan = (context: any, event: any) => {};

  A_DoFirmwareUpdate = (context: any, event: any) => {};

  A_ReadLog = (context: any, event: any) => {};

  A_SendDisconnect = (context: any, event: any) => {};
  
  /**
   * I decided to give the xstate library a try for my state machine. It does far more than I
   * need, but it does have automated tools that produce nice diagrams of the state machine.
   * 
   * See /docs/AppMachine*.png for an example. There is also a xstate visualizer/editor plugin
   * for vscode.
   * 
   * On the other hand the state description is hard to read and it's all much more complicated than
   * if I had just written my own state machine.
   *
   * It's all pure and functional and I don't need any of that, and it's getting in the way,
   * quite frankly.
   * 
   * So I don't know if I'll keep using it. It might not be worth the complexity just to
   * have a nice graph of the state machine.
   *
  */  
   AppMachine = 
   /** @xstate-layout N4IgpgJg5mDOIC5QBECiBGAygVwA64HsAnAFwEF8A6TAYwEMA7BgSwagGJUA1AfVseQEGYRKEKxmJZkNEgAHogC0AVgBsAJkoAGACyr0u9MoCcx9boA0IAJ5KdAZh2VVADjc7lWgOxfjqkwC+AVZoWHiEpBS41GAANmA0JKGcvADCQsKJkLLiktIMsgoIivaqxpRGWvb2LqZe6j6OVrbF9j6UOsYuysroftUO9spBIRg4+MTkVACqsGBEAPK4sNQAFgQA7gCyYAzYKTzTuBB0JGAAYsxEALYbdEQiSCC5UjJPRYrqyhUu6jo66hcqlUbX+qmadjcHWU-yMnVMynsxhGIFC4wiU2is3mSxWmHW212+24PAASmA6BAADIEKA5AgSV4Fd6IUyUUxDLzKRqqHReDQQ4oNdCURHodR+P6A+zodAotHhSZRSjYxbLNabHZ7A7IZiwGgZBIkemM-KFJReFyivl+fTGGFeIzGQWfK0OYzof7GIaArTGLzysaKyIzOZqlaCS43O4PI4nM4HKO3e5gOOnbJPF5mlkIWVW7mqLlInRafxc9Au9BIyhctR88x9Fz8nSBsITENYsO4yjkyk0jgk-u9iAmvJvUBFcWaLTqdBlD1eezqYEOF1DJxVrwl4xaFxaUs1VvopWhnHLHV6g1MI0ZsQMsfMidKbnlUo73f81S6D2VrxabQekCf79IuiJBMEIAMAQEBwLICrtpi1D0EwrB0pm95MuaxT8l4lBIpUtRVrUvwug4ThNj4kpFryR7BohmBxEaoSjphOYqLy7IgvaJg+PUc4uoCVp-ACcLqOoxaqLRCHKqq3b4pqRIsdmT7YU4O7GB4eizkCWh9Guc4dN04qep6+gmMMEHwRiMlduqkZXMmsbHOmSnjvIiA9PYHSWvWjpfOKOgCX0nGOMuS7oECxFSdZp7hj2FLUrSrmPu5CAyqolB-CY6B-jUtTgjYShLv+vL2LpAI+Nyc4tpZQbSbFcm7BAur6oaiTJVhLgip0Hg5Xo-w+F1grcoZnh+p0spqFuFmjG2MWdme8DoaabkfAYmgOrafQOk6LpqN1MIAl+wLAr80UnrgHVsb4Ir4Z4hE1F06guiCTiaToRF8WB4FAA */
   createMachine<I_AppMachineContext, I_AppMachineEvent>(
    {
      "id": "DE1SupportApp",
      "initial": "Init",
      "states": {
        "Init": {
          "entry": "A_Init",
          "on": {
            "EV_WSReady": {
              "target": "#DE1SupportApp.StartBLEScan"
            }
          }
        },
        "SelectDE1": {
          "exit": "A_HideBLEScan",
          "entry": "A_ShowBLEScan",
          "on": {
            "EV_Connected": {
              "target": "#DE1SupportApp.UserOps.ShowMenu"
            }
          }
        },
        "UserOps": {
          "initial": "ShowMenu",
          "states": {
            "ShowMenu": {
              "exit": "A_HideMenu",
              "entry": "A_ShowMenu",
              "on": {
                "EV_UpdateFirmware": {
                  "target": "#DE1SupportApp.UserOps.DoFirmwareUpdate"
                },
                "EV_ReadLog": {
                  "target": "#DE1SupportApp.UserOps.ReadLog"
                },
                "EV_ReqDisconnect": {
                  "target": "#DE1SupportApp.UserOps.SendDisconnect"
                }
              }
            },
            "DoFirmwareUpdate": {
              "entry": "A_DoFirmwareUpdate",
              "on": {
                "EV_FirmwareUpdated": {
                  "target": "#DE1SupportApp.UserOps.ShowMenu"
                }
              }
            },
            "ReadLog": {
              "entry": "A_ReadLog",
              "on": {
                "EV_LogRead": {
                  "target": "#DE1SupportApp.UserOps.ShowMenu"
                }
              }
            },
            "SendDisconnect": {
              "type": "final",
              "entry": "A_SendDisconnect"
            }
          },
          "on": {
            "EV_Disconnected": {
              "target": "#DE1SupportApp.StartBLEScan"
            }
          }
        },
        "StartBLEScan": {
          "entry": "A_StartBLEScan",
          "on": {
            "EV_ScanDone": {
              "target": "#DE1SupportApp.SelectDE1"
            }
          }
        }
      }
    }        , 
    { actions: 
      {
        A_Init : this.A_Init,
        A_StartBLEScan: this.A_StartBLEScan,
        A_ShowMenu: this.A_ShowMenu,
        A_HideMenu: this.A_HideMenu,
        A_ShowBLEScan: this.A_ShowBLEScan,
        A_HideBLEScan : this.A_HideBLEScan,
        A_DoFirmwareUpdate: this.A_DoFirmwareUpdate,
        A_ReadLog: this.A_ReadLog,
        A_SendDisconnect : this.A_SendDisconnect
      }
    }
  ) // End AppMachine
   
  AppMachineService = interpret(this.AppMachine).onTransition((state) => {
     console.log("AppMachine state transition: ", state.value);
     KeyStore.getInstance().updateKey("AppController", "AppMachineState", state)
  });

  sendEventToAppMachine = (event: I_AppMachineEvent) => {
    this.AppMachineService.send(event);
  }

  requestConnect = (addr : string) => {
    // Used by Devices view to tell us the addr to connect to
    const conncb : I_BLEResponseCallback = (request : T_Request, response : T_IncomingMsg) : boolean => {
      let update = this.MM.connStateFromUpdate(this.MM.updateFromMsg(response));
      if (update.CState === "CONNECTED") {
        this.sendEventToAppMachine({type: "EV_Connected"});
      }

      if (update.CState === "CANCELLED" || update.CState === "DISCONNECTED") {
        this.sendEventToAppMachine({type: "EV_Disconnected"});
      }
      return false;
    }
    AppController.BLE0.requestGATTConnect(addr, conncb);
  }

  start = () => {
    this.AppMachineService.start();
  }

}
