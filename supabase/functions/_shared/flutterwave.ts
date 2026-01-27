

const FLW_KEY = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
if (!FLW_KEY) {
    console.error("Missing FLUTTERWAVE_SECRET_KEY environment variable");
}
export const FLUTTERWAVE_SECRET_KEY = FLW_KEY ?? '';


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
        // 1. Prepare User Data
        // Reverted to simple email-based flow. No need to pre-create customer via API if using /virtual-account-numbers?
        // Actually, /virtual-account-numbers might auto-create customer or just link by email.

        const phone = phoneNumber || '08000000000';
        
        console.log(`Skipping explicit Customer ID creation. Using Email: ${email}`);


        // 2. Create Virtual Account
        // Reverting to Standard V3 Endpoint: /virtual-account-numbers which uses EMAIL
        // The /virtual-accounts endpoint with customer_id seems to be for a different product set or version not active on standard base URL.
        
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
