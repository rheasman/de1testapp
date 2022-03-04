import KeyStore from '../models/KeyStore';

export type WSClientNotifyFn = () => void;

interface I_WSMessageCallback {
  (ev: MessageEvent<any>) : any
}

export type WSState = WebSocket["CLOSED"] | WebSocket["CLOSING"] | WebSocket["CONNECTING"] | WebSocket["OPEN"];

export class WSClientController {

  Name : string;  // Name this controller will use. Used as ownername in KeyStore keys.
  URL  : string;  // Target address
  ReconnectHandle : any;
  RetryInterval   : number;
  MaxRetry : number;
  Notifies : Set<any>;
  Model    : KeyStore;
  OnMessageCallback : I_WSMessageCallback | null;

  // I don't want to initialise ws until connect is called, and there's no way to stop
  // TS from complaining that I've been able to find.
  WS       : WebSocket | null;

  constructor(name: string, url: string) {
    if (!name) throw Error("Please specify a name for this controller");
    if (!url)  throw Error("Please specify a url for this controller");

    console.log("Creating new WSClientController:", name, "for", url);
    this.Name = name;
    this.URL = url // "ws://localhost:8765"
    this.ReconnectHandle = null;
    this.RetryInterval = 250; // Current ms between retries. Increments by 250ms after each failed retry.
    this.MaxRetry = 10000;    // Maximum delay between retries, in milliseconds
    this.Notifies = new Set([])
    this.Model = KeyStore.getInstance();
    this.Model.updateKey(name, "url", this.URL);
    this.Model.updateKey(name, "readyState", WebSocket.CLOSED as WSState);
    this.OnMessageCallback = null
    this.WS = null
  }

  _clearReconnectTimeout() {
    if (this.ReconnectHandle) {
      window.clearTimeout(this.ReconnectHandle); // We are connected, so get rid of our reconnect Timer
      this.ReconnectHandle = null;
    }
    this.RetryInterval = 250; // Reset interval to 250ms
  }

  // Called by websocket when connected
  _on_open = () => {
    console.log("WebSocket connected");

    this._clearReconnectTimeout();
    this.notifyStateListeners();
    this.Model.updateKey(this.Name, "readyState", this.getReadyState(), true)
  }


    // Called by WebSocket when closed
  _on_close = (e: CloseEvent) => {
    console.log(
      `Socket is closed. Reconnect will be attempted in ${this.RetryInterval} milliseconds.`,
      e.reason
    );

    const interval = Math.min(this.MaxRetry, this.RetryInterval + 250)
    this.ReconnectHandle = setTimeout(this.checkConnection, interval); // Call check function after timeout
    this.RetryInterval = interval;
    this.notifyStateListeners();
    this.Model.updateKey(this.Name, "readyState", this.getReadyState())
  };

  // Called by ws when something goes wrong
  _on_error = (errorevent : Event) => {
    console.error(
      "Socket encountered error: ",
      errorevent,
      "Closing socket"
    );

    this.WS?.close();
    this.notifyStateListeners();

    this.Model.updateKey(this.Name, "readyState", this.getReadyState(), true)
  }

  _on_message = (event: MessageEvent<any>) => {
    if (this.OnMessageCallback) {
      return this.OnMessageCallback(event)
    }
  }

  getReadyState() : WSState {
    return this.WS?.readyState || WebSocket.CLOSED
  }

  connect() {
    this._clearReconnectTimeout();

    if (this.WS == null) {
      this.WS = new WebSocket(this.URL);
    }

    if ( (this.WS.readyState === WebSocket.CLOSED) || (this.WS.readyState === WebSocket.CLOSING) ) {
      this.WS = new WebSocket(this.URL);
    }
    this.WS.onopen = this._on_open
    this.WS.onclose = this._on_close
    this.WS.onerror = this._on_error
    this.WS.onmessage = this._on_message
    this.notifyStateListeners();
  };

  setMessageEventHandler(callback : (ev: MessageEvent<any>) => any) {
    console.log("setMessageEventHandler: ", callback)
    this.OnMessageCallback = callback;
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    this.WS?.send(data)
  }

  /**
   * Get state in a way that can be easily rendered by React
   */
  getState() {
    return {
      url: this.URL,
      readyState: this.getReadyState()
    }
  }

  addStateNotify(notifyfn: WSClientNotifyFn) {
    this.Notifies.add(notifyfn)
  }

  removeNotify(notifyfn: WSClientNotifyFn) {
    this.Notifies.delete(notifyfn)
  }


  /**
   * checkConnection: Called when retry timer triggers
   */
  checkConnection = () => {
    if (!this.WS || this.WS.readyState === WebSocket.CLOSED) this.connect(); // Reconnect if necessary
  };

  notifyStateListeners() {
    this.Notifies.forEach(element => {
      element();
    });
  }
}

// End of WSClientController
