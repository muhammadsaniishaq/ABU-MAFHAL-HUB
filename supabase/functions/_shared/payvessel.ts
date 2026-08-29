export interface PayvesselBank {
    bankName: string;
    accountNumber: string;
    accountName: string;
    account_type?: string;
    expire_date?: string;
    trackingReference?: string;
}

export interface PayvesselDVAResponse {
    status: boolean;
    service: string;
    business?: string;
    message?: string;
    banks?: PayvesselBank[];
    errors?: Record<string, string[]>;
}

export interface PayvesselConfig {
    apiKey: string;
    apiSecret: string;
    businessId: string;
    url?: string;
}

export async function createPayvesselDVA(
    params: {
        email: string;
        name: string;
        phone: string;
        bvn?: string;
        nin?: string;
        bankcode?: string[];
    },
    config: PayvesselConfig
): Promise<PayvesselDVAResponse> {
    const apiKey = (config.apiKey || '').trim();
    const apiSecret = (config.apiSecret || '').trim();
    const businessId = (config.businessId || '').trim();
    const baseUrl = (config.url || 'https://api.payvessel.com').trim().replace(/\/+$/, '');

    console.log(`Creating Payvessel DVA for ${params.email} (BVN: ${params.bvn ? 'present' : 'absent'}, NIN: ${params.nin ? 'present' : 'absent'})`);

    if (!apiKey || !apiSecret || !businessId) {
        console.warn("Payvessel credentials (API Key, Secret, or Business ID) are not completely configured.");
        return {
            status: false,
            service: "CREATE_VIRTUAL_ACCOUNT",
            message: "Payvessel credentials are not configured in system_secrets.",
        };
    }

    try {
        // Normalize phone number to 11 digits (e.g. 08012345678)
        let cleanPhone = params.phone ? params.phone.replace(/\D/g, '') : '';
        if (cleanPhone.startsWith('234') && cleanPhone.length === 13) {
            cleanPhone = '0' + cleanPhone.slice(3);
        }

        const requestedBanks = params.bankcode && params.bankcode.length > 0
            ? params.bankcode
            : ["120001", "999991"]; // 9PSB (120001) and PalmPay (999991)

        const payload: Record<string, any> = {
            email: params.email.trim(),
            name: params.name.toUpperCase().trim(),
            phoneNumber: cleanPhone || '08000000000',
            bankcode: requestedBanks,
            account_type: "STATIC",
            businessid: businessId,
            business_id: businessId,
        };

        if (params.bvn) {
            payload.bvn = params.bvn.replace(/\D/g, '').trim();
        }
        if (params.nin) {
            payload.nin = params.nin.replace(/\D/g, '').trim();
        }

        const endpoint = `${baseUrl}/pms/api/external/request/customerReservedAccount/`;
        console.log(`Requesting Payvessel Endpoint: ${endpoint}`);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'api-key': apiKey,
                'api-secret': apiSecret,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result: any = await response.json();
        console.log("Payvessel Raw Response:", JSON.stringify(result));

        // Parse banks from response (supports direct banks property or nested in data)
        const rawBanks: any[] = result.banks || 
                               result.data?.banks || 
                               (Array.isArray(result.data) ? result.data : []) || 
                               [];

        const extractedBanks: PayvesselBank[] = rawBanks.map((b: any) => ({
            bankName: b.bankName || b.bank_name || (b.bankcode === '999991' ? 'PalmPay' : b.bankcode === '120001' ? '9Payment Service Bank' : 'Bank'),
            accountNumber: String(b.accountNumber || b.account_number || b.accountNo || '').trim(),
            accountName: b.accountName || b.account_name || params.name.toUpperCase().trim(),
            account_type: b.account_type || 'STATIC',
            expire_date: b.expire_date || b.expireDate,
            trackingReference: b.trackingReference || b.tracking_reference || ''
        })).filter(b => b.accountNumber.length >= 8);

        if (!response.ok || (!result.status && result.status !== 'success' && result.code !== 200) || extractedBanks.length === 0) {
            console.error("Payvessel DVA Creation Failed Response:", JSON.stringify(result));
            return {
                status: false,
                service: "CREATE_VIRTUAL_ACCOUNT",
                message: result.message || (result.errors ? JSON.stringify(result.errors) : "Failed to create virtual account at Payvessel"),
                errors: result.errors
            };
        }

        return {
            status: true,
            service: "CREATE_VIRTUAL_ACCOUNT",
            message: result.message || "Success",
            banks: extractedBanks
        };

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

