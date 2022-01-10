import KeyStore from '../models/KeyStore';

export type WSClientNotifyFn = () => void;

export class WSClientController {

  name : string;  // Name this controller will use. Used as ownername in KeyStore keys.
  url  : string;  // Target address
  reconnectHandle : any;
  retryInterval   : number;
  maxRetry : number;
  notifies : Set<any>;
  model    : KeyStore;

  // I don't want to initialise ws until connect is called, and there's no way to stop
  // TS from complaining that I've been able to find.
  // @ts-expect-error
  ws       : WebSocket;

  constructor(name: string, url: string) {
    if (!name) throw Error("Please specify a name for this controller");
    if (!url)  throw Error("Please specify a url for this controller");

    console.log("Creating new WSClientController:", name, "for", url);
    this.name = name;
    this.url = url // "ws://localhost:8765"
    this.reconnectHandle = null;
    this.retryInterval = 250; // Current ms between retries. Increments by 250ms after each failed retry.
    this.maxRetry = 10000;    // Maximum delay between retries, in milliseconds
    this.notifies = new Set([])
    this.model = KeyStore.instance;
    this.model.updateKey(name, "url", this.url)
    this.model.updateKey(name, "readyState", 3)
  }

  connect = () => {
    this.ws = new WebSocket(this.url);
    this.notifyStateListeners();

    // Called by websocket when connected
    this.ws.onopen = () => {
      console.log("WebSocket connected");

      if (this.reconnectHandle) {
        window.clearTimeout(this.reconnectHandle); // We are connected, so get rid of our reconnect Timer
        this.reconnectHandle = null;
      }
      this.retryInterval = 250; // Reset interval back to 250ms
      this.notifyStateListeners();
      this.model.updateKey(this.name, "readyState", this.ws.readyState, true)
    };

    // Called by ws when closed
    this.ws.onclose = (e: CloseEvent) => {
      console.log(
        `Socket is closed. Reconnect will be attempted in ${this.retryInterval} milliseconds.`,
        e.reason
      );

      const interval = Math.min(this.maxRetry, this.retryInterval + 250)
      this.reconnectHandle = setTimeout(this.checkConnection, interval); // Call check function after timeout
      this.retryInterval = interval;
      this.notifyStateListeners();
      this.model.updateKey(this.name, "readyState", this.ws.readyState)
    };

    // Called by ws when something goes wrong
    this.ws.onerror = (err) => {
      console.error(
        "Socket encountered error: ",
        err,
        "Closing socket"
      );

      this.ws.close();
      this.notifyStateListeners();
      this.model.updateKey(this.name, "readyState", this.ws.readyState, true)
    };
  };

  setMessageEventHandler(callback : (ev: MessageEvent<any>) => any) {
    console.log("setMessageEventHandler: ", callback)
    this.ws.onmessage = callback;
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    this.ws.send(data)
  }

  /**
   * Get state in a way that can be easily rendered by React
   */
  getState = () => {
    return {
      url: this.ws.url,
      readyState: this.ws.readyState
    }
  }

  addStateNotify(notifyfn: WSClientNotifyFn) {
    this.notifies.add(notifyfn)
  }

  removeNotify(notifyfn: WSClientNotifyFn) {
    this.notifies.delete(notifyfn)
  }


  /**
   * checkConnection: Called when retry timer triggers
   */
  checkConnection = () => {
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) this.connect(); // Reconnect if necessary
  };

  notifyStateListeners() {
    this.notifies.forEach(element => {
      element();
    });
  }
}

// End of WSClientController
