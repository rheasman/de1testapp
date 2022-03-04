import * as React from "react";
import { AppController } from "../controllers/AppController";
import { T_ConnectionState } from "../controllers/MessageMaker";

type T_DE1InfoState = {
  cstate : T_ConnectionState
}

type T_DE1InfoProps = {
  mac : string,
}

export class DE1Info extends React.Component<T_DE1InfoProps, T_DE1InfoState> {
  constructor(props : T_DE1InfoProps) {
    super(props);
    this.state = {
      cstate : AppController.BLE0.SeenDevices.get(props.mac)?.State || "DISCONNECTED"
    }
  }

  render() {
    return (
      <div>
        Hello world
      </div>
    )
  }
}