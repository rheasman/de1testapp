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
import { I_BLEResponseCallback, DeviceMap, T_IncomingMsg, T_Request, T_ConnectionState } from '../controllers/BLE';
import { ConnectWithoutContactSharp, DoNotDisturbOnSharp, RadarSharp, BluetoothConnectedSharp } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { AppController } from '../controllers/AppController';

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
      rows : [this.createData("","", "DISCONNECTED")]
    }
    console.log("this.state:", this.state);
  }

  componentDidMount() {
    KeyStore.getInstance().requestNotifyOnChanged(this.props.name, "DeviceSet", this.onDeviceChange)
    this.setState({rows : this.rowsFromStore()})
  }

  componentWillUnmount() {
    KeyStore.getInstance().cancelNotify(this.props.name, "DeviceSet", this.onDeviceChange)
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
    if (name === "DE1") {
      if (cstate != "CONNECTED") {
        return (
          <TableCell><IconButton onClick={ () => {this.connect(name, addr)} }><ConnectWithoutContactSharp /></IconButton></TableCell>
        )  
      } else {
        return (
          <TableCell><IconButton onClick={ () => {this.disconnect(name, addr)} }><BluetoothConnectedSharp /></IconButton></TableCell>
        )  
      }
    } else {
      return (<TableCell><IconButton><DoNotDisturbOnSharp /></IconButton></TableCell>)
    }
  }

  reqScan() {
    AppController.BLE0.requestScanWithCallbacks(6, null);
  }

  render() { 
    return (
      <React.Fragment>
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
        <IconButton onClick={this.reqScan}><RadarSharp />Scan</IconButton>
      </React.Fragment>
    );
  }
}
 
export default Devices;
