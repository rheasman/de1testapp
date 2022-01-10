import React from "react";
import { AppController } from "./controllers/AppController";
import { Dashboard } from "./views/Dashboard";
import DashboardIcon from '@mui/icons-material/Dashboard';
import BluetoothSearchingIcon from '@mui/icons-material/BluetoothSearching';
import Devices from "./views/Devices";
import Updater from "./views/Updater";
import { DashboardController, DrawerContentType } from "./controllers/DashboardController";
import WSClient from "./views/WSClient";
import { HardwareSharp } from "@mui/icons-material";

interface AppProps {
  
}
 
interface AppState {
}

type T_DrawerContent = [string, JSX.Element]
type T_DrawerItem = [string, any, T_DrawerContent[]];

const draweritems: T_DrawerItem[] = [
  ["Firmware", <HardwareSharp />, [["Updater", <Updater />]]],
  ["Status", <DashboardIcon />, [["WSClient", <WSClient name="wsc_BLE0"/>]]],
  ["Devices", <BluetoothSearchingIcon />, [["Devices", <Devices name="BLE0"/>]]]
]

class App extends React.Component<AppProps, AppState> {
  appcontroller = new AppController();
  dashcontroller = new DashboardController();

  constructor(props: AppProps) {
    super(props);
    console.log("props: ", props)
  }

  componentDidMount() {
    console.log("cdm: ", this.dashcontroller)
    draweritems.forEach((item: T_DrawerItem) => {this.dashcontroller.addDrawer(item[0], item[1], this.toDrawerContentType(item[2]))});
    this.dashcontroller.setActiveDrawer("Status");
  }
 
  toDrawerContentType(inputarr : T_DrawerContent[]): DrawerContentType[] {
    return inputarr.map((val) => {
      return { name: val[0], item: val[1]};
    })
  }

  render() { 
    return (
      <div><Dashboard controller={this.dashcontroller}/></div>
    );
  }
}
 
export default App;