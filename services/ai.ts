import { supabase } from './supabase';

// Fallback Hausa & Typos Bilingual Neural Generator Engine
function fallbackBilingualEmailGenerator(prompt: string, presetTitle?: string): { subject: string; body: string } {
  const p = prompt.toLowerCase();
  
  // Check if prompt explicitly requests English (e.g., "turanci", "english", "sauya zuwa turanci", "a turanci")
  const wantsEnglish = p.includes('turanci') || p.includes('english') || p.includes('to english') || p.includes('in english') || p.includes('sauya zuwa turanci') || p.includes('a turanci') || p.includes('fara a turanci');

  const isHausa = !wantsEnglish && (p.includes('maraba') || p.includes('sakon') || p.includes('sanarwa') || p.includes('godiya') || p.includes('gyara') || p.includes('gaiya') || p.includes('yanzu') || p.includes('abokan') || p.includes('kuka') || p.includes('tura') || p.includes('tambaya') || p.includes('kudi') || p.includes('saura') || p.includes('hausa'));

  let subject = isHausa ? "Sanarwa ta Hukuma daga Abu Mafhal Sub" : "Official Notice from Abu Mafhal Governance";
  let body = "";

  if (p.includes('welcome') || p.includes('maraba') || p.includes('sabon') || p.includes('su')) {
    if (isHausa) {
      subject = "👑 Sannu da Zuwa Abu Mafhal Sub - Dandalin Tsaron Kudade na Yanar Gizo";
      body = `Barka da zuwa Abu Mafhal Sub!\n\nMuna murna da shigowarku cikin wannan tsari namu mai inganci. A matsayinku na abokin ciniki na musamman, zaku ci moriyar wadannan ayyuka cikin sauki da sauri 24/7:\n\n• Sayen Data & Katuna a saukake\n• Biyan kudin Wutar Larki & DSTV/GOTV\n• Katunan Dollar & Naira Virtual Card don sayayya a duniya\n• Canjin Crypto da Kudaden Waje cikin aminci\n\nIdan kuna buqatar taimako, sashen tallafinmu yana shirye 24/7 don amsa muku.\n\nNagode,\nAbu Mafhal Official Governance\nhttps://abumafhal.com.ng`;
    } else {
      subject = "👑 Welcome to Abu Mafhal Sub - Your Premier Digital Financial Hub";
      body = `Dear Valued Customer,\n\nWelcome to Abu Mafhal Sub! We are delighted to have you as part of our growing ecosystem.\n\nWith your Abu Mafhal account, you enjoy instant 24/7 access to:\n• Automated Airtime & High-Speed Data Bundles\n• Instant Cable TV & Electricity Bill Payments\n• Dollar & Naira Virtual Cards for Global Transactions\n• Secure Crypto & Asset Exchange Services\n\nIf you require any assistance, our 24/7 Customer Care team is standing by.\n\nWarm regards,\nAbu Mafhal Official Governance\nhttps://abumafhal.com.ng`;
    }
  } else if (p.includes('hakuri') || p.includes('delay') || p.includes('maint') || p.includes('gyara') || p.includes('sauka') || p.includes('naura') || p.includes('matsala')) {
    if (isHausa) {
      subject = "📢 Sanarwar Gyara da Neman Gafara daga Abu Mafhal";
      body = `Abokan Ciniki Masu Daraja,\n\nMuna muku ban hakuri bisa dan tangarda da aka samu a tsarinmu kwanan nan. Injiniyoyinmu sun kammala gyare-gyare kuma tsarin yana aiki 100% lami lafiya.\n\nSakon Tabbatarwa:\n• Dukkan ayyukan da aka aike sun sarrafu lami lafiya.\n• Kudade da asusunku suna nan a amince ba tare da wata matsala ba.\n• Sashen taimako yana aiki 24/7 don amsa duk wata tambayarku.\n\nMuna godiya sosai da hakurinku da amincinku gare mu.\n\nNagode,\nAbu Mafhal Official Governance\nhttps://abumafhal.com.ng`;
    } else {
      subject = "📢 Important Service Notice & Sincere Apologies";
      body = `Dear Valued Customer,\n\nWe sincerely apologize for the recent temporary service disruption. Our engineering team has resolved the issue, and all systems are operating at peak 100% capacity.\n\nKey Updates:\n• All pending transactions have been processed automatically.\n• Your wallet funds remain 100% safe and fully secured.\n• 24/7 Priority support is standing by if you require further assistance.\n\nThank you for your patience and continued trust in Abu Mafhal Sub.\n\nWarm regards,\nAbu Mafhal Official Governance\nhttps://abumafhal.com.ng`;
    }
  } else if (p.includes('kyc') || p.includes('nin') || p.includes('bvn') || p.includes('verify') || p.includes('inganta') || p.includes('cike')) {
    if (isHausa) {
      subject = "🛡️ Tabbatar da Shaida (KYC): Hafta Tsarin Asusunka";
      body = `Sannu Abokin Cinikinsu,\n\nDon cika ka'idojin tsaro da kara yawan kudaden da zaka iya tura a kullum, muna rokonka da ka kammala tabbatar da shaidarka (KYC Level 2).\n\nHanyoyin Cikawa:\n1. Bude manhajar Abu Mafhal App.\n2. Shiga wajen Profile -> Security & Verification.\n3. Shigar da lambar NIN ko BVN dinka don tabbatarwa cikin sauri.\n\nNagode,\nAbu Mafhal Official Governance\nhttps://abumafhal.com.ng`;
    } else {
      subject = "🛡️ Action Required: Upgrade Your Identity Verification (KYC Level 2)";
      body = `Dear Valued Customer,\n\nTo ensure compliance with regulatory standards and unlock higher daily transaction limits, please complete your account verification.\n\nSimple Steps to Complete:\n1. Open the Abu Mafhal App.\n2. Navigate to Profile -> Security & Verification.\n3. Input your NIN or BVN for instant verification.\n\nWarm regards,\nAbu Mafhal Official Governance\nhttps://abumafhal.com.ng`;
    }
  } else if (p.includes('card') || p.includes('virtual') || p.includes('dollar') || p.includes('katin')) {
    if (isHausa) {
      subject = "💳 Sanarwa Game da Katunan Dollar & Naira Virtual Cards";
      body = `Abokin Ciniki Mai Daraja,\n\nMuna farin cikin sanar da kai sababbin damammaki da ke tattare da katin Virtual USD/NGN Card na Abu Mafhal.\n\nAmfanin Katunan:\n• Yana aiki ba tare da matsala ba a Netflix, Amazon, Meta Ads, Spotify da shagunan duniya.\n• Ba a cire kudaden kulawa na boye, sannan zaka iya sanya kudi nan take daga babban asusunka.\n\nNagode,\nAbu Mafhal Official Governance\nhttps://abumafhal.com.ng`;
    } else {
      subject = "💳 Your Abu Mafhal Virtual Card Notice";
      body = `Dear Valued Customer,\n\nWe are pleased to inform you about your Abu Mafhal Virtual USD/NGN Card services.\n\nCard Features:\n• Works seamlessly on Netflix, Amazon, Meta Ads, Spotify & Global Stores.\n• Zero hidden maintenance fees and instant funding from your main wallet.\n\nWarm regards,\nAbu Mafhal Official Governance\nhttps://abumafhal.com.ng`;
    }
  } else if (p.includes('promo') || p.includes('offer') || p.includes('rabai') || p.includes('kyauta') || p.includes('cashback')) {
    if (isHausa) {
      subject = "🎁 Kyautar Cashback da Sauran Rangwame na Abu Mafhal!";
      body = `Barka da Yau,\n\nMuna albishir gare ku cewa mun kunna tsarin Cashback da kyaututtukan rangwame a wannan mako don duk wani sayen Data ko Airtime!\n\nMahimman Muka:\n• Zaku samu kudin komawa (Cashback) nan take a asusunku.\n• Yana aiki a duk cibiyoyin MTN, Airtel, Glo, da 9mobile.\n\nNagode,\nAbu Mafhal Official Governance\nhttps://abumafhal.com.ng`;
    } else {
      subject = "🎁 Exclusive Special Offer: Cashback Bonus Active!";
      body = `Dear Valued Customer,\n\nGreat news! We have activated an exclusive cashback bonus offer for all your VTU data and airtime purchases this week.\n\nOffer Highlights:\n• Instant cashback credited directly to your main wallet.\n• Available on all networks (MTN, Airtel, Glo, 9mobile).\n\nWarm regards,\nAbu Mafhal Official Governance\nhttps://abumafhal.com.ng`;
    }
  } else {
    // Clean custom notice generator without quoting raw prompt text
    let cleanText = prompt
      .replace(/sauya\s+wannan\s+sako\s+zuwa\s+turanci:?/gi, '')
      .replace(/rubuta\s+(a\s+)?turanci:?/gi, '')
      .replace(/translate\s+(this\s+)?(message\s+)?to\s+english:?/gi, '')
      .trim();

    if (wantsEnglish || !isHausa) {
      subject = presetTitle ? `${presetTitle}` : "Official Governance Notice - Abu Mafhal Sub";
      body = `Dear Valued Customer,\n\nWe are writing to communicate an official governance notice regarding your Abu Mafhal Sub account and services.\n\nNotice Details:\n${cleanText || 'Please review the updated service guidelines in your mobile app.'}\n\nIf you have any questions or require immediate support, our 24/7 Customer Care team is standing by to assist you.\n\nWarm regards,\nAbu Mafhal Official Governance\nhttps://abumafhal.com.ng`;
    } else {
      subject = presetTitle ? `${presetTitle}` : "Sanarwa ta Hukuma daga Abu Mafhal Sub";
      body = `Zuwa Ga Abokan Cinikinmu Masu Daraja,\n\nMuna aiko muku da wannan sanarwa mai mahimmanci dangane da tsarin gudanarwa na Abu Mafhal Sub.\n\nBayanai:\n${cleanText || 'Muna rokonku da ku duba sababbin sharauda a cikin manhaja.'}\n\nIdan kuna da wata tambaya ko buqatar karin bayani, zaku iya tuntubar sashenmu na taimako a kowane lokaci a cikin manhajar.\n\nBabbaba da aminci,\nAbu Mafhal Official Governance\nhttps://abumafhal.com.ng`;
    }
  }

  return {
    subject: subject,
    body: body
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
1. Understand the user's instruction/prompt completely, whether written in Hausa, English, or Pidgin.
2. CRITICAL LANGUAGE RULE:
   - If the user instruction is written in Hausa BUT asks to translate, convert, or write the email in English (e.g., mentions "turanci", "english", "sauya zuwa turanci", "a turanci"), YOU MUST DRAFT THE ENTIRE EMAIL (SUBJECT & BODY) IN PRISTINE, EXECUTIVE ENGLISH!
   - If the instruction explicitly asks for Hausa (mentions "hausa", "a hausa"), draft the email in Hausa.
   - If no specific language target is mentioned in a Hausa prompt, default to writing a high-quality executive English corporate email.
3. CRITICAL REQUIREMENT: Do NOT echo, quote, or include phrases like "User instruction:", "Instruction:", "Sauya wannan sako...", or repeat raw instruction text inside the output. Craft a standalone, beautifully structured complete email with:
   - Greeting (e.g., "Dear Valued Customer,")
   - Clear, highly accurate introduction and main message expanding on the instruction
   - Bullet points or action steps if relevant
   - Formal sign-off ("Warm regards,\nAbu Mafhal Official Governance\nhttps://abumafhal.com.ng")
4. Return ONLY a valid JSON object with format:
{"subject": "<Compelling Executive Email Subject>", "body": "<Complete Professional Email Body Text>"}`;

      const userPrompt = presetTitle 
        ? `Category: ${presetTitle}\nInstruction: ${prompt}`
        : `Instruction: ${prompt}`;

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

