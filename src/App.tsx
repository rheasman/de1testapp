import React from "react";
import { AppController } from "./controllers/AppController";
import { Dashboard } from "./views/Dashboard";
import DashboardIcon from '@mui/icons-material/Dashboard';
import BluetoothSearchingIcon from '@mui/icons-material/BluetoothSearching';
import Devices from "./views/Devices";
import Updater from "./views/Updater";
import { DrawerContentType } from "./controllers/DashboardController";
import WSClient from "./views/WSClient";
import { HardwareSharp, TableRowsSharp } from "@mui/icons-material";
import { DE1Info } from "./views/DE1Info";
import { UserMenu } from "./views/UserMenu";

interface AppProps {
  
}
 
interface AppState {
}

type T_DrawerContent = [string, JSX.Element, boolean]
type T_DrawerItem = [string, any, T_DrawerContent[]];

/**
 * ADD AND REMOVE DASHBOARD CATEGORIES AND CARDS HERE
 *                  |
 *                  |
 *                  V
 */
const draweritems: T_DrawerItem[] = [
  ["Firmware", <HardwareSharp />,
    [
      ["Updater", <Updater />, false]
    ]
  ],
  ["Status", <DashboardIcon />,
    [
      ["WSClient", <WSClient name="wsc_BLE0"/>, true]
    ]
  ],
  ["Devices", <BluetoothSearchingIcon />, 
    [
      ["UserMenu", <UserMenu />, false],
      ["DE1Info", <DE1Info mac=""/>, false],
      ["Devices", <Devices name="BLE0"/>, true],
      ["WSClient", <WSClient name="wsc_BLE0"/>, true],
    ]
  ]
  // ["MMRs", <TableRowsSharp />, [["MMRs", <MMR_UI />, false]]
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
  }
 
  toDrawerContentType(inputarr : T_DrawerContent[]): DrawerContentType[] {
    return inputarr.map((val) => {
      return { name: val[0], item: val[1], visible: val[2] };
    })
  }

  render() { 
    return (
      <Dashboard controller={AppController.getInstance().dashcontroller}/>
    );
  }
}
 
export default App;