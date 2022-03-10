type MMRInfoEntry = [number, string, number, string];

export type ValidMMRName = 
  "ExternalFlash" |
  "HWConfig" |
  "Model" |
  "CPUBoardModel" |
  "v13Model" |
  "CPUFirmwareBuild" |
  "DebugLen" |
  "DebugBuffer" |
  "DebugConfig" |
  "FanThreshold" |
  "TankTemp" |
  "HeaterUp1Flow" |
  "HeaterUp2Flow" |
  "WaterHeaterIdleTemp" |
  "GHCInfo" |
  "PrefGHCMCI" |
  "MaxShotPres" |
  "TargetSteamFlow" |
  "SteamStartSecs" |
  "SerialN" |
  "HeaterV" |
  "HeaterUp2Timeout" |
  "CalFlowEst" |
  "FlushFlowRate" |
  "FlushTemp" |
  "FlushTimeout" |
  "HotWaterFlowRate" |
  "SteamPurgeMode" |
  "AllowUSBCharging" |
  "AppFeatureFlags" |
  "RefillKitPresent";

  export interface MMRInfo {
    readonly Address : number,
    readonly Name    : ValidMMRName,
    readonly Length  : number,
    readonly Info    : string
  }
  

const MMRList = [
    [0x00000000,  "ExternalFlash"       , 0xFFFFF, "Flash RW"],
    [0x00800000,  "HWConfig"            ,       4, "HWConfig"],
    [0x00800004,  "Model"               ,       4, "Model"],
    [0x00800008,  "CPUBoardModel"       ,       4, "CPU Board Model * 1000. eg: 1100 = 1.1"],
    [0x0080000C,  "v13Model"            ,       4, "v1.3+ Firmware Model (Unset = 0, DE1 = 1, DE1Plus = 2, DE1Pro = 3, DE1XL = 4, DE1Cafe = 5)"],
    [0x00800010,  "CPUFirmwareBuild"    ,       4, "CPU Board Firmware build number. (Starts at 1000 for 1.3, increments by 1 for every build)"],
    [0x00802800,  "DebugLen"            ,       4, "How many characters in debug buffer are valid. Accessing this pauses BLE debug logging."],
    [0x00802804,  "DebugBuffer"         ,  0x1000, "Last 4K of output. Zero terminated if buffer not full yet. Pauses BLE debug logging."],
    [0x00803804,  "DebugConfig"         ,       4, "BLEDebugConfig. (Reading restarts logging into the BLE log)"],
    [0x00803808,  "FanThreshold"        ,       4, "Fan threshold temp"],
    [0x0080380C,  "TankTemp"            ,       4, "Tank water temp threshold."],
    [0x00803810,  "HeaterUp1Flow"       ,       4, "HeaterUp Phase 1 Flow Rate"],
    [0x00803814,  "HeaterUp2Flow"       ,       4, "HeaterUp Phase 2 Flow Rate"],
    [0x00803818,  "WaterHeaterIdleTemp" ,       4, "Water Heater Idle Temperature"],
    [0x0080381C,  "GHCInfo"             ,       4, "GHC Info Bitmask, 0x1 = GHC LED Controller Present, 0x2 = GHC Touch Controller_Present, 0x4 GHC Active, 0x80000000 = Factory Mode"],
    [0x00803820,  "PrefGHCMCI"          ,       4, "TODO"],
    [0x00803824,  "MaxShotPres"         ,       4, "TODO"],
    [0x00803828,  "TargetSteamFlow"     ,       4, "Target steam flow rate"],
    [0x0080382C,  "SteamStartSecs"      ,       4, "Seconds of high steam flow * 100. Valid range 0.0 - 4.0. 0 may result in an overheated heater. Be careful."],
    [0x00803830,  "SerialN"             ,       4, "Current serial number"],
    [0x00803834,  "HeaterV"             ,       4, "Nominal Heater Voltage (0, 120V or 230V). +1000 if it's a set value."],
    [0x00803838,  "HeaterUp2Timeout"    ,       4, "HeaterUp Phase 2 Timeout"],
    [0x0080383C,  "CalFlowEst"          ,       4, "Flow Estimation Calibration"],
    [0x00803840,  "FlushFlowRate"       ,       4, "Flush Flow Rate"],
    [0x00803844,  "FlushTemp"           ,       4, "Flush Temp"],
    [0x00803848,  "FlushTimeout"        ,       4, "Flush Timeout"],
    [0x0080384C,  "HotWaterFlowRate"    ,       4, "Hot Water Flow Rate"],
    [0x00803850,  "SteamPurgeMode"      ,       4, "Steam Purge Mode"],
    [0x00803854,  "AllowUSBCharging"    ,       4, "Allow USB charging"],
    [0x00803858,  "AppFeatureFlags"     ,       4, "App Feature Flags"],
    [0x0080385C,  "RefillKitPresent"    ,       4, "Refill Kit Present"],
] as const;

type NameAddr = [ValidMMRName, number];

const NameAddrList = MMRList.map( (val, ind, arr) : Readonly<NameAddr> => {
  return [val[1], val[0]] as Readonly<NameAddr>;
})

export enum MMRAddr {
  ExternalFlash       = 0x00000000,
  HWConfig            = 0x00800000,
  Model               = 0x00800004,
  CPUBoardModel       = 0x00800008,
  v13Model            = 0x0080000C,
  CPUFirmwareBuild    = 0x00800010,
  DebugLen            = 0x00802800,
  DebugBuffer         = 0x00802804,
  DebugConfig         = 0x00803804,
  FanThreshold        = 0x00803808,
  TankTemp            = 0x0080380C,
  HeaterUp1Flow       = 0x00803810,
  HeaterUp2Flow       = 0x00803814,
  WaterHeaterIdleTemp = 0x00803818,
  GHCInfo             = 0x0080381C,
  PrefGHCMCI          = 0x00803820,
  MaxShotPres         = 0x00803824,
  TargetSteamFlow     = 0x00803828,
  SteamStartSecs      = 0x0080382C,
  SerialN             = 0x00803830,
  HeaterV             = 0x00803834,
  HeaterUp2Timeout    = 0x00803838,
  CalFlowEst          = 0x0080383C,
  FlushFlowRate       = 0x00803840,
  FlushTemp           = 0x00803844,
  FlushTimeout        = 0x00803848,
  HotWaterFlowRate    = 0x0080384C,
  SteamPurgeMode      = 0x00803850,
  AllowUSBCharging    = 0x00803854,
  AppFeatureFlags     = 0x00803858,
  RefillKitPresent    = 0x0080385C,
}
