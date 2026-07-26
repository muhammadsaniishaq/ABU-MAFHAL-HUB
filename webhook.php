<?php
// Wannan zai tura duk wani sako da Payvessel suka turo zuwa asalin Supabase din mu
$supabase_url = 'https://uagcxrtdqttayulvgpwg.supabase.co/functions/v1/payment-webhook';
$anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZ2N4cnRkcXR0YXl1bHZncHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2Mzc3OTIsImV4cCI6MjA4NDIxMzc5Mn0.7AzXKou9G3tHFIduDL5TQ3fkski6P9CBGdlqfi_pMI8';

$data = file_get_contents('php://input');
$headers = getallheaders();

$ch = curl_init($supabase_url);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$curl_headers = array('Content-Type: application/json', 'Authorization: Bearer ' . $anon_key);
foreach ($headers as $key => $value) {
    $lower_key = strtolower($key);
    if ($lower_key !== 'host' && $lower_key !== 'content-length' && $lower_key !== 'content-type' && $lower_key !== 'authorization') {
        $curl_headers[] = "$key: $value";
    }
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $curl_headers);

$result = curl_exec($ch);
curl_close($ch);

echo $result;
?>
