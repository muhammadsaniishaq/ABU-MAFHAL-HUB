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
     * 5 = VITEL
     */
    private getNetworkId(network: string): number {
        const netLower = (network || '').toString().toLowerCase();
        if (netLower.includes('mtn') || netLower === '01' || netLower === '1') return 1;
        if (netLower.includes('airtel') || netLower === '04' || netLower === '2') return 2;
        if (netLower.includes('glo') || netLower === '02' || netLower === '3') return 3;
        if (netLower.includes('vitel') || netLower === '05' || netLower === '5') return 5;
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

    /**
     * Airtime to Cash Step 1: Request OTP
     */
    async requestCashOtp(network: string | number, phone: string) {
        const networkId = typeof network === 'number' ? network : this.getNetworkId(network);
        const params = new URLSearchParams();
        params.append('step', '1');
        params.append('phone', phone);
        params.append('network', networkId.toString());
        params.append('token', this.token);

        const res = await fetch(`${this.baseUrl}/api/cash`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Token ${this.token}`
            },
            body: params.toString()
        });

        const data = await res.json();
        if (data.status === 'success' || data.step === 1) {
            return {
                status: 'success',
                message: data.message || 'OTP sent successfully',
                data: data.data, // session blob
                step: 1
            };
        } else {
            throw new Error(data.message || data.error || 'Failed to request OTP');
        }
    }

    /**
     * Airtime to Cash Step 2: Verify OTP
     */
    async verifyCashOtp(network: string | number, phone: string, otp: string, sessionBlob: string) {
        const networkId = typeof network === 'number' ? network : this.getNetworkId(network);
        const params = new URLSearchParams();
        params.append('step', '2');
        params.append('phone', phone);
        params.append('network', networkId.toString());
        params.append('otp', otp);
        params.append('data', sessionBlob);
        params.append('token', this.token);

        const res = await fetch(`${this.baseUrl}/api/cash`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Token ${this.token}`
            },
            body: params.toString()
        });

        const data = await res.json();
        if (data.status === 'success' || data.step === 2) {
            return {
                status: 'success',
                message: data.message || 'OTP verified successfully',
                balance: data.balance,
                data: data.data, // refreshed session blob
                step: 2
            };
        } else {
            throw new Error(data.message || data.error || 'Failed to verify OTP');
        }
    }

    /**
     * Airtime to Cash Step 3: Finalise Conversion
     */
    async finaliseCashConversion(network: string | number, phone: string, amount: number, sharePin: string, sessionBlob: string) {
        const networkId = typeof network === 'number' ? network : this.getNetworkId(network);
        const params = new URLSearchParams();
        params.append('step', '3');
        params.append('phone', phone);
        params.append('network', networkId.toString());
        params.append('amount', amount.toString());
        params.append('share_pin', sharePin);
        params.append('data', sessionBlob);
        params.append('token', this.token);

        const res = await fetch(`${this.baseUrl}/api/cash`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Token ${this.token}`
            },
            body: params.toString()
        });

        const data = await res.json();
        if (data.status === 'success' || data.credited) {
            return {
                status: 'success',
                message: data.message || `₦${data.credited} credited to wallet`,
                amount: data.amount,
                credited: data.credited || (amount * 0.8),
                discount_pct: data.discount_pct || 80,
                transid: data.transid || `AC_${Date.now()}`,
                oldbal: data.oldbal,
                newbal: data.newbal
            };
        } else {
            throw new Error(data.message || data.error || 'Failed to finalise airtime conversion');
        }
    }

    /**
     * Fetch Live Buyback Rates
     */
    async getCashRates() {
        const res = await fetch(`${this.baseUrl}/api/v1/plans/networks?service=cash`);
        const data = await res.json();
        if (data.status === 'success' || data.data) {
            return data.data || [];
        } else {
            throw new Error('Failed to fetch buyback rates');
        }
    }
}
