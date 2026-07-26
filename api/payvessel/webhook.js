export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const supabaseWebhookUrl = 'https://uagcxrtdqttayulvgpwg.supabase.co/functions/v1/payment-webhook';

    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    
    // Copy all request headers from Payvessel (except host and content-length)
    for (const [key, value] of req.headers.entries()) {
      const lowerKey = key.toLowerCase();
      if (lowerKey !== 'host' && lowerKey !== 'content-length') {
        headers.set(key, value);
      }
    }

    // Always ensure Authorization header is present so Supabase Edge Gateway does not reject with 401 Unauthorized
    if (!headers.has('authorization')) {
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZ2N4cnRkcXR0YXl1bHZncHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2Mzc3OTIsImV4cCI6MjA4NDIxMzc5Mn0.7AzXKou9G3tHFIduDL5TQ3fkski6P9CBGdlqfi_pMI8';
      headers.set('authorization', `Bearer ${anonKey}`);
    }

    // Dauki ainihin asalin rubutun da suka aiko (Raw Body) ba tare da an canza shi ba
    // Wannan shi ne sirrin da zai sa Signature ya yi daidai!
    const rawBody = await req.text();

    const response = await fetch(supabaseWebhookUrl, {
      method: 'POST',
      headers: headers,
      body: rawBody
    });

    const responseText = await response.text();

    return new Response(responseText, { 
        status: response.status,
        headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error("Proxy Error:", error);
    return new Response(JSON.stringify({ error: "Internal Proxy Error" }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
