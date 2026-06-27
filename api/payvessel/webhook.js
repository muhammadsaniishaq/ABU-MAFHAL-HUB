const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Disable Vercel's default bodyParser to fetch the raw request body (needed for signature verification)
const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to read the raw request body stream
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Payvessel Webhook Invoked`);

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      console.error('[CRITICAL] Missing SUPABASE_URL.');
      return res.status(500).json({ error: 'Server Configuration Error', details: 'SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) is missing in Vercel environment variables' });
    }

    if (!supabaseServiceRoleKey) {
      console.error('[CRITICAL] Missing SUPABASE_SERVICE_ROLE_KEY.');
      return res.status(500).json({ error: 'Server Configuration Error', details: 'SUPABASE_SERVICE_ROLE_KEY is missing in Vercel environment variables. Please add it to your Vercel Dashboard.' });
    }

    // Initialize Supabase Client with service role key to bypass Row Level Security
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 1. Get raw body text
    const rawBodyBuffer = await getRawBody(req);
    const bodyText = rawBodyBuffer.toString('utf8');

    // 2. Fetch Payvessel API Secret (priority to Vercel env, fallback to Supabase system_secrets)
    let payvesselSecret = process.env.PAYVESSEL_API_SECRET;
    if (!payvesselSecret) {
      const { data: secretRow, error: secretError } = await supabaseAdmin
        .from('system_secrets')
        .select('value')
        .eq('key', 'PAYVESSEL_API_SECRET')
        .maybeSingle();

      if (secretError) {
        console.error('[Database Error] Failed to read system_secrets:', secretError);
        return res.status(500).json({ error: 'Database verification error', details: secretError.message });
      }

      if (secretRow && secretRow.value) {
        payvesselSecret = secretRow.value;
      }
    }

    if (!payvesselSecret) {
      console.error('[CRITICAL] PAYVESSEL_API_SECRET is not configured.');
      return res.status(500).json({ error: 'Provider Config Error', details: 'PAYVESSEL_API_SECRET is not set in Vercel env or system_secrets table' });
    }

    // 3. Verify signature
    const signature = req.headers['payvessel-http-signature'] ||
                      req.headers['http_payvessel_http_signature'] || 
                      req.headers['http-payvessel-http-signature'] ||
                      req.headers['HTTP_PAYVESSEL_HTTP_SIGNATURE'];

    if (!signature) {
      console.error('Signature verification failed: Missing Payvessel signature header.');
      return res.status(401).json({ error: 'Unauthorized: Missing signature' });
    }

    const computedSignature = crypto
      .createHmac('sha512', payvesselSecret)
      .update(bodyText)
      .digest('hex');

    if (computedSignature !== signature) {
      console.error(`Signature verification failed: Mismatch.\nHeader: ${signature}\nComputed: ${computedSignature}`);
      return res.status(401).json({ 
        error: 'Unauthorized: Invalid signature', 
        details: 'The signature computed by the server does not match the payvessel-http-signature header. Check if PAYVESSEL_API_SECRET is correct.' 
      });
    }

    // 4. Parse the payload
    let eventData;
    try {
      eventData = JSON.parse(bodyText);
    } catch (parseErr) {
      console.error('Failed to parse body JSON:', parseErr);
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    console.log('Payvessel Event Received:', eventData.event);

    if (eventData.event !== 'transaction.success' && eventData.event !== 'reserved_account.credit') {
      console.log(`Event ignored: ${eventData.event}`);
      return res.status(200).json({ message: 'Event Ignored' });
    }

    const transactionObj = eventData.transaction || eventData.data || {};
    const orderObj = eventData.order || eventData.data || {};

    const reference = transactionObj.reference || eventData.reference;
    const rawAmount = orderObj.amount || transactionObj.amount || eventData.amount;
    const amount = parseFloat(String(rawAmount));
    const currency = orderObj.currency || transactionObj.currency || eventData.currency || 'NGN';
    const email = transactionObj.customer_email || transactionObj.customer?.email || eventData.customer_email || eventData.email;

    const accountNumber = transactionObj.account_number || 
                          transactionObj.accountNumber || 
                          eventData.account_number || 
                          eventData.accountNumber ||
                          transactionObj.virtual_account?.account_number ||
                          transactionObj.virtualAccount?.accountNumber ||
                          transactionObj.virtualAccount?.account_number ||
                          transactionObj.virtual_account?.accountNumber ||
                          transactionObj.customer?.virtual_account_number ||
                          transactionObj.customer?.virtualAccountNumber ||
                          eventData.virtual_account?.account_number ||
                          eventData.virtualAccount?.accountNumber ||
                          eventData.customer?.virtual_account_number;

    console.log(`[Payvessel Webhook] Parsed: Ref=${reference}, Amt=${amount}, Email=${email}, AccNum=${accountNumber}`);

    if (!reference || isNaN(amount)) {
      console.error('Missing required transaction fields:', { reference, amount });
      return res.status(400).json({ error: 'Invalid data structure' });
    }

    // 5. Idempotency Check (Duplicate Transaction Check)
    const { data: existingTx, error: txCheckError } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('reference', reference)
      .maybeSingle();

    if (txCheckError) {
      console.error('Database Error checking duplicate transaction:', txCheckError);
      return res.status(500).json({ error: 'Database check error' });
    }

    if (existingTx) {
      console.log(`Duplicate transaction ignored. Reference: ${reference} already processed.`);
      return res.status(200).json({ message: 'Transaction already processed' });
    }

    // 6. Find User ID
    let userId = null;
    let method = 'none';

    if (accountNumber) {
      const { data: va, error: vaError } = await supabaseAdmin
        .from('virtual_accounts')
        .select('user_id')
        .eq('account_number', accountNumber)
        .maybeSingle();

      if (vaError) {
        console.error('Database Error finding virtual account:', vaError);
        return res.status(500).json({ error: 'Database lookup error' });
      }

      if (va && va.user_id) {
        userId = va.user_id;
        method = 'virtual_account';
      }
    }

    // Fallback to email if not found by account number
    if (!userId && email) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (profileError) {
        console.error('Database Error finding user profile:', profileError);
        return res.status(500).json({ error: 'Database lookup error' });
      }

      if (profile && profile.id) {
        userId = profile.id;
        method = 'email';
      }
    }

    if (!userId) {
      console.error(`User not found for account: ${accountNumber}, email: ${email}`);
      return res.status(404).json({ error: 'Account/User not found' });
    }

    console.log(`[Payvessel Webhook] User matched via ${method}: ${userId}`);

    // 7. Update User Balance (Atomic RPC)
    let finalBalance = 0;
    const { data: newBalance, error: updateError } = await supabaseAdmin.rpc('credit_balance', {
      user_id: userId,
      amount: amount,
    });

    if (updateError) {
      console.error('Database Error updating user balance via RPC:', updateError.message);
      console.warn('Falling back to standard fetch-and-update');
      
      const { data: currentProfile, error: fetchErr } = await supabaseAdmin
          .from('profiles')
          .select('balance')
          .eq('id', userId)
          .single();
          
      if (fetchErr) return res.status(500).json({ error: 'Failed to fetch balance for fallback' });

      finalBalance = (parseFloat(currentProfile.balance || "0") + amount);
      const { error: fallbackUpdateErr } = await supabaseAdmin
          .from('profiles')
          .update({ balance: finalBalance })
          .eq('id', userId);

      if (fallbackUpdateErr) return res.status(500).json({ error: 'Failed to update balance during fallback' });
    } else {
      finalBalance = newBalance;
    }

    console.log(`[Payvessel Webhook] Balance updated successfully. New balance: ${finalBalance}`);

    // 8. Record the Transaction
    const { error: insertTxError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'deposit',
        amount: amount,
        status: 'success',
        reference: reference,
        description: `Deposit via Payvessel (${method}) - Ref: ${reference}`,
      });

    if (insertTxError) {
      console.error('Database Warning: Failed to insert transaction log:', insertTxError);
    }

    // 9. Also record the event in payment_events for standard logging
    const { error: insertEventError } = await supabaseAdmin
      .from('payment_events')
      .insert({
        provider: 'payvessel',
        reference: reference,
        amount: amount,
        currency: currency,
        status: 'success',
        metadata: { ...eventData, account_number: accountNumber },
        processed_at: new Date().toISOString()
      });

    if (insertEventError) {
      console.error('Database Warning: Failed to insert payment event log:', insertEventError);
    }

    console.log('[Payvessel Webhook] Done. Transaction successfully finalized.');
    return res.status(200).json({ status: 'success', message: 'Wallet Funded Successfully' });

  } catch (error) {
    console.error('[CRITICAL] Payvessel Webhook Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}

module.exports = handler;
module.exports.config = config;
