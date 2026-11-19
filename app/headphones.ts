export type RoutedAudioContext = AudioContext & {sinkId?:string|{type:string};setSinkId?:(id:string)=>Promise<void>};
type OutputDevices = MediaDevices & {selectAudioOutput?:()=>Promise<MediaDeviceInfo>};

const headsetLabel = /headphones?|headsets?|earphones?|earbuds?|airpods?|earpods?|pixel buds|galaxy buds|casque|auriculares|kopfhörer/i;

export async function verifyHeadphones(context:RoutedAudioContext, pick=false) {
  const devices=navigator.mediaDevices as OutputDevices|undefined;
  if(!devices)throw new Error('This browser cannot verify your audio output.');
  if(pick){
    if(!devices.selectAudioOutput||!context.setSinkId)throw new Error('This browser has no output picker. Set your headphones as the system output, then verify it.');
    const selected=await devices.selectAudioOutput();
    if(!headsetLabel.test(selected.label))throw new Error('Choose an output that your device identifies as headphones or a headset.');
    await context.setSinkId(selected.deviceId);
    return selected.deviceId;
  }
  const outputs=(await devices.enumerateDevices()).filter(device=>device.kind==='audiooutput');
  const id=typeof context.sinkId==='string'&&context.sinkId?context.sinkId:'default';
  const current=outputs.find(device=>device.deviceId===id);
  if(!current||!headsetLabel.test(current.label))throw new Error('Headphones could not be verified. Connect them, set them as your system output, then retry or choose them in the browser picker.');
  return id;
}
