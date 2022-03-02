import React from "react";
import { AppController } from "./controllers/AppController";
import { Dashboard } from "./views/Dashboard";
import DashboardIcon from '@mui/icons-material/Dashboard';
import BluetoothSearchingIcon from '@mui/icons-material/BluetoothSearching';
import Devices from "./views/Devices";
import Updater from "./views/Updater";
import { DashboardController, DrawerContentType } from "./controllers/DashboardController";
import WSClient from "./views/WSClient";
import { HardwareSharp, TableRowsSharp } from "@mui/icons-material";
import { DE1Info } from "./views/DE1Info";

interface AppProps {
  
}
 
interface AppState {
}

type T_DrawerContent = [string, JSX.Element]
type T_DrawerItem = [string, any, T_DrawerContent[]];

/**
 * ADD AND REMOVE DASHBOARD CATEGORIES AND CARDS HERE
 *                  |
 *                  |
 *                  V
 */
const draweritems: T_DrawerItem[] = [
  ["Firmware", <HardwareSharp />, [["Updater", <Updater />]]],
  ["Status", <DashboardIcon />, [["WSClient", <WSClient name="wsc_BLE0"/>]]],
  ["Devices", <BluetoothSearchingIcon />, [["DE1Info", <DE1Info mac=""/>], ["Devices", <Devices name="BLE0"/>], ["WSClient", <WSClient name="wsc_BLE0"/>]]]
  // ["MMRs", <TableRowsSharp />, [["MMRs", <MMR_UI />]]
]

/**
 * This is the view for the App.
 * 
 * ie. There should be no code here that controls how the app behaves. The code here is
 * to show the app to the user.
 * 
 */
class App extends React.Component<AppProps, AppState> {
  // All control code lives in the App Controller and its children.

  constructor(props: AppProps) {
    super(props);
    console.log("props: ", props)
  }

  componentDidMount() {
    console.log("cdm: ", this);
    draweritems.forEach((item: T_DrawerItem) => {AppController.getInstance().dashcontroller.addDrawer(item[0], item[1], this.toDrawerContentType(item[2]))});
    AppController.getInstance().dashcontroller.setActiveDrawer("Devices");
    AppController.getInstance().start();
  }
 
  toDrawerContentType(inputarr : T_DrawerContent[]): DrawerContentType[] {
    return inputarr.map((val) => {
      return { name: val[0], item: val[1]};
    })
  }

  render() { 
    return (
      <div><Dashboard controller={AppController.getInstance().dashcontroller}/></div>
    );
  }
}
 
export default App;