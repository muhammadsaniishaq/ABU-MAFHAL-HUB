
export const FLUTTERWAVE_SECRET_KEY = Deno.env.get('FLUTTERWAVE_SECRET_KEY') ?? '';

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
        amount: any;
    };
}

export async function createFlutterwaveDVA(
    email: string,
    bvn: string,
    narration: string = 'Wallet Funding'
): Promise<FlutterwaveDVAResponse> {
    // Flutterwave requires BVN for virtual account creation usually
    const response = await fetch('https://api.flutterwave.com/v3/virtual-account-numbers', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email,
            bvn, // Required for most implementations
            is_permanent: true,
            narration,
        }),
    });

    return await response.json();
}
