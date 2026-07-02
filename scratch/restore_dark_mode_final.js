const fs = require('fs');
const filePath = 'c:\\ABU-MAFHAL-HUB\\app\\manage\\users.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Page Background
content = content.replace(/<View className="flex-1 bg-slate-50">/, '<View className="flex-1 bg-[#0A1128]">');

// 2. List items and containers
content = content.replace(/bg-slate-50 rounded-\[30px\]/g, 'bg-[#0A1128] rounded-[30px]');
content = content.replace(/bg-white py-3 px-6 rounded-2xl/g, 'bg-[#111D3B] py-3 px-6 rounded-2xl');
content = content.replace(/bg-white border-slate-200\/80/g, 'bg-[#111D3B] border-[#D4AF37]/10');
content = content.replace(/border-slate-300 bg-slate-50/g, 'border-[#D4AF37]/20 bg-[#1A2950]');
content = content.replace(/bg-slate-50 border-slate-200/g, 'bg-[#1A2950] border-[#D4AF37]/10');

// 3. Text colors
content = content.replace(/text-slate-800/g, 'text-slate-100');
content = content.replace(/text-slate-900/g, 'text-white');
content = content.replace(/text-slate-700/g, 'text-slate-300');

// 4. Modal specific
content = content.replace(/bg-white p-4 rounded-\[20px\] border border-slate-200/g, 'bg-[#111D3B] p-4 rounded-[20px] border border-[#D4AF37]/20');
content = content.replace(/bg-white p-3 rounded-\[20px\] border border-slate-200/g, 'bg-[#111D3B] p-3 rounded-[20px] border border-[#D4AF37]/20');
content = content.replace(/bg-slate-50 rounded-xl border border-slate-200/g, 'bg-[#0A1128] rounded-xl border border-[#D4AF37]/20');
content = content.replace(/text-\[#0A1128\] text-base bg-slate-50/g, 'text-white text-base bg-[#0A1128]');
content = content.replace(/bg-white border border-slate-200 py-3/g, 'bg-[#111D3B] border border-[#D4AF37]/20 py-3');
content = content.replace(/bg-white rounded-2xl border border-\[#D4AF37\]\/20/g, 'bg-[#111D3B] rounded-2xl border border-[#D4AF37]/20');

// 5. General borders
content = content.replace(/border-slate-100/g, 'border-[#D4AF37]/10');
content = content.replace(/border-slate-200/g, 'border-[#D4AF37]/20');

// 6. Fix any white backgrounds of input containers in the modal!
// Wait! The user complained "botton din da zaka dannan idan ansa bvn shine baka sawa color ba". That's already fixed.
// And they complained "text on white that is white". In the dark theme, text inputs shouldn't be white with white text!
// Let's ensure the TextInputs inside the Edit Profile Form are dark with white text or white with dark text.
// My previous edit expanded the profile form and used `bg-white text-[#0A1128]` for the text inputs! So those are perfectly fine.

fs.writeFileSync(filePath, content);
console.log('Restored dark mode.');
