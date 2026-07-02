const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/nin-services/verify-nin.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `            } else {
                const msg = response.message || 'Unable to verify this NIN. Please check the number and try again.';
                if (msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('balance')) {
                    Alert.alert('Insufficient Balance', 'Your wallet balance is too low. Please fund your wallet and try again.');
                } else if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('auth')) {
                    Alert.alert('Session Expired', 'Please log out and log in again, then retry.');
                } else {
                    Alert.alert('Verification Failed', msg);
                }
            }
        } catch (e: any) {
            Alert.alert('Network Error', e.message || 'A network error occurred. Please check your connection and try again.');
        }`;

const replacement = `            } else {
                const msg = response.message || 'Unable to verify this NIN. Please check the number and try again.';
                const lowerMsg = msg.toLowerCase();
                if (lowerMsg.includes('insufficient') || lowerMsg.includes('balance')) {
                    Alert.alert('Insufficient Balance', 'Your wallet balance is too low. Please fund your wallet and try again.');
                } else if (lowerMsg.includes('unauthorized') || lowerMsg.includes('auth')) {
                    Alert.alert('Session Expired', 'Please log out and log in again, then retry.');
                } else if (lowerMsg.includes('not found') || lowerMsg.includes('no record') || lowerMsg.includes('does not exist') || lowerMsg.includes('not exist') || lowerMsg.includes('invalid or not found')) {
                    Alert.alert('No Record Found', 'The NIN you entered does not exist or has no record. Please check the number and try again.');
                } else {
                    Alert.alert('Verification Failed', msg);
                }
            }
        } catch (e: any) {
            const errM = e.message || '';
            if (errM.toLowerCase().includes('not found') || errM.toLowerCase().includes('no record') || errM.toLowerCase().includes('does not exist') || errM.toLowerCase().includes('not exist') || errM.toLowerCase().includes('invalid or not found')) {
                Alert.alert('No Record Found', 'The NIN you entered does not exist or has no record. Please check the number and try again.');
            } else {
                Alert.alert('Network Error', errM || 'A network error occurred. Please check your connection and try again.');
            }
        }`;

// Normalize line endings to avoid platform mismatches
const normContent = content.replace(/\r\n/g, '\n');
const normTarget = target.replace(/\r\n/g, '\n');
const normReplacement = replacement.replace(/\r\n/g, '\n');

const index = normContent.indexOf(normTarget);
if (index !== -1) {
    const updated = normContent.slice(0, index) + normReplacement + normContent.slice(index + normTarget.length);
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log('Successfully updated verify-nin.tsx with No Record Found Alert handling!');
} else {
    console.error('Could not find target block in verify-nin.tsx');
}
