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
            'Content-Type': 'application/json'
        };
    }

    private getNetworkId(network: string): number {
        const netLower = network.toLowerCase();
        if (netLower.includes('mtn') || netLower === '01') return 1;
        if (netLower.includes('glo') || netLower === '02') return 2;
        if (netLower.includes('airtel') || netLower === '04') return 3;
        if (netLower.includes('mobile') || netLower.includes('etisalat') || netLower === '03') return 4;
        return 1;
    }

    async buyAirtime(network: string, phone: string, amount: number, requestId: string) {
        const networkId = this.getNetworkId(network);
        const res = await fetch(`${this.baseUrl}/vtu/airtime/purchase/`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                network: networkId,
                phone_number: phone,
                amount: amount.toString(),
                airtime_type: "vtu",
                pin: this.pin
            })
        });
        const data = await res.json();
        
        // Map to standard response expected by our system
        if (data && data.success) {
            return {
                status: 'ORDER_COMPLETED',
                orderid: data.data?.transaction_id || requestId,
                message: data.message
            };
        } else {
            throw new Error(data.message || 'Failed to buy airtime via Bigi');
        }
    }

    async buyData(network: string, phone: string, planId: string, requestId: string) {
        const networkId = this.getNetworkId(network);
        const res = await fetch(`${this.baseUrl}/vtu/data/purchase/`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                network: networkId,
                phone_number: phone,
                plan: parseInt(planId, 10),
                pin: this.pin
            })
        });
        const data = await res.json();
        
        if (data && data.success) {
            return {
                status: 'ORDER_COMPLETED',
                orderid: data.data?.transaction_id || requestId,
                message: data.message
            };
        } else {
            throw new Error(data.message || 'Failed to buy data via Bigi');
        }
    }
}
