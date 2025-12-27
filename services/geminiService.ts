
// OpenRouter API Service for AI Agent Responses

const OPENROUTER_API_KEY = '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';
const OPENROUTER_MODEL = 'xiaomi/mimo-v2-flash:free';

// Map frontend model names to OpenRouter model IDs
const MODEL_MAP: Record<string, string> = {
  'gemini-2.5-flash': 'google/gemini-2.0-flash-exp:free',
  'gemini-3-pro-preview': 'google/gemini-2.0-flash-exp:free',
  'mimo-v2-flash': 'xiaomi/mimo-v2-flash:free',
  'openrouter-free': 'xiaomi/mimo-v2-flash:free',
};

export const generateAgentResponse = async (
  prompt: string,
  systemInstruction: string,
  model: string = OPENROUTER_MODEL
): Promise<string> => {
  try {
    const messages: any[] = [];
    
    // Add system instruction if provided
    if (systemInstruction) {
      messages.push({
        role: 'system',
        content: systemInstruction
      });
    }
    
    // Add user prompt
    messages.push({
      role: 'user',
      content: prompt
    });

    // Use the model mapping, fallback to default
    const actualModel = MODEL_MAP[model] || OPENROUTER_MODEL;
    console.log(`[AI Agent] Using model: ${actualModel} (requested: ${model})`);
    console.log(`[AI Agent] System prompt: ${systemInstruction?.substring(0, 100)}...`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: actualModel,
        messages: messages
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'OpenRouter API error');
    }

    let outputText = data.choices?.[0]?.message?.content || 'No output generated.';

    return outputText;
  } catch (error) {
    console.error("OpenRouter API Error:", error);
    throw new Error("Failed to execute agent.");
  }
};
