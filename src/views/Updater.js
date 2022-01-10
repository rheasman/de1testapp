import React from 'react';
import ReactDOM from 'react-dom';
import Title from './Title';
import LinearProgressWithLabel from './LinearProgressWithLabel.js'

export default class Updater extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isActive: true,
      step: 'Updating',
      addr: props.addr,
      progress: 0
    };
  }

  // We want to show the current status: Connecting, uploading, disconnecting, done.
  // Also want a progress bar.
  render() {
    if (this.state.isActive) {
      return (
        <React.Fragment>
          <Title>{this.state.step}</Title>
          <LinearProgressWithLabel value={30} />
        </React.Fragment>
      )
    } else {
      return null;
    }
  }
}