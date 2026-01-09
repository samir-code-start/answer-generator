
import { GoogleGenAI } from "@google/genai";
import { MarksWeightage, AnswerStyle } from "../types"; // Extension removed

export const SYSTEM_INSTRUCTION = `You are an SPPU University examiner, senior evaluator, and model answer designer. 

Core Objective: Generate exam-ready model answers that look correct, complete, and easy to evaluate.

Mandatory Answer Structure (unless overridden by specific style):
1. Introduction / Definition: 1–2 lines only. Crisp, formal tone.
2. Body (Point-Wise Explanation): 
   - Strictly in points using "X) Title** Explanation" format.
   - Points must be 2-4 lines max.
   - Maintain logical flow: Concept → working → advantages/examples → applications.
3. Conclusion (Optional): 1 short line only if suitable.

Marks-Based Content Control:
- 2 Marks → 2–3 concise points
- 5 Marks → 5–6 well-explained points
- 8 Marks → 8–9 structured points
- 10 Marks → 10–12 complete points

Style Rules:
- Use simple, direct, technically correct language.
- Use standard keywords: definition, working principle, logic, block diagram, truth table, advantage, application, limitation.
- NO long paragraphs, NO conversational tone, NO over-justification.

Output Requirement:
- Answers must appear correct at first glance.
- Compact, scan-ready, and matching SPPU evaluation patterns.`;

export async function generateSPPUAnswer(
  question: string,
  marks: MarksWeightage,
  style: AnswerStyle,
  customInstruction?: string
): Promise<string> {
  // Use strictly process.env.API_KEY for initialization as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const styleContext = customInstruction 
    ? `Apply this custom style instruction: "${customInstruction}"`
    : `Follow the standard "${style}" format.`;

  const prompt = `Question: ${question}
Marks Weightage: ${marks} Marks
Answer Style: ${style}
${styleContext}

Please provide the model answer strictly following the provided evaluator rules and style context.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
      },
    });

    return response.text || "Sorry, I couldn't generate an answer at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate answer. Please check your connection.");
  }
}

export async function suggestSPPUQuestions(topic: string): Promise<string> {
  // Use strictly process.env.API_KEY for initialization as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Generate exactly 10 high-probability exam questions for the Savitribai Phule Pune University (SPPU) for the subject/topic: "${topic}". 
  Format each question starting with a number (e.g., 1., 2., ...). 
  Ensure questions are typical of 5-10 marks weightage. 
  Only return the list of questions, no other text.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are an SPPU University question paper setter. Provide only the questions in a numbered list.",
        temperature: 0.8,
      },
    });

    return response.text || "";
  } catch (error) {
    console.error("Suggestion Error:", error);
    return "";
  }
}
