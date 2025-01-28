import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { cn } from "@/lib/utils";

interface VoiceInputProps {
  onDataReceived: (data: Record<string, string>) => void;
  className?: string;
}

export function VoiceInput({ onDataReceived, className }: VoiceInputProps) {
  const {
    isListening,
    isProcessing,
    transcript,
    formData,
    startListening,
    stopListening,
    browserSupportsSpeechRecognition
  } = useVoiceInput();

  // Update parent component when we have new form data
  React.useEffect(() => {
    if (Object.keys(formData).length > 0) {
      onDataReceived(formData);
    }
  }, [formData, onDataReceived]);

  if (!browserSupportsSpeechRecognition) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2">
        <Button
          variant={isListening ? "destructive" : "default"}
          size="sm"
          onClick={isListening ? stopListening : startListening}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : isListening ? (
            <>
              <MicOff className="mr-2 h-4 w-4" />
              Stop Recording
            </>
          ) : (
            <>
              <Mic className="mr-2 h-4 w-4" />
              Start Voice Input
            </>
          )}
        </Button>
      </div>

      {(isListening || transcript) && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              {isListening ? "Listening..." : "Transcript:"}
            </p>
            <p className="mt-2 text-sm">
              {transcript || "Start speaking..."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
