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
        if (netLower.includes('vitel') || netLower.includes('vital') || netLower === '05' || netLower === '5') return 5;
        if (netLower.includes('mobile') || netLower.includes('etisalat') || netLower.includes('t2') || netLower === '03' || netLower === '4') return 4;
        return 1;
    }

    private cleanPhone(phone: string): string {
        let p = (phone || '').replace(/\D/g, '');
        if (p.startsWith('234')) {
            p = '0' + p.slice(3);
        } else if (p.length === 10 && !p.startsWith('0')) {
            p = '0' + p;
        }
        return p;
    }

    /**
     * Buy Airtime via Bilalsadasub
     */
    async buyAirtime(network: string, phone: string, amount: number, requestId: string) {
        const networkId = this.getNetworkId(network);
        const formattedPhone = this.cleanPhone(phone);
        let res = await fetch(`${this.baseUrl}/api/topup/`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                network: networkId,
                phone: formattedPhone,
                amount: amount,
                airtime_type: "VTU",
                "request-id": requestId
            })
        });

        if (res.status === 404 || res.status === 405) {
            res = await fetch(`${this.baseUrl}/api/topup`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    network: networkId,
                    phone: formattedPhone,
                    amount: amount,
                    airtime_type: "VTU",
                    "request-id": requestId
                })
            });
        }

        const data = await res.json().catch(() => null);

        const statusStr = (data?.status || data?.Status || '').toString().toLowerCase();
        if (data && (statusStr === 'success' || statusStr === 'successful' || statusStr === 'process' || statusStr === 'completed' || data.success === true)) {
            return {
                status: 'ORDER_COMPLETED',
                orderid: data['request-id'] || data.ident || requestId,
                message: data.message || 'Airtime top-up successful'
            };
        } else {
            throw new Error(data?.message || data?.error || `Failed to buy airtime via Bilalsadasub (HTTP ${res.status})`);
        }
    }

    /**
     * Buy Data Bundle via Bilalsadasub
     */
    async buyData(network: string, phone: string, planId: string, requestId: string) {
        const networkId = this.getNetworkId(network);
        const formattedPhone = this.cleanPhone(phone);
        const cleanPlanId = (planId || '').toString().replace(/^[^\d]+/, '');
        const planInt = parseInt(cleanPlanId || planId, 10);
        const finalPlanId = isNaN(planInt) ? planId : planInt;

        const payload = {
            network: networkId,
            phone: formattedPhone,
            data_plan: finalPlanId,
            bypass: false,
            "request-id": requestId
        };

        console.log(`[Bilalsadasub] Dispatching Data: Network=${networkId}, Phone=${formattedPhone}, Plan=${finalPlanId}`);

        let res = await fetch(`${this.baseUrl}/api/data/`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.status === 404 || res.status === 405) {
            res = await fetch(`${this.baseUrl}/api/data`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload)
            });
        }

        const data = await res.json().catch(() => null);
        console.log(`[Bilalsadasub] Data Response (HTTP ${res.status}):`, JSON.stringify(data));

        const statusStr = (data?.status || data?.Status || '').toString().toLowerCase();
        const isSuccess = data && (
            statusStr === 'success' ||
            statusStr === 'successful' ||
            statusStr === 'process' ||
            statusStr === 'completed' ||
            data.success === true
        );

        if (isSuccess) {
            return {
                status: 'ORDER_COMPLETED',
                orderid: data['request-id'] || data.ident || data.id || requestId,
                message: data.message || 'Data purchase successful'
            };
        } else {
            const errorMsg = data?.message || data?.error || data?.detail || `Failed to buy data via Bilalsadasub (HTTP ${res.status})`;
            throw new Error(errorMsg);
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
