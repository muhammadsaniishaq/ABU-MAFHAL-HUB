
export const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

export interface PaystackDVAResponse {
    status: boolean;
    message: string;
    data: {
        bank: {
            name: string;
            id: number;
            slug: string;
        };
        account_name: string;
        account_number: string;
        assigned: boolean;
        currency: string;
        metadata: Record<string, unknown> | null;
        active: boolean;
        id: number;
        created_at: string;
        updated_at: string;
    } | null;
}

export async function createPaystackDVA(
    email: string,
    firstName: string,
    lastName: string,
    phone: string
): Promise<PaystackDVAResponse> {
    try {
        // 1. Create or Get Customer
        const customerResponse = await fetch('https://api.paystack.co/customer', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                first_name: firstName,
                last_name: lastName,
                phone,
            }),
        });

        if (!customerResponse.ok) {
            const errorText = await customerResponse.text();
            throw new Error(`Paystack Customer API Error (${customerResponse.status}): ${errorText}`);
        }

        const customerData = await customerResponse.json();

        if (!customerData.status) {
            console.error('Paystack User Create Error:', customerData);

            // Fallback: Fetch user by email if they exist
            if (customerData.message === 'Customer already exists') {
                const fetchCustomer = await fetch(`https://api.paystack.co/customer/${email}`, {
                    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
                });
                const existingCustomer = await fetchCustomer.json();
                if (existingCustomer.status) {
                    return await assignDVA(existingCustomer.data.customer_code);
                }
            }

            throw new Error(`Paystack Customer Error: ${customerData.message}`);
        }

        const customerCode = customerData.data.customer_code;
        return await assignDVA(customerCode);
    } catch (error: unknown) {
        console.error("CreatePaystackDVA Wrapper Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to communicate with Paystack";
        return {
             status: false,
             message: errorMessage,
             data: null
        };
    }
}

async function assignDVA(customerCode: string): Promise<PaystackDVAResponse> {
    const response = await fetch('https://api.paystack.co/dedicated_account', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            customer: customerCode,
             // Removed preferred_bank to allow Paystack to assign any available bank
             // preferred_bank: 'wema-bank', 
        }),
    });

    return await response.json();
}

export interface PaystackBVNResponse {
    status: boolean;
    message: string;
    data: {
        first_name: string;
        last_name: string;
        dob: string;
        formatted_dob: string;
        mobile: string;
        bvn: string;
        [key: string]: unknown;
    } | null;
}

export async function resolveBVN(bvn: string): Promise<PaystackBVNResponse> {
    const response = await fetch(`https://api.paystack.co/bank/resolve_bvn/${bvn}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    return await response.json();
}
