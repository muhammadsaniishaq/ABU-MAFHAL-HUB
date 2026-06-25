<?php
// Wannan zai tura duk wani sako da Payvessel suka turo zuwa asalin Supabase din mu
$supabase_url = 'https://uagcxrtdqttayulvgpwg.supabase.co/functions/v1/payment-webhook';

$data = file_get_contents('php://input');
$headers = getallheaders();

$ch = curl_init($supabase_url);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$curl_headers = array('Content-Type: application/json');
foreach ($headers as $key => $value) {
    $lower_key = strtolower($key);
    if ($lower_key !== 'host' && $lower_key !== 'content-length' && $lower_key !== 'content-type') {
        $curl_headers[] = "$key: $value";
    }
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $curl_headers);

$result = curl_exec($ch);
curl_close($ch);

echo $result;
?>
