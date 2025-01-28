import { useState, useCallback, useEffect } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import OpenAI from 'openai';
import { useToast } from '@/hooks/use-toast';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

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
    setIsProcessing(true);

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that extracts travel form information from voice input.
            Extract any relevant fields from this list if mentioned:
            - submissionLocation
            - submissionDate
            - firstName
            - lastName
            - destination
            - tripPurpose
            - transportType
            - transportDetails
            - startDate
            - duration
            - projectCode
            - requestedPrepayment
            - startMileage (number)
            - endMileage (number)
            - departureTime (date)
            - returnTime (date)
            - purpose (for expenses)
            - amount (number for expenses)

            Format the response as JSON with string values for all fields. Convert dates to YYYY-MM-DD format.
            Only include fields that are explicitly mentioned in the input.`
          },
          {
            role: "user",
            content: transcript
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
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