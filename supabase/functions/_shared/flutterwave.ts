import { getSystemSecret } from './secrets.ts';

export interface FlutterwaveDVAResponse {
    status: string;
    message: string;
    data: {
        response_code: string;
        response_message: string;
        flw_ref: string;
        order_ref: string;
        account_number: string;
        account_status: string;
        frequency: string;
        bank_name: string;
        created_at: string;
        expiry_date: string;
        note: string;
        amount: number | null;
    } | null;
}

export async function createFlutterwaveDVA(
    email: string,
    bvn: string,
    narration: string = 'Wallet Funding',
    firstName?: string,
    lastName?: string,
    phoneNumber?: string,
    tx_ref?: string
): Promise<FlutterwaveDVAResponse> {
    console.log(`Creating Flutterwave DVA for ${email} (BVN: ${bvn})`);
    
    try {
        const FLUTTERWAVE_SECRET_KEY = await getSystemSecret('FLUTTERWAVE_SECRET_KEY', 'FLUTTERWAVE_SECRET_KEY');
        if (!FLUTTERWAVE_SECRET_KEY) {
            throw new Error('FLUTTERWAVE_SECRET_KEY is not configured in system_secrets');
        }

        const phone = phoneNumber || '08000000000';
        
        console.log(`Skipping explicit Customer ID creation. Using Email: ${email}`);

        const payload = {
            email, 
            is_permanent: true,
            bvn,
            tx_ref: tx_ref || `dva-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            phonenumber: phone,
            firstname: firstName,
            lastname: lastName,
            narration
        };
        
        console.log("Using Endpoint: /virtual-account-numbers");

        const response = await fetch('https://api.flutterwave.com/v3/virtual-account-numbers', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        
        if (result.status !== 'success') {
             console.error("FLW Account Create Error:", JSON.stringify(result));
        }

        return result;

    } catch (error: unknown) {
         const message = error instanceof Error ? error.message : 'Exception during DVA creation';
         return {
             status: 'error',
             message: message,
             data: null
         };
    }
}

// Basic interface for KYC responses
interface KYCResponse {
    status: string;
    message: string;
    data?: unknown;
}

export async function verifyBVN(bvn: string): Promise<KYCResponse> {
    const FLUTTERWAVE_SECRET_KEY = await getSystemSecret('FLUTTERWAVE_SECRET_KEY', 'FLUTTERWAVE_SECRET_KEY');
    if (!FLUTTERWAVE_SECRET_KEY) {
        throw new Error('FLUTTERWAVE_SECRET_KEY is not configured in system_secrets');
    }

    const response = await fetch(`https://api.flutterwave.com/v3/kyc/bvns/${bvn}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    return await response.json();
}

// Note: NIN verification logic can vary based on the specific FW endpoint version enabled
export async function verifyNIN(nin: string): Promise<KYCResponse> {
    const FLUTTERWAVE_SECRET_KEY = await getSystemSecret('FLUTTERWAVE_SECRET_KEY', 'FLUTTERWAVE_SECRET_KEY');
    if (!FLUTTERWAVE_SECRET_KEY) {
        throw new Error('FLUTTERWAVE_SECRET_KEY is not configured in system_secrets');
    }

    const response = await fetch(`https://api.flutterwave.com/v3/kyc/nin`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: nin })
    });
    return await response.json();
}
