const fs = require('fs');

let c = fs.readFileSync('app/(app)/profile.tsx', 'utf8');

const replacements = [
  { p: /className="flex-1 items-center justify-center bg-slate-950"/g, r: 'style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#020617" }}' },
  { p: /className="flex-1 bg-\[\#f8f9fc\]"/g, r: 'style={{ flex: 1, backgroundColor: "#f8f9fc" }}' },
  { p: /className="flex-1"/g, r: 'style={{ flex: 1 }}' },
  { p: /className="mt-6 px-6 gap-y-5"/g, r: 'style={{ marginTop: 24, paddingHorizontal: 24, gap: 20 }}' },
  { p: /className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"/g, r: 'style={{ backgroundColor: "white", borderRadius: 16, borderWidth: 1, borderColor: "#f1f5f9", overflow: "hidden" }}' },
  { p: /className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden"/g, r: 'style={{ backgroundColor: "white", borderRadius: 16, borderWidth: 1, borderColor: "#fde68a", overflow: "hidden" }}' },
  { p: /className="flex-row items-center py-3\.5 px-4 border-b border-slate-50"/g, r: 'style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#f8fafc" }}' },
  { p: /className="flex-row items-center py-3\.5 px-4"/g, r: 'style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 }}' },
  { p: /className="w-8 h-8 rounded-full bg-\[\#0d1b3e\]\/5 items-center justify-center mr-3"/g, r: 'style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(13, 27, 62, 0.05)", alignItems: "center", justifyContent: "center", marginRight: 12 }}' },
  { p: /className="w-8 h-8 rounded-full bg-amber-50 items-center justify-center mr-3"/g, r: 'style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#fffbeb", alignItems: "center", justifyContent: "center", marginRight: 12 }}' },
  { p: /className="w-8 h-8 rounded-full bg-red-50 items-center justify-center mr-3"/g, r: 'style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#fef2f2", alignItems: "center", justifyContent: "center", marginRight: 12 }}' },
  { p: /className="font-extrabold text-xs text-slate-800"/g, r: 'style={{ fontWeight: "800", fontSize: 12, color: "#1e293b" }}' },
  { p: /className="font-extrabold text-xs text-amber-700"/g, r: 'style={{ fontWeight: "800", fontSize: 12, color: "#b45309" }}' },
  { p: /className="font-extrabold text-xs text-red-600"/g, r: 'style={{ fontWeight: "800", fontSize: 12, color: "#dc2626" }}' },
  { p: /className="text-slate-400 text-\[10px\] font-medium mt-0\.5"/g, r: 'style={{ color: "#94a3b8", fontSize: 10, fontWeight: "500", marginTop: 2 }}' },
  { p: /className="text-amber-600\/70 text-\[10px\] font-medium mt-0\.5"/g, r: 'style={{ color: "rgba(217, 119, 6, 0.7)", fontSize: 10, fontWeight: "500", marginTop: 2 }}' },
  { p: /className="text-red-400 text-\[10px\] font-medium mt-0\.5"/g, r: 'style={{ color: "#f87171", fontSize: 10, fontWeight: "500", marginTop: 2 }}' },
  { p: /className="text-\[10px\] text-slate-400 font-extrabold uppercase tracking-widest mb-2 ml-1"/g, r: 'style={{ fontSize: 10, color: "#94a3b8", fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}' },
  { p: /className="text-\[10px\] text-amber-500 font-extrabold uppercase tracking-widest mb-2 ml-1"/g, r: 'style={{ fontSize: 10, color: "#f59e0b", fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}' },
];

for (const r of replacements) {
  c = c.replace(r.p, r.r);
}

fs.writeFileSync('app/(app)/profile.tsx', c);
console.log('Done replacing!');
