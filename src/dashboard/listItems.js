import * as React from 'react';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PeopleIcon from '@mui/icons-material/People';
import BarChartIcon from '@mui/icons-material/BarChart';
import LayersIcon from '@mui/icons-material/Layers';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BluetoothSearchingIcon from '@mui/icons-material/BluetoothSearching';

const draweritems = [
  ["Status", <DashboardIcon />],
  ["Devices", <BluetoothSearchingIcon />]
]


export default class ListItems extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      activeItem: 0,
      draweritems: props.draweritems
    };
  }

  makeListItem(details) {
    activeitem = this.state.draweritems[this.state.activeItem];
    active = (details === activeitem);

    return (
      <ListItem key={details[0]}>
        <ListItemIcon>
          {details[1]}
        </ListItemIcon>
        <ListItemText primary={details[0]} />
      </ListItem>
    )
  }
  
  // We want to show the current status: Connecting, uploading, disconnecting, done.
  // Also want a progress bar.
  render() {
  }
}

function toggleDrawer() {
  console.log('Clicked');
}

function makeListItem(details) {
  return (
    <ListItem key={details[0]}>
      <ListItemIcon>
        {details[1]}
      </ListItemIcon>
      <ListItemText primary={details[0]} />
    </ListItem>
  )
}


export const mainListItems = (
  <div>
    {draweritems.map(makeListItem)}
    {/* <ListItem button onClick={toggleDrawer}>
      <ListItemIcon>
        <DashboardIcon />
      </ListItemIcon>
      <ListItemText primary="Status" />
    </ListItem>
    <ListItem button>
      <ListItemIcon>
        <BluetoothSearchingIcon />
      </ListItemIcon>
      <ListItemText primary="Devices" />
    </ListItem> */}
  </div>
);

export const secondaryListItems = (
  <div>
    <ListSubheader inset>Recent debug logs</ListSubheader>
    <ListItem button>
      <ListItemIcon>
        <AssignmentIcon />
      </ListItemIcon>
      <ListItemText primary="11:30 AM" />
    </ListItem>
    <ListItem button>
      <ListItemIcon>
        <AssignmentIcon />
      </ListItemIcon>
      <ListItemText primary="11:23 AM" />
    </ListItem>
    <ListItem button>
      <ListItemIcon>
        <AssignmentIcon />
      </ListItemIcon>
      <ListItemText primary="11:20 AM" />
    </ListItem>
  </div>
);
