import { encode, decode } from "base64-arraybuffer";

export type T_MsgType_REQ = "REQ";
export type T_MsgType_RESP = "RESP";
export type T_MsgType_UPDATE = "REQ";
export type T_MsgType = T_MsgType_REQ | T_MsgType_RESP | T_MsgType_UPDATE;
export type T_ConnectionState = "INIT" | "DISCONNECTED" | "CONNECTED" | "CANCELLED";
export type T_ReqCommandStr = "Scan" | "GATTConnect" | "GATTDisconnect" | "GATTRead" | "GATTSetNotify" | "GATTWrite";
export type T_Base64String = string;
export type T_Request = {
  type: T_MsgType_REQ;
  command: T_ReqCommandStr;
  params: any;
  id: number;
};

export type T_Params_Scan = {
  Timeout: number;
}

export type T_Params_GATTConnect = {
  'MAC': string
}

export type T_Params_GATTDisconnect = {
  'MAC': string
}

export type T_Params_GATTRead = {
  
}

export type T_Request_Scan = {
  type: T_MsgType_REQ;
  command: "Scan";
  params: T_Params_Scan;
  id: number;
}

export type T_ErrorDesc = {
  eid: number;
  errmsg: string;
};

export type T_RespNoError = {
  eid : 0;
  errmsg: "";
}

export type T_Response = {
  type: "RESP"; // T_MsgType
  id: number;
  error: T_ErrorDesc;
  results: any;
};

export type T_Results_GATTRead = {
  Data : T_Base64String;
}

export type T_Response_GATTRead = {
  type: "RESP"; // T_MsgType
  id: number;
  error: T_ErrorDesc;
  results: T_Results_GATTRead;
};

// A result from an ongoing BLE scan

export type T_ScanResult = {
  MAC: string;
  Name: string;
  UUIDs: [string];
};
// A notify that we subscribed to has delivered some data

export type T_Results_GATTNotify = {
  MAC: string;
  Char: string;
  Data: T_Base64String;
};
// Notification of a connection or disconnection. If id != 0, then this connection
// state is the direct result of a connect or disconnect request.

export type T_ConnectionStateNotify = {
  MAC: string;
  CState: T_ConnectionState;
  UUIDs: [string];
};
// Used to report any runtime errors that occurred in the server

export type T_UpdateType = "ScanResult" | "GATTNotify" | "ConnectionState" | "ExecutionError";
export type T_UpdateResult = T_ScanResult | T_Results_GATTNotify | T_ConnectionStateNotify | T_ErrorDesc;
export type T_Update = {
  type: "UPDATE"; // T_MsgType
  id: number;
  update: T_UpdateType;
  results: T_UpdateResult;
};

export type T_UpdateGATTNotify = {
  type: "UPDATE"; // T_MsgType
  id: number;
  update: "GATTNotify";
  results: T_Results_GATTNotify;
};

export type T_IncomingMsg = T_Response | T_Update;
// Info we store in a devicemap

export type T_DeviceState = {
  MAC: string;
  Name: string;
  UUIDs: [string];
  State: T_ConnectionState;
};
/**
 * Class to make the various message types we'll need
 *
 * Doesn't really need to be a class, but thought it would be nice
 * to keep it all together, and I might add methods later to turn
 * on various debugging functions.
 */

export class MessageMaker {
  makeReq(command: T_ReqCommandStr, rid: number, params: any): T_Request {
    return {
      type: 'REQ',
      command: command,
      params: params,
      id: rid
    };
  }

  makeScan(timeout: number, rid: number): T_Request {
    // Scan(timeout : U32)
    var params = {
      Timeout: timeout
    };
    return this.makeReq("Scan", rid, params);
  }

  makeConnect(mac: string, rid: number) {
    const params = {
      'MAC': mac,
    };
    return this.makeReq("GATTConnect", rid, params);
  }

  makeDisconnect(mac: string, rid: number) {
    const params = {
      'MAC': mac,
    };
    return this.makeReq("GATTDisconnect", rid, params);
  }

  makeGATTRead(mac: string, char: string, rlen: number, rid: number) {
    const params = {
      'MAC': mac,
      'Char': char,
      'Len': rlen
    };
    return this.makeReq("GATTRead", rid, params);
  }

  makeGATTWrite(mac: string, char: string, data: ArrayBufferLike, rid: number, requireresponse : boolean) {
    const params = {
      'MAC': mac,
      'Char': char,
      'Data': encode(data),
      'RR' : requireresponse
    };
    return this.makeReq("GATTWrite", rid, params);
  }
  makeGATTSetNotify(mac: string, char: string, enable: boolean, rid: number) {
    const params = {
      'MAC': mac,
      'Char': char,
      'Enable': enable
    };
    return this.makeReq("GATTSetNotify", rid, params);
  }

  makeIncomingMsgFromJSON(jsondata: string): T_IncomingMsg {
    var msg = JSON.parse(jsondata);
    if (msg.type === "RESP") {
      // Response
      let resp = msg as T_Response;
      return resp;
    }
    if (msg.type === "UPDATE") {
      // Update
      return msg as T_Update;
    }
    throw new Error("Unrecognised Incoming Message");
  }

  updateFromMsg(msg: T_IncomingMsg): T_Update {
    if (msg.type === "UPDATE") {
      return msg as T_Update;
    }
    throw new Error("Not a T_Update");
  }

  connStateFromUpdate(msg: T_Update): T_ConnectionStateNotify {
    if (msg.update === 'ConnectionState') {
      return msg.results as T_ConnectionStateNotify;
    }
    throw new Error("Not a ConnectionState T_Update");
  }

  scanResultFromUpdate(msg: T_Update): T_ScanResult {
    if (msg.update === "ScanResult") {
      return msg.results as T_ScanResult;
    }
    throw new Error("Not a T_ScanResult");
  }
}
