import { TravelExpense } from "@db/schema";
import OpenAI from "openai";
import sharp from "sharp";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function processReceipt(imageBuffer: Buffer): Promise<Partial<TravelExpense>> {
  try {
    // Resize and optimize image
    const processedImage = await sharp(imageBuffer)
      .resize(1024, 1024, { fit: 'inside' })
      .toBuffer();

    // Convert to base64
    const base64Image = processedImage.toString('base64');

    // Process with OpenAI Vision
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the following information from this receipt image in JSON format: amount (number), date (ISO string), description (string), merchant (string). If any field is not found, omit it from the response."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        },
      ],
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    // Safely parse JSON response
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const result = JSON.parse(content);

    return {
      amount: result.amount,
      name: result.description || result.merchant,
      date: result.date ? new Date(result.date) : undefined,
    };
  } catch (error) {
    console.error('Error processing receipt:', error);
    throw new Error('Failed to process receipt');
  }
}