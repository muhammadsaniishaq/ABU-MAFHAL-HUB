export class BigiClient {
    private baseUrl = 'https://api.bigisub.ng/api/v2';
    private token: string;
    private pin: string;

    constructor(token: string, pin: string) {
        this.token = token;
        this.pin = pin;
    }

    private getHeaders() {
        return {
            'Authorization': `Token ${this.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    private cleanPhone(phone: string): string {
        let p = (phone || '').replace(/\D/g, '');
        if (p.startsWith('234') && p.length === 13) {
            p = '0' + p.slice(3);
        }
        return p;
    }

    private getNetworkId(network: string): number {
        const netLower = (network || '').toString().toLowerCase();
        if (netLower.includes('mtn') || netLower === '01' || netLower === '1') return 1;
        if (netLower.includes('glo') || netLower === '02' || netLower === '2') return 2;
        if (netLower.includes('airtel') || netLower === '04' || netLower === '3') return 3;
        if (netLower.includes('mobile') || netLower.includes('etisalat') || netLower === '03' || netLower === '4') return 4;
        return 1;
    }

    async buyAirtime(network: string, phone: string, amount: number, requestId: string) {
        const networkId = this.getNetworkId(network);
        const formattedPhone = this.cleanPhone(phone);
        const roundedAmount = Math.round(Number(amount)).toString();

        console.log(`[BigiClient] Dispatching Airtime: Network=${networkId}, Phone=${formattedPhone}, Amount=${roundedAmount}`);

        const res = await fetch(`${this.baseUrl}/vtu/airtime/purchase/`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                network: networkId,
                phone_number: formattedPhone,
                amount: roundedAmount,
                airtime_type: "vtu",
                pin: this.pin
            })
        });

        const data = await res.json().catch(() => null);
        console.log(`[BigiClient] Airtime Response (Status ${res.status}):`, JSON.stringify(data));

        if (data && (data.success === true || data.status === 'success' || res.status === 200 || res.status === 201)) {
            return {
                status: 'ORDER_COMPLETED',
                orderid: data.data?.transaction_id || data.transaction_id || data.reference || requestId,
                message: data.message || 'Airtime top-up successful via BigiSub'
            };
        } else {
            const errorMsg = data?.message || data?.error || data?.detail || `BigiSub error (HTTP ${res.status})`;
            throw new Error(errorMsg);
        }
    }

    async buyData(network: string, phone: string, planId: string, requestId: string) {
        const networkId = this.getNetworkId(network);
        const formattedPhone = this.cleanPhone(phone);
        const res = await fetch(`${this.baseUrl}/vtu/data/purchase/`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                network: networkId,
                phone_number: formattedPhone,
                plan: parseInt(planId, 10),
                pin: this.pin
            })
        });
        const data = await res.json().catch(() => null);
        
        if (data && (data.success === true || data.status === 'success' || res.status === 200 || res.status === 201)) {
            return {
                status: 'ORDER_COMPLETED',
                orderid: data.data?.transaction_id || data.transaction_id || data.reference || requestId,
                message: data.message || 'Data purchase successful via BigiSub'
            };
        } else {
            const errorMsg = data?.message || data?.error || data?.detail || `BigiSub data error (HTTP ${res.status})`;
            throw new Error(errorMsg);
        }
    }

    async getRechargePinPlans() {
        const res = await fetch(`${this.baseUrl}/vtu/recharge-pin/plans/`, {
            headers: {
                'Authorization': `Token ${this.token}`,
                'Accept': 'application/json'
            }
        });
        const data = await res.json().catch(() => null);
        if (data && data.success && Array.isArray(data.data)) {
            return data.data;
        }
        throw new Error(data?.message || 'Failed to fetch recharge pin plans');
    }

    async buyRechargePin(planId: string | number, quantity: number, businessName: string, requestId: string) {
        const res = await fetch(`${this.baseUrl}/vtu/recharge-pin/purchase/`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                plan: typeof planId === 'number' ? planId : parseInt(planId, 10),
                quantity: quantity,
                business_name: businessName || 'ABU MAFHAL VTU',
                pin: this.pin
            })
        });
        const data = await res.json().catch(() => null);
        if (data && (data.success || res.status === 201)) {
            return {
                status: 'ORDER_COMPLETED',
                orderid: data.data?.transaction_id || requestId,
                data: data.data || data,
                pins: data.data?.pins || (data.data?.pin ? [{ pin: data.data.pin, serial: data.data.serial || '1' }] : [])
            };
        } else {
            throw new Error(data?.message || data?.detail || data?.error || 'Failed to purchase recharge pin via Bigi');
        }
    }
}
