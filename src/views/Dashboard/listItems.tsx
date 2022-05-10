import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import AssignmentIcon from '@mui/icons-material/Assignment';
import React, { Component, ReactNode } from 'react';
import KeyStore, { E_Status } from '../../models/KeyStore';
import { DownloadForOfflineSharp } from '@mui/icons-material';
import { ListItemButton } from '@mui/material';

export type DebugLogListItem = {
  name : string,
  log  : string
}

type DebugLogListItemState = {
  header : string,
  items : DebugLogListItem[]
}

type DebugLogListItemProps = {
  header : string
}


function download(filename : string, text : string) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

// Start file download.
// download("hello.txt","This is the content of my file :)");


function makeDebugLogListItem(text : DebugLogListItem) : JSX.Element {
  return (
      <ListItemButton onClick={() => {download(text.name+".txt", text.log)}}>
      <ListItemIcon>
      <DownloadForOfflineSharp />
      </ListItemIcon>
      <ListItemText primaryTypographyProps={{fontSize: 'x-small'}} primary={text.name} />
      </ListItemButton>
  )
}

export class DebugLogList extends React.Component<DebugLogListItemProps, DebugLogListItemState> {
  state : DebugLogListItemState;
  constructor(props : DebugLogListItemProps) {
    super(props);
    this.state = {
      header : props.header,
      items  : []
    }
  }

  componentDidMount = () => {
    KeyStore.getInstance().requestNotifyOnChanged("AppController", "debugloglist", this._logsupdated)
  }

  componentWillUnmount = () => {
    KeyStore.getInstance().cancelNotify("AppController", "debugloglist", this._logsupdated)
  }

  _logsupdated = (owner: string, key: string, status: E_Status, before: any, after: any) => {
    this.setState({items : after})
  }

  render = () : ReactNode => {
    return (
      <div>
          { (this.state.items.length > 0) && <ListSubheader inset>{this.state.header}</ListSubheader> }
          { this.state.items.map( makeDebugLogListItem ) }
      </div>
    )
  }
}
