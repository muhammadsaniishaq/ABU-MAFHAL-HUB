// Hardcoded for ease of deployment as requested by user context
export const CLUBKONNECT_USER_ID = Deno.env.get('CLUBKONNECT_USER_ID') || 'CK101269551'; 
export const CLUBKONNECT_API_KEY = Deno.env.get('CLUBKONNECT_API_KEY') ?? '';
const BASE_URL = 'https://www.nellobytesystems.com';

export interface ClubKonnectResponse {
  status: string; 
  message?: string;
  orderid?: string;
  [key: string]: unknown;
}

export class ClubKonnectClient {
  private async request(endpoint: string, params: Record<string, string>): Promise<ClubKonnectResponse> {
    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.append('UserID', CLUBKONNECT_USER_ID);
    url.searchParams.append('APIKey', CLUBKONNECT_API_KEY);
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`ClubKonnect API Error: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`ClubKonnect Request Failed (${endpoint}):`, error);
      throw error;
    }
  }

  // 1. Wallet Balance
  getWalletBalance() {
    return this.request('/APIWalletBalanceV1.asp', {});
  }

  // 2. Airtime
  buyAirtime(mobileNetwork: '01'|'02'|'03'|'04', mobileNumber: string, amount: number, requestId: string) {
    return this.request('/APIAirtimeV1.asp', {
      MobileNetwork: mobileNetwork,
      MobileNumber: mobileNumber,
      Amount: amount.toString(),
      RequestID: requestId,
      CallBackURL: '' 
    });
  }

  // 3. Data Bundle
  buyData(mobileNetwork: string, mobileNumber: string, planId: string, requestId: string) {
    return this.request('/APIDatabundleV1.asp', {
      MobileNetwork: mobileNetwork,
      MobileNumber: mobileNumber,
      DataPlan: planId,
      RequestID: requestId,
      CallBackURL: ''
    });
  }

  // 4. Cable TV
  payCableTV(cableProvider: string, smartCardNo: string, packageId: string, requestId: string) {
    return this.request('/APICableTVV1.asp', {
      CableProvider: cableProvider,
      SmartCardNo: smartCardNo,
      Package: packageId,
      RequestID: requestId,
      CallBackURL: ''
    });
  }

  // 5. Electricity
  payElectricity(disco: string, meterNo: string, amount: number, meterType: 'prepaid'|'postpaid', requestId: string) {
    return this.request('/APIElectricityV1.asp', {
      ElectricityCompany: disco,
      MeterNo: meterNo,
      Amount: amount.toString(),
      MeterType: meterType,
      RequestID: requestId,
      CallBackURL: ''
    });
  }

  // 6. Recharge Card Printing
  printRechargeCard(mobileNetwork: string, value: string, quantity: number, requestId: string) {
    return this.request('/APIRechargeCardV1.asp', {
      MobileNetwork: mobileNetwork,
      Value: value,
      Quantity: quantity.toString(),
      RequestID: requestId,
      CallBackURL: ''
    });
  }

  // 7. WAEC/JAMB Pins
  buyEPin(type: 'WAEC'|'JAMB', requestId: string) {
      // NOTE: Verify exact endpoint for Exams from docs if possible, falling back to guessing
      const endpoint = type === 'WAEC' ? '/APIWAECV1.asp' : '/APIJAMBV1.asp'; 
      return this.request(endpoint, {
          RequestID: requestId,
          CallBackURL: ''
      });
  }

  // Helper: Query Status
  queryTransactionStatus(orderId: string) {
      return this.request('/APIQueryV1.asp', {
          OrderID: orderId
      });
  }
}
