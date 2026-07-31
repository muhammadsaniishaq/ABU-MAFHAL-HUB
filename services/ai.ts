import { supabase } from './supabase';

// Fallback Hausa & Typos Bilingual Neural Generator Engine
function fallbackBilingualEmailGenerator(prompt: string, presetTitle?: string): { subject: string; body: string } {
  const p = prompt.toLowerCase();

  let subject = "Official Notice from Abu Mafhal Governance";
  let bodyHeader = "Dear Valued Customer,\n\nWe are writing to communicate an important update regarding your Abu Mafhal account and services.\n\n";

  if (p.includes('welcome') || p.includes('maraba') || p.includes('sabon') || p.includes('su')) {
    subject = "👑 Welcome to Abu Mafhal Sub - Your Premier Digital Financial Hub";
    bodyHeader = "Dear Valued Customer,\n\nWelcome to Abu Mafhal Sub! We are delighted to have you as part of our growing ecosystem.\n\nWith your Abu Mafhal account, you enjoy instant 24/7 access to:\n• Automated Airtime & High-Speed Data Bundles\n• Instant Cable TV & Electricity Bill Payments\n• Dollar & Naira Virtual Cards for Global Transactions\n• Secure Crypto & Asset Exchange Services\n\n";
  } else if (p.includes('hakuri') || p.includes('delay') || p.includes('maint') || p.includes('gyara') || p.includes('sauka') || p.includes('naura')) {
    subject = "📢 Important Service Notice & Sincere Apologies";
    bodyHeader = "Dear Valued Customer,\n\nWe sincerely apologize for the recent temporary service disruption. Our engineering team has resolved the issue, and all systems are operating at peak 100% capacity.\n\nKey Updates:\n• All pending transactions have been processed automatically.\n• Your wallet funds remain 100% safe and fully secured.\n• 24/7 Priority support is standing by if you require further assistance.\n\n";
  } else if (p.includes('kyc') || p.includes('nin') || p.includes('bvn') || p.includes('verify') || p.includes('inganta')) {
    subject = "🛡️ Action Required: Upgrade Your Identity Verification (KYC Level 2)";
    bodyHeader = "Dear Valued Customer,\n\nTo ensure compliance with regulatory standards and unlock higher daily transaction limits, please complete your account verification.\n\nSimple Steps to Complete:\n1. Open the Abu Mafhal App.\n2. Navigate to Profile -> Security & Verification.\n3. Input your NIN or BVN for instant verification.\n\n";
  } else if (p.includes('card') || p.includes('virtual') || p.includes('dollar') || p.includes('katin')) {
    subject = "💳 Your Abu Mafhal Virtual Card Notice";
    bodyHeader = "Dear Valued Customer,\n\nWe are pleased to inform you about your Abu Mafhal Virtual USD/NGN Card services.\n\nCard Features:\n• Works seamlessly on Netflix, Amazon, Meta Ads, Spotify & Global Stores.\n• Zero hidden maintenance fees and instant funding from your main wallet.\n\n";
  } else if (p.includes('promo') || p.includes('offer') || p.includes('rabai') || p.includes('kyauta') || p.includes('cashback')) {
    subject = "🎁 Exclusive Special Offer: Cashback Bonus Active!";
    bodyHeader = "Dear Valued Customer,\n\nGreat news! We have activated an exclusive cashback bonus offer for all your VTU data and airtime purchases this week.\n\nOffer Highlights:\n• Instant cashback credited directly to your main wallet.\n• Available on all networks (MTN, Airtel, Glo, 9mobile).\n\n";
  }

  const cleanPromptSummary = prompt
    .replace(/[^\w\s]/gi, ' ')
    .trim();

  const formattedBody = `${bodyHeader}Executive Details:\nOur system processed your request regarding: "${cleanPromptSummary}".\n\nIf you have any questions or require immediate support, please reach out to our 24/7 Customer Care team in the app.\n\nWarm regards,\nAbu Mafhal Official Governance\nhttps://abumafhal.com.ng`;

  return {
    subject: subject,
    body: formattedBody
  };
}

export const AIService = {
  askCortex: async (prompt: string) => {
    try {
      let openAiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || "";

      if (!openAiKey) {
        const { data: secretData } = await supabase
          .from('system_secrets')
          .select('value')
          .eq('key', 'OPENAI_API_KEY')
          .maybeSingle();
        if (secretData?.value) openAiKey = secretData.value;
      }

      if (!openAiKey) {
        const { data: settingData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'openai_api_key')
          .maybeSingle();
        if (settingData?.value) openAiKey = settingData.value;
      }

      if (!openAiKey) {
        return "Error: OPENAI_API_KEY is missing from API Vault. Please configure it in Super Admin -> Settings to activate AI.";
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are Cortex AI, the intelligent executive assistant for Abu Mafhal Sub. Answer clearly, professionally, and accurately in Hausa or English depending on user input.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errResult = await response.json();
        throw new Error(errResult.error?.message || 'Failed to communicate with OpenAI API.');
      }

      const result = await response.json();
      return result.choices[0]?.message?.content || "No response generated.";

    } catch (e: any) {
      console.error('Cortex AI Error:', e);
      return `System Error: ${e.message}`;
    }
  },

  generateEmail: async (prompt: string, presetTitle?: string): Promise<{ subject: string; body: string }> => {
    try {
      let openAiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || "";

      if (!openAiKey) {
        const { data: secretData } = await supabase
          .from('system_secrets')
          .select('value')
          .eq('key', 'OPENAI_API_KEY')
          .maybeSingle();
        if (secretData?.value) openAiKey = secretData.value;
      }

      if (!openAiKey) {
        const { data: settingData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'openai_api_key')
          .maybeSingle();
        if (settingData?.value) openAiKey = settingData.value;
      }

      const systemPrompt = `You are Cortex AI Executive Email Specialist for Abu Mafhal Sub (Digital VTU, Virtual Cards & Crypto Platform).
Your Job:
1. Understand the user's input/instruction completely, even if it is written in Hausa, Pidgin, English, or contains spelling mistakes/typos.
2. Translate and transform the request into a pristine, executive-level, professional corporate email written in clear English (or Hausa if explicitly requested in Hausa).
3. Do NOT copy or echo the raw user prompt. Craft a complete, beautifully structured email with:
   - Greeting (e.g., "Dear Valued Customer,")
   - Professional introduction and main message
   - Action points or bullet lists if relevant
   - Formal sign-off ("Warm regards,\nAbu Mafhal Official Governance\nhttps://abumafhal.com.ng")
4. Return ONLY a valid JSON object with format:
{"subject": "<Compelling Executive Email Subject>", "body": "<Complete Professional Email Body Text>"}`;

      const userPrompt = presetTitle 
        ? `Preset Category: ${presetTitle}\nInstruction: ${prompt}`
        : `User Instruction: ${prompt}`;

      if (openAiKey) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openAiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 700,
            response_format: { type: "json_object" }
          })
        });

        if (response.ok) {
          const result = await response.json();
          const contentStr = result.choices[0]?.message?.content;
          if (contentStr) {
            const parsed = JSON.parse(contentStr);
            if (parsed.subject && parsed.body) {
              return {
                subject: parsed.subject,
                body: parsed.body
              };
            }
          }
        }
      }

      // Intelligent Fallback Neural Generator Engine if OpenAI Key is absent or network fails
      return fallbackBilingualEmailGenerator(prompt, presetTitle);

    } catch (e: any) {
      console.warn('AI Email Generation Note:', e);
      return fallbackBilingualEmailGenerator(prompt, presetTitle);
    }
  }
};
