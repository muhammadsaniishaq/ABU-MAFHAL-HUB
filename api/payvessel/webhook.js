// Wannan file din zai zama "Proxy" don tura sakon Payvessel zuwa Supabase Edge Function 
// Tunda Payvessel basu yarda a saka URL din Supabase kai tsaye ba.

export default async function handler(req, res) {
  // Kawai POST request ake bukata
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabaseWebhookUrl = 'https://uagcxrtdqttayulvgpwg.supabase.co/functions/v1/payment-webhook';

    // Mun tattara duk headers da Payvessel suka turo
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    
    // Tura Payvessel-Signature idan akwai
    if (req.headers['payvessel-http-signature']) {
      headers.append("payvessel-http-signature", req.headers['payvessel-http-signature']);
    }

    // Tura asalin body din da Payvessel suka aiko zuwa Edge Function
    const response = await fetch(supabaseWebhookUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(req.body)
    });

    const responseText = await response.text();

    // Tura sakamakon da Edge Function ya bayar (Kamar 200 OK) zuwa Payvessel
    return res.status(response.status).send(responseText);

  } catch (error) {
    console.error("Proxy Error:", error);
    return res.status(500).json({ error: "Internal Proxy Error" });
  }
}
