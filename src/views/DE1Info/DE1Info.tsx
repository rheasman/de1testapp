import * as React from "react";
import { AppController } from "../../controllers/AppController";
import { T_ConnectionState } from "../../controllers/MessageMaker";
import KeyStore, { E_Status, NotifyCallbackType } from "../../models/KeyStore";
import { LinearProgressWithLabel } from "../LinearProgressWithLabel";
import Title from '../Title';

type T_DE1InfoState = {
  cstate : T_ConnectionState
  progress : number,
  updatecount : number
}

type T_DE1InfoProps = {
  mac : string,
}

export class DE1Info extends React.Component<T_DE1InfoProps, T_DE1InfoState> {
  LogLines : string[] = [];

  constructor(props : T_DE1InfoProps) {
    super(props);
    this.state = {
      cstate : AppController.BLE0.SeenDevices.get(props.mac)?.State || "DISCONNECTED",
      progress : 0.0,
      updatecount : 0
    }
  }

  componentDidMount() {
    KeyStore.getInstance().requestNotifyOnChanged("AppController", "debuglog", this._updateLog)
    KeyStore.getInstance().requestNotifyOnChanged("AppController", "debuglogprogress", this._updateProgress)    
  }

  componentWillUnmount() {
    KeyStore.getInstance().cancelNotify("AppController", "debuglog", this._updateLog)
    KeyStore.getInstance().cancelNotify("AppController", "debuglogprogress", this._updateProgress)
  }

  updateLog = () => {
    var log = KeyStore.getInstance().readKey("AppController", "debuglog")
    if (log) {
      this.LogLines = log.split("\n")
    }
  }

  _updateProgress : NotifyCallbackType = (owner: string, key: string, status: E_Status, before: any, after: any) => {
    const percentage : number = after;
    this.setState({progress : percentage})
  }

  _updateLog : NotifyCallbackType = (owner: string, key: string, status: E_Status, before: any, after: any) => {
    this.updateLog();
    this.setState({updatecount : (this.state.updatecount + 1)})
  }
  
  render() {
    this.updateLog()
    return (
      <div className='de1info-card'>
      <Title>Debug log</Title>
      { (this.LogLines.length == 0) && <LinearProgressWithLabel value={this.state.progress}></LinearProgressWithLabel> }
      <p className='debuglog' style={{fontFamily : 'monospace', fontSize : 'x-small'}}>
        { this.LogLines.map( (val:string) => {
          return <React.Fragment>{val} <br></br></React.Fragment>
        })
      }
      </p>
      </div>
    )
  }
}