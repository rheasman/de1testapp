import React, { Component } from 'react';
import Title from './Title';
import KeyStore, { NotifyCallbackType } from '../models/KeyStore';

type WSProps = {
  name : string
}

type WSState = {
  url : string,
  readyState : number
}

class WSClient extends Component<WSProps, WSState> {
  constructor(props : WSProps) {
    super(props);
    console.log("Props:", props);
    this.state = {
      url : "Unset",
      readyState : 3
    }  
  }

  componentDidMount() {
    KeyStore.getInstance().requestNotifyOnChanged(this.props.name, "url", this.onControllerChange)
    KeyStore.getInstance().requestNotifyOnChanged(this.props.name, "readyState", this.onControllerChange)
    this.updateStateFromStore();
  }

  componentWillUnmount() {
    console.log("WSClient.componentWillUnmount");
    KeyStore.getInstance().cancelNotify(this.props.name, "url", this.onControllerChange);
    KeyStore.getInstance().cancelNotify(this.props.name, "readyState", this.onControllerChange);
  }

  onControllerChange : NotifyCallbackType = (owner, key, status, before, after) => {
    console.log("onControllerChange:", owner, key, status, before, after)
    this.updateStateFromStore();
  }

  updateStateFromStore() {
    this.setState({ 
      url : KeyStore.getInstance().readKey(this.props.name, "url"),
      readyState : KeyStore.getInstance().readKey(this.props.name, "readyState")
    });
  }
  render() {
    return <React.Fragment>
      <Title>WebSocket Connection</Title>
      <ul>
        <li> URL: {this.state.url} </li>
        <li> Status: {this.state.readyState === 1 ? "Connected" : "Disconnected"}</li>
      </ul>
    </React.Fragment>
  }
}

export default WSClient;
