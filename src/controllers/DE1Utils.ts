import struct from "@aksel/structjs";
import { BLE, I_BLEUpdateCallback, T_FullResponseOption } from "./BLE";
import { T_ErrorDesc, T_Update, T_UpdateGATTNotify, T_Base64String } from "./MessageMaker";
import { SimpleOption, SuccessOption } from "../Option";
import { decode } from "base64-arraybuffer";

export enum CharAddr {
  Versions        = "0000a001-0000-1000-8000-00805f9b34fb", // A R    Versions See T_Versions
  RequestedState  = "0000a002-0000-1000-8000-00805f9b34fb", // B RW   RequestedState See T_RequestedState
  SetTime         = "0000a003-0000-1000-8000-00805f9b34fb", // C RW   SetTime Set current time
  ShotDirectory   = "0000a004-0000-1000-8000-00805f9b34fb", // D R    ShotDirectory View shot directory
  ReadFromMMR     = "0000a005-0000-1000-8000-00805f9b34fb", // E RW   ReadFromMMR Read bytes from data mapped into the memory mapped region.
  WriteToMMR      = "0000a006-0000-1000-8000-00805f9b34fb", // F W    WriteToMMR Write bytes to memory mapped region
  ShotMapRequest  = "0000a007-0000-1000-8000-00805f9b34fb", // G W    ShotMapRequest Map a shot so that it may be read/written
  DeleteShotRange = "0000a008-0000-1000-8000-00805f9b34fb", // H W    DeleteShotRange Delete l shots in the range given
  FWMapRequest    = "0000a009-0000-1000-8000-00805f9b34fb", // I W    FWMapRequest Map a firmware image into MMR. Cannot be done with the boot image
  Temperatures    = "0000a00a-0000-1000-8000-00805f9b34fb", // J R    Temperatures See T_Temperatures
  ShotSettings    = "0000a00b-0000-1000-8000-00805f9b34fb", // K RW   ShotSettings See T_ShotSettings
  Deprecated      = "0000a00c-0000-1000-8000-00805f9b34fb", // L RW   Deprecated Was T_ShotDesc. Now deprecated.
  ShotSample      = "0000a00d-0000-1000-8000-00805f9b34fb", // M R    ShotSample Use to monitor a running shot. See T_ShotSample
  StateInfo       = "0000a00e-0000-1000-8000-00805f9b34fb", // N R    StateInfo The current state of the DE1
  HeaderWrite     = "0000a00f-0000-1000-8000-00805f9b34fb", // O RW   HeaderWrite Use this to change a header in the current shot description
  FrameWrite      = "0000a010-0000-1000-8000-00805f9b34fb", // P RW   FrameWrite Use this to change a single frame in the current shot description
  WaterLevels     = "0000a011-0000-1000-8000-00805f9b34fb", // Q RW   WaterLevels Use this to adjust and read water level settings
  Calibration     = "0000a012-0000-1000-8000-00805f9b34fb", // R RW   Calibration Use this to adjust and read calibration  
}

export enum CharLen {
  Versions = 12,
  FWMapRequest = 7
}

// Look up "structjs" to see how these struct format strings work.
// See: https://github.com/lyngklip/structjs
// Basically, it's an implementation of python struct for JS and TS
const Struct_U24P0 = struct('>BBB')
export function toU24P0( v : number) : Buffer {
  const hi  = (v >> 16) & 0xFF
  const mid = (v >> 8 ) & 0xFF
  const lo  = (v      ) & 0xFF
  return Struct_U24P0.pack(hi, mid, lo)
}

const Struct_datatostr = struct('>16s')
const Struct_MMRWrite = struct('>B3B16s')
export function make_MMRWrite(data: ArrayBufferLike, address : number) {
  const hi  = (address >> 16) & 0xFF
  const mid = (address >> 8 ) & 0xFF
  const lo  = (address      ) & 0xFF  
  var dstr = Struct_datatostr.unpack(data)[0]
  return Struct_MMRWrite.pack(data.byteLength, hi, mid, lo, dstr)
}

const Struct_FWMapRequest = struct('>HBB3B')
export function make_FWMapRequest( WindowInc : number = 0, FWToErase : number = 0, FWToMap : number = 0, FirstError : number = 0) : Buffer {
  const hi  = (FirstError >> 16) & 0xFF
  const mid = (FirstError >> 8 ) & 0xFF
  const lo  = (FirstError      ) & 0xFF  
  return Struct_FWMapRequest.pack(WindowInc, FWToErase, FWToMap, hi, mid, lo)
}

export type T_FWMapRequest_Fields = {
  WindowIncrement : number,
  FWToErase : number,
  FWToMap   : number,
  FirstError: number
}

export function parse_FWMapRequest( data : T_Base64String ) : T_FWMapRequest_Fields {
  const bindata = decode(data)
  const [WindowIncrement, FWToErase, FWToMap, FirstError] = Struct_FWMapRequest.unpack(bindata)
  return { WindowIncrement, FWToErase, FWToMap, FirstError }
}

var LastFWMRUpdate : T_Update|null = null;

const FWMRCallback : I_BLEUpdateCallback = (update : T_Update) : boolean => {
  console.log("FWMRCallback: ", update);
  LastFWMRUpdate = update;
  return true;
}

export async function check_FWMapRequest( ble: BLE, mac : string ) : Promise<SimpleOption<T_FWMapRequest_Fields>> {
  var resp = LastFWMRUpdate
  if (resp) {
    if (resp.update == "GATTNotify") {
      var notify = resp as T_UpdateGATTNotify;
      return { success : true, result: parse_FWMapRequest(notify.results.Data) };
    }
  }

  return { success : false }
}

export async function write_FWMapRequest( ble : BLE, 
                                          mac : string, 
                                          WindowInc : number = 0, 
                                          FWToErase : number = 0, 
                                          FWToMap : number = 0, 
                                          FirstError : number = 0
                                        ) : Promise<T_FullResponseOption> {
  return await ble.requestAsyncGATTWrite(mac, CharAddr.FWMapRequest, make_FWMapRequest(WindowInc, FWToErase, FWToMap, FirstError), true)
}

export async function write_MMR(ble: BLE, mac: string, data: ArrayBufferLike, address : number): Promise<T_FullResponseOption> {
  return await ble.requestAsyncGATTWrite(mac, CharAddr.WriteToMMR, make_MMRWrite(data, address), true)
}

function sleep(ms : number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


export async function pushImage( ble: BLE, mac: string, data : ArrayBuffer ) : Promise<SuccessOption<T_ErrorDesc>> {
  var so_mrf : SimpleOption<T_FWMapRequest_Fields>
  var fro : T_FullResponseOption;

  LastFWMRUpdate = null;

  fro =  await ble.requestAsyncGATTSetNotify(mac, CharAddr.FWMapRequest, true, FWMRCallback)
  if (!fro.success) return fro;
  
  var response = await write_FWMapRequest(ble, mac, 0, 1, 1, 0)
  if (!response.success) return response;

  // fro = await ble.requestAsyncGATTRead(mac, CharAddr.Versions, CharLen.Versions)
  // if (!fro.success) return fro;

  var cnt = 0;
  so_mrf = await check_FWMapRequest(ble, mac)
  
  while ((cnt<10) && (!so_mrf.success)) {
    await sleep(1000)
    cnt += 1
    so_mrf = await check_FWMapRequest(ble, mac)
  }

  console.log("Erased")
  
  cnt = 0
  var chunk = data.slice(cnt, cnt+16)  // Apparently slice returns an empty array for out of bounds indexes
  while (chunk.byteLength > 0) {
    var writeresp = await write_MMR(ble, mac, chunk, cnt)
    if (!writeresp.success) {
      console.log("Something went wrong during firmware upload. GATT MMR write reported: "+writeresp.error)
      return writeresp
    }

    console.log('Wrote %d bytes to %08x', chunk.byteLength, cnt)
    cnt += chunk.byteLength
    var chunk = data.slice(cnt, cnt+16)  // Apparently slice returns an empty array for out of bounds indexes    
  }

  return { success: true }
}

export async function pollForError(ble: BLE, mac: string, nexterror = false): Promise<SimpleOption<number>> {
  var eaddr;
  if (nexterror) {
    eaddr = 0xFFFFFE
  } else {
    eaddr = 0xFFFFFF
  }

  LastFWMRUpdate = null;

  var wresp = await write_FWMapRequest(ble, mac, 0, 0, 1, eaddr)
  if (!wresp.success) return wresp

  var resp = await check_FWMapRequest(ble, mac)

  var cnt = 0
  while ((cnt<10) && (!resp.success)) {
    console.log("%4d Waiting for check error response...", cnt)
    await sleep(1000)

    resp = await check_FWMapRequest(ble, mac)
    cnt += 1
  }

  if (resp.success) {
    return { success : true, result: resp.result.FirstError }
  }

  return { success : false }
}

export async function upload_Firmware(ble: BLE, mac: string, data: ArrayBuffer): Promise<SuccessOption<T_ErrorDesc>> {
  var resp = await pushImage(ble, mac, data)
  if (!resp) return resp;

  var ferr = await pollForError(ble, mac, false)
  if (!ferr.success) return { success: false, error: { eid: 1, errmsg: "Timed out during FWMapRequest polling"} }

  if (ferr.result != 0xFFFFFD) {
      // Image needs fixing
      console.log("Error reported at offset: %08X", ferr.result)
      ferr = await pollForError(ble, mac, true)
      if (!ferr.success) return { success: false, error: { eid: 1, errmsg: "Timed out during FWMapRequest polling"} }


      console.log("Next error at: %08X", ferr.result)
      ferr = await pollForError(ble, mac, true)
      if (!ferr.success) return { success: false, error: { eid: 1, errmsg: "Timed out during FWMapRequest polling"} }


      console.log("Next error at: %08X", ferr.result)
      ferr = await pollForError(ble, mac, true)
      if (!ferr.success) return { success: false, error: { eid: 1, errmsg: "Timed out during FWMapRequest polling"} }

      console.log("Next error at: %08X", ferr.result)

  }

  return { success: true }
}
/*
  if (ferr != 0xFFFFFD):
      # Image needs fixing
      print("Error reported at offset: %08X" % ferr)
      ferr = self.pollForError(nexterror=True)
      print("Next error at: %08X" % ferr)
      ferr = self.pollForError(nexterror=True)
      print("Next error at: %08X" % ferr)
      ferr = self.pollForError(nexterror=True)
      print("Next error at: %08X" % ferr)
      # self.pushImage(fname)
    else:
      print("Image is good")
      # self.pushImage(fname)

*/

/*
 def pollForError(self, nexterror=False):
    if nexterror:
      eaddr = 0xFFFFFE
    else:
      eaddr = 0xFFFFFF

    write_FWMapRequest(self.FWMapRequest, 0, 0, 1, eaddr, True)

    resp = read_FWMapRequest(self.FWMapRequest)
    cnt = 0
    while resp.FirstError == eaddr:
      #print( "%4s Waiting for checkerror response..." % cnt, end="\r" )
      time.sleep(1)
      resp = read_FWMapRequest(self.FWMapRequest)
    print()
    return resp.FirstError
*/

/*
def pushImage(self, fname):  
    #sys.exit(0)
    write_FWMapRequest(self.FWMapRequest, FWToErase=1, FWToMap=1, withResponse=True)
    
    cnt = 0
    while read_FWMapRequest(self.FWMapRequest).FWToErase:
      print( "%4s Waiting for flash to erase..." % cnt, end="\r" )
      time.sleep(1)
      cnt += 1
      
    print( "\nErased")
    #sys.exit(0)
    fwfile = open(fname, 'rb')
    data = fwfile.read(16)
    cnt = 0
    while (len(data) > 0):
      try:
        write_FWWriteToMMR(self.FWWriteToMMR, data, cnt, withResponse=((cnt % 1024) == 0))
      except BTLEException as err:
        print()
        print('BLE error: ', err)
        traceback.print_exc()
        break
        
      cnt += len(data)
      print("Wrote {} bytes".format(cnt), end='\r')
      data = fwfile.read(16)
    
    # Do a read of something so that we'll sleep until the BLE queue is flushed
    read_FWMapRequest(self.FWMapRequest).FWToErase

    print("\nAll done!");    
    print("Wrote {} bytes".format(cnt))

*/