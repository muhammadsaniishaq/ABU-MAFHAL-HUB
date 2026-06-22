
const PAYVESSEL_API_KEY = Deno.env.get('PAYVESSEL_API_KEY') ?? '';
const PAYVESSEL_API_SECRET = Deno.env.get('PAYVESSEL_API_SECRET') ?? '';
const PAYVESSEL_BUSINESS_ID = Deno.env.get('PAYVESSEL_BUSINESS_ID') ?? '';
const PAYVESSEL_URL = Deno.env.get('PAYVESSEL_URL') || 'https://api.payvessel.com';

if (!PAYVESSEL_API_KEY || !PAYVESSEL_API_SECRET || !PAYVESSEL_BUSINESS_ID) {
    console.warn("Payvessel credentials (API Key, Secret, or Business ID) are not completely configured.");
}

export interface PayvesselBank {
    bankName: string;
    accountNumber: string;
    accountName: string;
    account_type: string;
    expire_date?: string;
    trackingReference: string;
}

export interface PayvesselDVAResponse {
    status: boolean;
    service: string;
    business?: string;
    message?: string;
    banks?: PayvesselBank[];
    errors?: Record<string, string[]>;
}

export async function createPayvesselDVA(params: {
    email: string;
    name: string;
    phone: string;
    bvn?: string;
    nin?: string;
}): Promise<PayvesselDVAResponse> {
    console.log(`Creating Payvessel STATIC DVA for ${params.email} (BVN: ${params.bvn ? 'present' : 'absent'}, NIN: ${params.nin ? 'present' : 'absent'})`);

    try {
        const payload: Record<string, any> = {
            email: params.email,
            name: params.name.toUpperCase(), // Payvessel recommends uppercase names
            phoneNumber: params.phone,
            bankcode: ["120001", "999991"], // 9PSB (120001) and PalmPay (999991)
            account_type: "STATIC",
            businessid: PAYVESSEL_BUSINESS_ID,
        };

        // Static accounts require BVN or NIN
        if (params.bvn) {
            payload.bvn = params.bvn;
        }
        if (params.nin) {
            payload.nin = params.nin;
        }

        const endpoint = `${PAYVESSEL_URL}/pms/api/external/request/customerReservedAccount/`;
        console.log(`Requesting Payvessel Endpoint: ${endpoint}`);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'api-key': PAYVESSEL_API_KEY,
                'api-secret': PAYVESSEL_API_SECRET,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result: PayvesselDVAResponse = await response.json();
        
        if (!response.ok || !result.status) {
            console.error("Payvessel DVA Creation Error Response:", JSON.stringify(result));
            return {
                status: false,
                service: "CREATE_VIRTUAL_ACCOUNT",
                message: result.message || "Failed to create virtual account at Payvessel",
                errors: result.errors
            };
        }

        return result;

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Exception during DVA creation';
        console.error("Payvessel DVA Request Exception:", error);
        return {
            status: false,
            service: "CREATE_VIRTUAL_ACCOUNT",
            message: message,
        };
    }
}
