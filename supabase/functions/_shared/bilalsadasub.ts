export class BilalsadasubClient {
    private baseUrl = 'https://bilalsadasub.com';
    private token: string;

    constructor(token: string) {
        this.token = token;
    }

    private getHeaders() {
        return {
            'Authorization': `Token ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Map network name or code to Bilalsadasub network integer ID:
     * 1 = MTN
     * 2 = AIRTEL
     * 3 = GLO
     * 4 = 9MOBILE / T2
     */
    private getNetworkId(network: string): number {
        const netLower = (network || '').toString().toLowerCase();
        if (netLower.includes('mtn') || netLower === '01' || netLower === '1') return 1;
        if (netLower.includes('airtel') || netLower === '04' || netLower === '2') return 2;
        if (netLower.includes('glo') || netLower === '02' || netLower === '3') return 3;
        if (netLower.includes('mobile') || netLower.includes('etisalat') || netLower.includes('t2') || netLower === '03' || netLower === '4') return 4;
        return 1;
    }

    /**
     * Buy Airtime via Bilalsadasub
     */
    async buyAirtime(network: string, phone: string, amount: number, requestId: string) {
        const networkId = this.getNetworkId(network);
        const res = await fetch(`${this.baseUrl}/api/topup`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                network: networkId,
                phone: phone,
                amount: amount,
                airtime_type: "VTU",
                "request-id": requestId
            })
        });

        const data = await res.json();

        if (data && (data.status === 'success' || data.status === 'process')) {
            return {
                status: 'ORDER_COMPLETED',
                orderid: data['request-id'] || requestId,
                message: data.message || 'Airtime top-up successful'
            };
        } else {
            throw new Error(data.message || data.error || 'Failed to buy airtime via Bilalsadasub');
        }
    }

    /**
     * Buy Data Bundle via Bilalsadasub
     */
    async buyData(network: string, phone: string, planId: string, requestId: string) {
        const networkId = this.getNetworkId(network);
        const planInt = parseInt(planId, 10);

        const res = await fetch(`${this.baseUrl}/api/data`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                network: networkId,
                phone: phone,
                data_plan: isNaN(planInt) ? planId : planInt,
                bypass: false,
                "request-id": requestId
            })
        });

        const data = await res.json();

        if (data && (data.status === 'success' || data.status === 'process')) {
            return {
                status: 'ORDER_COMPLETED',
                orderid: data['request-id'] || requestId,
                message: data.message || 'Data purchase successful'
            };
        } else {
            throw new Error(data.message || data.error || 'Failed to buy data via Bilalsadasub');
        }
    }
}
