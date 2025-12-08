import lamejs from 'lamejs';

export const convertToMp3 = async (audioBlob: Blob): Promise<Blob> => {
  console.log('🔄 Iniciando conversão para MP3...');
  
  // Decodificar o áudio original
  const audioContext = new AudioContext();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Configurar encoder MP3
  const channels = 1; // Mono para áudio de voz
  const sampleRate = audioBuffer.sampleRate;
  const kbps = 128;
  
  const mp3Encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
  
  // Converter samples para Int16
  const samples = audioBuffer.getChannelData(0);
  const sampleBlockSize = 1152;
  const mp3Data: Uint8Array[] = [];
  
  // Processar em blocos
  for (let i = 0; i < samples.length; i += sampleBlockSize) {
    const sampleChunk = samples.subarray(i, i + sampleBlockSize);
    const int16Samples = new Int16Array(sampleChunk.length);
    
    for (let j = 0; j < sampleChunk.length; j++) {
      int16Samples[j] = Math.max(-32768, Math.min(32767, sampleChunk[j] * 32768));
    }
    
    const mp3buf = mp3Encoder.encodeBuffer(int16Samples);
    if (mp3buf.length > 0) {
      // Copy to new Uint8Array to avoid SharedArrayBuffer issues
      const copy = new Uint8Array(mp3buf.length);
      copy.set(mp3buf);
      mp3Data.push(copy);
    }
  }
  
  // Finalizar
  const mp3End = mp3Encoder.flush();
  if (mp3End.length > 0) {
    const copy = new Uint8Array(mp3End.length);
    copy.set(mp3End);
    mp3Data.push(copy);
  }
  
  await audioContext.close();
  
  // Concatenar todos os chunks em um único Uint8Array
  const totalLength = mp3Data.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of mp3Data) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  console.log('✅ Conversão para MP3 concluída');
  return new Blob([result], { type: 'audio/mpeg' });
};
