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
import { DeviceMap } from '../controllers/BLE';
import { ConnectWithoutContactSharp, DoNotDisturbOnSharp, RadarSharp } from '@mui/icons-material';
import { Button, Icon, IconButton } from '@mui/material';

type RowDataType = {
  addr : string,
  name : string
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
      rows : [this.createData("","")]
    }
    console.log("this.state:", this.state);
  }

  componentDidMount() {
    KeyStore.instance.requestNotifyOnChanged(this.props.name, "DeviceSet", this.onDeviceChange)
    this.setState({rows : this.rowsFromStore()})
  }

  componentWillUnmount() {
    KeyStore.instance.cancelNotify(this.props.name, "DeviceSet", this.onDeviceChange)
  }

  onDeviceChange : NotifyCallbackType = (owner, key, status, before, after)  => {
    console.log("onDeviceChange:", owner, key, status, before, after)

    // "after" will be the DeviceSet
    if ((status === E_Status.Changed) || (status === E_Status.Added)) {
      let darr = [];
      for (var device of after.keys()) {
        darr.push(this.createData(device.addr, device.name));
      }
      darr.sort(row_compare);
      this.setState({ rows: darr });
    }
  }

  rowsFromStore(): RowDataType[] {
    let darr = [];
    let devices : DeviceMap = KeyStore.instance.readKey(this.props.name, "DeviceSet");
    if (devices !== undefined) {
      for (var device of devices.keys()) {
        darr.push(this.createData(device.addr, device.name));
      }
      darr.sort(row_compare);  
    } else {
      darr.push(this.createData("-", "-"));
    }
    //this.setState({ rows: darr });
    return darr;
  }

  addDevice(addr: string, name: string) {
    this.state.rows.push(this.createData(addr, name))
  }

  createData(addr: string, name: string): RowDataType {
    return { addr, name };
  }

  preventDefault(event: any) {
    event.preventDefault();
  }
  
  connectIcon(name : string): JSX.Element {
    if (name === "DE1") {
      return (
        <TableCell><IconButton><ConnectWithoutContactSharp /></IconButton></TableCell>
      )
    } else {
      return (<TableCell><IconButton><DoNotDisturbOnSharp /></IconButton></TableCell>)
    }
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
                {this.connectIcon(row.name)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <IconButton><RadarSharp /></IconButton>
      </React.Fragment>
    );
  }
}
 
export default Devices;
