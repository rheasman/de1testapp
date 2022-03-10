import React, { Component } from 'react';
import { AppController } from '../controllers/AppController';
import "./UserMenu.css";

type MyState = {
}

type MyProps = {
}

// Generate Machine Data
export class UserMenu extends Component<MyProps, MyState> {
  state : MyState;
  constructor(props : MyProps) {
    super(props);
    this.state = {
    }
    console.log("UserMenu constructor state:", this.state);
  }

  makeOnclick = (item : number) => {
    return ( () => {
      switch (item) {
        case 0:
          AppController.getInstance().sendEventToSM({type : 'EV_ReadLog'});
          break;
        case 1:
          AppController.getInstance().sendEventToSM({type : 'EV_UpdateFirmware'});
          break;
        case 2:
          AppController.getInstance().sendEventToSM({type : 'EV_ReqDisconnect'});
          break;
      
        default:
          break;
      }
    })
  }


  render() { 
    return (
    <div className="user-menu">
      <button type="button" onClick={this.makeOnclick(0)}>Read Debug Log</button>
      <button type="button" onClick={this.makeOnclick(1)}>Update Firmware</button>
      <button type="button" onClick={this.makeOnclick(2)}>Disconnect</button>
    </div>
    )
  }
}
