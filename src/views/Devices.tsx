//import * as React from 'react';
import React, { Component } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Title from './Title';
import { E_Status, NotifyCallbackType } from '../models/KeyStore';
import KeyStore from '../models/KeyStore';
import { I_BLEResponseCallback, DeviceMap } from '../controllers/BLE';
import { T_IncomingMsg, T_Request, T_ConnectionState } from "../controllers/MessageMaker";
import { ConnectWithoutContactSharp, DoNotDisturbOnSharp, RadarSharp, BluetoothConnectedSharp } from '@mui/icons-material';
import { Box, CircularProgress, IconButton, Stack } from '@mui/material';
import { AppController, T_AppMachineState } from '../controllers/AppController';
import "./Devices.css";
import { height, width } from '@mui/system';

type RowDataType = {
  addr : string,
  name : string,
  cstate : T_ConnectionState
}

function row_compare(a: RowDataType, b: RowDataType): number {
  if (a.addr === b.addr) {
    return 0;
  }
  return (a.addr > b.addr) ? -1 : 1
}

type MyState = {
  rows : RowDataType[];
  allowConnect : boolean;
}

type MyProps = {
  name: string
}

// Generate Machine Data
class Devices extends Component<MyProps, MyState> {
  state : MyState;
  constructor(props : MyProps) {
    super(props);
    console.log("Devices()");
    console.log("props:", props);
    this.state = {
      rows : [this.createData("","", "DISCONNECTED")],
      allowConnect : false
    }
    console.log("this.state:", this.state);
  }

  componentDidMount() {
    KeyStore.getInstance().requestNotifyOnChanged(this.props.name, "DeviceSet", this.onDeviceChange)
    KeyStore.getInstance().requestNotifyOnChanged("AppController", "AppMachineState", this.onStateChange)
    this.setState({rows : this.rowsFromStore(), allowConnect: false})
  }

  componentWillUnmount() {
    KeyStore.getInstance().cancelNotify(this.props.name, "DeviceSet", this.onDeviceChange)
    KeyStore.getInstance().cancelNotify("AppController", "AppMachineState", this.onStateChange)
  }

  onStateChange : NotifyCallbackType = (owner, key, status, before, after : T_AppMachineState): void  => {
    console.log("onStateChange:", owner, key, status, before, after)

    if (after === "SelectDE1") {
      this.setState({allowConnect : true})
    } else {
      this.setState({allowConnect : false})
    }
  }

  onDeviceChange : NotifyCallbackType = (owner, key, status, before, after : DeviceMap): void  => {
    console.log("onDeviceChange:", owner, key, status, before, after)

    // "after" will be the DeviceSet
    if ((status === E_Status.Changed) || (status === E_Status.Added)) {
      let darr = [];
      for (var device of after.keys()) {
        const dev = after.get(device);
        if (dev) {
          darr.push(this.createData(dev.MAC, dev.Name, dev.State));
        }
      } 
      darr.sort(row_compare);
      this.setState({ rows: darr });
    }
  }

  rowsFromStore(): RowDataType[] {
    let darr = [];
    let devices : DeviceMap = KeyStore.getInstance().readKey(this.props.name, "DeviceSet");
    if (devices !== undefined) {
      for (var device of devices.keys()) {
        const dev = devices.get(device);
        if (dev) {
          darr.push(this.createData(dev.MAC, dev.Name, dev.State));
        }
      }
      darr.sort(row_compare);  
    } else {
      darr.push(this.createData("-", "-", "DISCONNECTED"));
    }
    //this.setState({ rows: darr });
    return darr;
  }

  addDevice(addr: string, name: string, cstate: T_ConnectionState) {
    this.state.rows.push(this.createData(addr, name, cstate))
  }

  createData(addr: string, name: string, cstate : T_ConnectionState): RowDataType {
    return { addr, name, cstate };
  }

  preventDefault(event: any) {
    event.preventDefault();
  }

  disconnect(name : string, addr : string) {
    console.log("Device onClick() disconnect from ", name, addr)
    const discb : I_BLEResponseCallback = (request : T_Request, response : T_IncomingMsg) : boolean => {
      console.log("Devices: Disconnect: ", response)
      return false;
    }
    AppController.BLE0.requestGATTDisconnect(addr, discb);
  }
  
  connect(name : string, addr : string) {
    console.log("Device onClick() connect to ", name, addr)
    AppController.getInstance().requestConnect(addr);
  }

  connectIcon(name : string, addr : string, cstate : T_ConnectionState): JSX.Element {
    var buttonstyle={width: '24px', height: '24px', margin: '5px'};

    if (name === "DE1") {
      if (cstate !== "CONNECTED") {
        if (this.state.allowConnect) {
          // A button that allows connecting
          return (
            <TableCell>
              <div className="cell-button">
                <IconButton onClick={ () => {this.connect(name, addr)} }>
                  <ConnectWithoutContactSharp />
                </IconButton>
              </div>
            </TableCell>
          )    
        } else {
          return (
            // A button that shows we are not ready to connect
            <TableCell>
              <div className="cell-button" >
                <CircularProgress style={buttonstyle}/>
              </div>
            </TableCell>
          )
        }
      } else {
        return (
          // A button that shows we are connected
          <TableCell>
            <div className="cell-button">
              <IconButton onClick={ () => {this.disconnect(name, addr)} } style={buttonstyle}>
                <BluetoothConnectedSharp/>
              </IconButton>
            </div>    
          </TableCell>
        )  
      }
    } else {
      return (
        <TableCell>
          <div className="cell-button">        
            <IconButton style={buttonstyle}>
              <DoNotDisturbOnSharp />
            </IconButton>
          </div>
        </TableCell>
      )
    }
  }

  reqScan() {
    // AppController.BLE0.requestScanWithCallbacks(6, null);
    AppController.getInstance().sendEventToSM({type: "EV_ReqScan"});
  }

  render() { 
    var scan;
    
    if (this.state.allowConnect) {
      scan = (
        <div className='scan'>
          <IconButton onClick={this.reqScan}><RadarSharp />Scan</IconButton>
        </div>
      )
    } else {
      scan = (
        <CircularProgress /> // style={{width: '30px', height: '30px', margin: '5px'}}/>
      )
    };

    return (
      <div className='device-card'>
        <Title>Seen Devices</Title>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>BLE Name</TableCell>
              <TableCell>BLE Address</TableCell>
              <TableCell>Connect</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {this.state.rows.map((row) => (
              <TableRow key={row.addr}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.addr}</TableCell>
                {this.connectIcon(row.name, row.addr, row.cstate)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {scan}
      </div> 
    )
  }
}
 
export default Devices;

/*
import * as React from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

export default function CircularIndeterminate() {
  return (
    <Box sx={{ display: 'flex' }}>
      <CircularProgress />
    </Box>
  );
}
*/