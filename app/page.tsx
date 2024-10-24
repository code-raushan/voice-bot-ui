"use client";

import { AudioVisualizer } from "@/components/AudioVisualizer";
import { Card } from "@/components/ui/card";
import { VoiceControls } from "@/components/VoiceControls";
import { cn } from "@/lib/utils";
import { Radio } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [transcription, setTranscription] = useState<string>("");
  const [visualizerData, setVisualizerData] = useState<number[]>(
    new Array(50).fill(0)
  );

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      cleanupAudio();
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const cleanupAudio = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
      mediaRecorderRef.current = null;
    }
    audioChunksRef.current = [];
  };

  const connectWebSocket = () => {
    const ws = new WebSocket("ws://localhost:8888/ws");
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log("WebSocket Connected");
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log("WebSocket Disconnected");
      setTimeout(() => {
        if (!isConnected) {
          connectWebSocket();
        }
      }, 3000);
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "transcription") {
          setTranscription(data.text);
          setIsSending(false);
        } else if (data.type === "error") {
          console.error("Server error:", data.message);
          setIsSending(false);
        }
      } catch (error) {
        console.error("Error processing server message:", error);
        setIsSending(false);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
      setIsSending(false);
    };
  };

  const sendAudioChunks = async (audioBlob: Blob) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not connected");
      return;
    }

    setIsSending(true);

    try {
      // Convert blob to array buffer for processing
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Create audio context for resampling
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Get audio data
      const audioData = audioBuffer.getChannelData(0);

      // Convert to 16-bit PCM
      const pcmData = new Int16Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        pcmData[i] = Math.max(-1, Math.min(1, audioData[i])) * 0x7fff;
      }

      // Send the audio data in chunks
      const CHUNK_SIZE = 16000; // 1 second of audio at 16kHz
      for (let i = 0; i < pcmData.length; i += CHUNK_SIZE) {
        const chunk = pcmData.slice(i, i + CHUNK_SIZE);
        wsRef.current.send(chunk.buffer);

        // Small delay between chunks to prevent overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Send end_stream signal
      wsRef.current.send(JSON.stringify({ type: "end_stream" }));
    } catch (error) {
      console.error("Error sending audio:", error);
      setIsSending(false);
    }
  };

  const startRecording = async () => {
    try {
      cleanupAudio();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 44100,
          sampleSize: 16,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Set up audio context and analyzer for visualization
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;

      const updateVisualizer = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);
        setVisualizerData(Array.from(dataArray).map((val) => val / 255));
        animationFrameRef.current = requestAnimationFrame(updateVisualizer);
      };
      updateVisualizer();

      // Initialize MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm;codecs=opus",
        });
        await sendAudioChunks(audioBlob);
      };

      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      setTranscription("");
    } catch (error) {
      console.error("Error starting recording:", error);
      cleanupAudio();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setVisualizerData(new Array(50).fill(0));
    }
  };

  const handleRecordToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="p-8 backdrop-blur-sm bg-background/80">
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">
                Voice Transcription
              </h1>
              <p className="text-muted-foreground">
                Record your message and get instant transcription
              </p>
            </div>

            <div className="relative h-40">
              <AudioVisualizer data={visualizerData} />
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center transition-opacity",
                  isRecording ? "opacity-0" : "opacity-100"
                )}
              >
                <Radio className="w-16 h-16 text-muted-foreground/20" />
              </div>
            </div>

            <VoiceControls
              isRecording={isRecording}
              isPlaying={false}
              onRecordToggle={handleRecordToggle}
            />

            {isSending && (
              <div className="text-center text-sm text-muted-foreground">
                Processing audio...
              </div>
            )}

            {transcription && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{transcription}</p>
              </div>
            )}

            <div className="text-center">
              <p
                className={cn(
                  "text-sm",
                  isConnected ? "text-green-500" : "text-destructive"
                )}
              >
                {isConnected ? "Connected to server" : "Disconnected"}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
