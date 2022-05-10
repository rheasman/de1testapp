import { Typography } from '@mui/material';
import React from 'react';
import { AppController } from '../../controllers/AppController';
import KeyStore from '../../models/KeyStore';
import { FileSelector, SelectionCallback } from '../FileSelector'
import { LinearProgressWithLabel } from '../LinearProgressWithLabel';
import Title from '../Title';
export type T_UpdaterStates = "WaitForFile" | "Uploading" | "Done";

export interface UpdaterProps {  
  mac  : string,
  name : string
}
 
export interface UpdaterState {
  step : T_UpdaterStates,
  mac  : string,
  name : string,
  progress : number
}


export class Updater extends React.Component<UpdaterProps, UpdaterState> {
  constructor(props : UpdaterProps) {
    super(props);
    this.state = {
      step: 'WaitForFile',
      mac: props.mac,
      name: props.name,
      progress: 0
    };
  }

  setFileList: SelectionCallback = (file: FileList|null) => {
    KeyStore.getInstance().updateKey("Updater", "firmwarefile", file)
    AppController.getInstance().sendEventToSM( { type: 'EV_FirmwareSelected' })
  }

  showState() {
    switch (this.state.step) {
      case 'WaitForFile':
        return 'Please select a file to upload.'
      break;

      case 'Uploading':
        return 'Firmware update in progress. Please do not disturb the DE1.'
      break;

      case 'Done':
        return 'Firmware update complete.'
      break;
          
      default:
        break;
    }
  }
  // We want to show the current status: Connecting, uploading, disconnecting, done.
  // Also want a progress bar.
  render() {
    return (
      <React.Fragment>
        <Title>Update Firmware</Title>
        <Typography component="h4" color="primary">
        {this.showState()}
        </Typography>
        <LinearProgressWithLabel value={0} />
        <FileSelector onchange={this.setFileList}></FileSelector>
      </React.Fragment>
    )
  }
}