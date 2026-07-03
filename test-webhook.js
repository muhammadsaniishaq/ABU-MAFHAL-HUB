const url = "https://uagcxrtdqttayulvgpwg.supabase.co/functions/v1/payment-webhook";

async function test() {
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-paystack-signature": "dummy" // triggers paystack path
        },
        body: JSON.stringify({ event: "test" })
    });
    console.log(res.status, await res.text());
}
test();
