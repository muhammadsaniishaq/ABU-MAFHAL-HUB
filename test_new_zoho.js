const accessToken = '1000.027547a1f976366d0009a5fd5c707e5c.bc540c92689f86d23c5efdc53fd4f9f9';
const orgId = '911972993';

async function testJsonAdd() {
    const testUsername = `musaadmin${Math.floor(100 + Math.random() * 900)}`;
    const testEmail = `${testUsername}@abumafhal.com.ng`;
    console.log(`Testing JSON add creation for ${testEmail}...`);

    const userPayload = JSON.stringify({
        mode: 'add',
        primaryEmailAddress: testEmail,
        password: 'Password123!',
        firstName: 'Musa',
        lastName: 'Admin',
        displayName: 'Musa Admin'
    });

    const createRes = await fetch(`https://mail.zoho.com/api/organization/${orgId}/accounts`, {
        method: 'POST',
        headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: userPayload
    });

    const text = await createRes.text();
    console.log("Status:", createRes.status, "Response:", text);
}

testJsonAdd();
