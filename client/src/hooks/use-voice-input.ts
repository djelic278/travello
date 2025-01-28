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
  location?: string;
  startMileage?: string;
  endMileage?: string;
  purpose?: string;
  date?: string;
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
            Extract the following fields if mentioned: location, start mileage, end mileage, travel purpose, and date.
            Format the response as JSON with the following structure:
            {
              "location": "extracted location",
              "startMileage": "number as string",
              "endMileage": "number as string",
              "purpose": "extracted purpose",
              "date": "extracted date in YYYY-MM-DD format"
            }
            Only include fields that are explicitly mentioned in the input.`
          },
          {
            role: "user",
            content: transcript
          }
        ]
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
