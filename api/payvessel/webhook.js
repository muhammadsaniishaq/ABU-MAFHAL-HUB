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
    
    // Tura Payvessel-Signature idan akwai
    if (req.headers.has('payvessel-http-signature')) {
      headers.set("payvessel-http-signature", req.headers.get('payvessel-http-signature'));
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
