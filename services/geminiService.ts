import { MarksWeightage, AnswerStyle } from "../types";

// Note: Filename kept as geminiService.ts to preserve imports in App.tsx, 
// but the logic now powers the DeepSeek API.

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

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

export async function generateSPPUAnswer(
  question: string,
  marks: MarksWeightage,
  style: AnswerStyle,
  customInstruction?: string
): Promise<string> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("DeepSeek API Key is missing in environment variables.");
  }
  
  const styleContext = customInstruction 
    ? `Apply this custom style instruction: "${customInstruction}"`
    : `Follow the standard "${style}" format.`;

  const userPrompt = `Question: ${question}
Marks Weightage: ${marks} Marks
Answer Style: ${style}
${styleContext}

Please provide the model answer strictly following the provided evaluator rules and style context.`;

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        top_p: 0.95,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("DeepSeek API Error Details:", errorData);
      throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Sorry, I couldn't generate an answer at this time.";
  } catch (error) {
    console.error("DeepSeek Generation Error:", error);
    throw new Error("Failed to generate answer. Please check your API key and connection.");
  }
}

export async function suggestSPPUQuestions(topic: string): Promise<string> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return "";
  
  const userPrompt = `Generate exactly 10 high-probability exam questions for the Savitribai Phule Pune University (SPPU) for the subject/topic: "${topic}". 
  Format each question starting with a number (e.g., 1., 2., ...). 
  Ensure questions are typical of 5-10 marks weightage. 
  Only return the list of questions, no other text.`;

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are an SPPU University question paper setter. Provide only the questions in a numbered list." },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.8,
        stream: false
      })
    });

    if (!response.ok) return "";

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("Suggestion Error:", error);
    return "";
  }
}
