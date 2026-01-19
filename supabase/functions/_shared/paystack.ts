
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
        metadata: any;
        active: boolean;
        id: number;
        created_at: string;
        updated_at: string;
    };
}

export async function createPaystackDVA(
    email: string,
    firstName: string,
    lastName: string,
    phone: string
): Promise<PaystackDVAResponse> {
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

    const customerData = await customerResponse.json();

    if (!customerData.status) {
        // If customer already exists, we might get a status=false but still need their code.
        // In a real app, we'd handle "Customer already exists" by fetching them.
        // For now, let's assume valid or throw.
        // Paystack often returns the customer code even on duplicate error, or we can fetch by email.
        console.error('Paystack User Create Error:', customerData);

        // Fallback: Fetch user by email if they exist
        if (customerData.message === 'Customer already exists') {
            // Proceed to fetch logic if needed, or assume we can create DVA directly with just customer code if we had it.
            // Actually, to create a DVA, we need the customer_code.
            // Let's fetch the customer to get the code.
            const fetchCustomer = await fetch(`https://api.paystack.co/customer/${email}`, {
                headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
            });
            const existingCustomer = await fetchCustomer.json();
            if (existingCustomer.status) {
                return assignDVA(existingCustomer.data.customer_code);
            }
        }

        throw new Error(`Paystack Customer Error: ${customerData.message}`);
    }

    const customerCode = customerData.data.customer_code;
    return assignDVA(customerCode);
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
            preferred_bank: 'wema-bank', // You can make this dynamic
        }),
    });

    return await response.json();
}
