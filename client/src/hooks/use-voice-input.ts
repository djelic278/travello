import { useState, useCallback, useEffect } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useToast } from '@/hooks/use-toast';

export interface FormFields {
  // Pre-travel form fields
  submissionLocation?: string;
  submissionDate?: string;
  firstName?: string;
  lastName?: string;
  destination?: string;
  tripPurpose?: string;
  transportType?: string;
  transportDetails?: string;
  startDate?: string;
  duration?: string;
  projectCode?: string;
  requestedPrepayment?: string;

  // Post-travel form fields
  startMileage?: string;
  endMileage?: string;
  departureTime?: string;
  returnTime?: string;
  purpose?: string;
  date?: string;
  amount?: string;
  [key: string]: string | undefined;
}

export function useVoiceInput() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState<FormFields>({});
  const { toast } = useToast();

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const startListening = useCallback(async () => {
    if (!browserSupportsSpeechRecognition) {
      toast({
        title: "Error",
        description: "Your browser doesn't support speech recognition.",
        variant: "destructive"
      });
      return;
    }

    resetTranscript();
    await SpeechRecognition.startListening({ continuous: true });
  }, [browserSupportsSpeechRecognition, resetTranscript, toast]);

  const stopListening = useCallback(async () => {
    SpeechRecognition.stopListening();

    if (!transcript) {
      toast({
        title: "Error",
        description: "No voice input detected. Please try again.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch('/api/voice-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript }),
      });

      if (!response.ok) {
        throw new Error('Failed to process voice input');
      }

      const result = await response.json();
      setFormData(result);

      toast({
        title: "Success",
        description: "Voice input processed successfully!",
      });
    } catch (error) {
      console.error('Error processing voice input:', error);
      toast({
        title: "Error",
        description: "Failed to process voice input. Please try again or use manual input.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [transcript, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      SpeechRecognition.abortListening();
    };
  }, []);

  return {
    isListening: listening,
    isProcessing,
    transcript,
    formData,
    startListening,
    stopListening,
    resetTranscript,
    browserSupportsSpeechRecognition
  };
}