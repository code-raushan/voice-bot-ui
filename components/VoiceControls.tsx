'use client';

import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, VolumeIcon, VolumeXIcon } from 'lucide-react';

interface VoiceControlsProps {
  isRecording: boolean;
  isPlaying: boolean;
  onRecordToggle: () => void;
}

export function VoiceControls({
  isRecording,
  isPlaying,
  onRecordToggle,
}: VoiceControlsProps) {
  return (
    <div className="flex justify-center gap-4">
      <Button
        size="lg"
        variant={isRecording ? 'destructive' : 'default'}
        className="w-40 gap-2"
        onClick={onRecordToggle}
      >
        {isRecording ? (
          <>
            <MicOff className="w-5 h-5" />
            Stop
          </>
        ) : (
          <>
            <Mic className="w-5 h-5" />
            Record
          </>
        )}
      </Button>

      <Button
        size="lg"
        variant="secondary"
        className="w-40 gap-2"
        disabled={!isPlaying}
      >
        {isPlaying ? (
          <>
            <Volume2 className="w-5 h-5" />
            Playing...
          </>
        ) : (
          <>
            <VolumeIcon className="w-5 h-5" />
            Silent
          </>
        )}
      </Button>
    </div>
  );
}
