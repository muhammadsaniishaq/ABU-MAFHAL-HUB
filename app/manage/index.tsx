import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Dimensions, TextInput, StyleSheet, Platform,
  Image, Alert, StatusBar, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: W } = Dimensions.get('window');

// ── Brand: Navy #0F172A  Gold #D97706 ──────────────────────────────────────
const C = {
  bg:          '#F5F3EE',       // warm off-white — friendly, not cold gray
  white:       '#FFFFFF',
  card:        '#FFFFFF',
  navy:        '#0F172A',       // PRIMARY
  navyMid:     '#1E293B',
  navyLight:   '#EFF2F7',       // very light navy tint for card BGs
  navySoft:    '#334155',
  gold:        '#D97706',       // SECONDARY
  goldMid:     '#F59E0B',
  goldLight:   '#FEF3C7',       // soft gold background
  goldBorder:  '#FCD34D',
  border:      '#E2E8F2',
  soft:        '#F8F9FC',
  text:        '#0F172A',
  sub:         '#475569',
  muted:       '#94A3B8',
  // Status only (not for module cards)
  red:         '#DC2626',  redL:  '#FEF2F2',
  green:       '#16A34A',  greenL:'#F0FDF4',
};

// All modules use Navy or Gold brand palette only
const G = C.gold;     // gold
const GL= C.goldLight;// gold light bg
const N = C.navy;     // navy
const NL= C.navyLight;// navy light bg

const MODS = {
  operations: [
    { t:'Users Control',   i:'people',          r:'/manage/users',          c:N,  b:NL,  badge:0, tag:'Core' },
    { t:'BVN Tasks',       i:'finger-print',     r:'/manage/bvn-tasks',      c:G,  b:GL,  badge:0, tag:'Identity' },
    { t:'NIN Tasks',       i:'card',             r:'/manage/nin-tasks',      c:N,  b:NL,  badge:0, tag:'Identity' },
    { t:'KYC Requests',    i:'id-card',          r:'/manage/kyc',            c:G,  b:GL,  badge:0 },
    { t:'NIN Pricing',     i:'pricetag',         r:'/manage/nin-pricing',    c:N,  b:NL },
    { t:'BVN Pricing',     i:'pricetags',        r:'/manage/bvn-pricing',    c:G,  b:GL },
    { t:'Mail Center',     i:'mail-unread',      r:'/manage/mail-center',    c:N,  b:NL },
    { t:'SMM Pricing',     i:'thumbs-up',        r:'/manage/smm-pricing',    c:N,  b:NL },
    { t:'Bills Pricing',   i:'flash',            r:'/manage/bills-pricing',  c:G,  b:GL },
    { t:'CAC Mgmt',        i:'briefcase',        r:'/manage/cac',            c:N,  b:NL },
    { t:'Help Desk',       i:'chatbubbles',      r:'/manage/tickets',        c:G,  b:GL,  badge:0 },
    { t:'Content CMS',     i:'images',           r:'/manage/cms',            c:N,  b:NL },
    { t:'Data Plans',      i:'wifi',             r:'/manage/data-plans',     c:G,  b:GL,  tag:'API' },
    { t:'Airtime',         i:'call',             r:'/manage/airtime',        c:N,  b:NL },
    { t:'Localization',    i:'language',         r:'/manage/localization',   c:G,  b:GL },
    { t:'Bulk SMS',        i:'chatbubbles',      r:'/manage/bulk-sms',       c:N,  b:NL },
    { t:'Reviews',         i:'star',             r:'/manage/reviews',        c:G,  b:GL },
  ],
  banking: [
    { t:'API Liquidity',   i:'wallet',           r:'/manage/liquidity',      c:G,  b:GL,  tag:'Live' },
    { t:'Cards',           i:'card',             r:'/manage/cards',          c:N,  b:NL },
    { t:'Lending',         i:'cash',             r:'/manage/lending',        c:G,  b:GL,  badge:0 },
    { t:'Wealth',          i:'trending-up',      r:'/manage/wealth',         c:N,  b:NL },
    { t:'Rates',           i:'stats-chart',      r:'/manage/rates',          c:G,  b:GL,  tag:'Live' },
  ],
  finance: [
    { t:'Risk Control',    i:'alert-circle',     r:'/manage/risk',           c:N,  b:NL },
    { t:'Analytics',       i:'bar-chart',        r:'/manage/reports',        c:G,  b:GL },
    { t:'Comms Center',    i:'megaphone',        r:'/manage/communications', c:N,  b:NL },
    { t:'Cortex AI',       i:'sparkles',         r:'/manage/ai',             c:G,  b:GL,  tag:'AI' },
    { t:'Crypto Mgmt',     i:'logo-bitcoin',     r:'/manage/crypto',         c:N,  b:NL },
  ],
  technical: [
    { t:'Infrastructure',  i:'server',           r:'/manage/infrastructure', c:N,  b:NL },
    { t:'Database',        i:'server',           r:'/manage/db',             c:G,  b:GL },
    { t:'API Vault',       i:'code-working',     r:'/manage/api',            c:N,  b:NL },
    { t:'Cinema',          i:'videocam',         r:'/manage/cinema',         c:G,  b:GL },
    { t:'Terminal',        i:'terminal',         r:'/manage/terminal',       c:N,  b:NL },
    { t:'Feature Flags',   i:'toggle',           r:'/manage/features',       c:G,  b:GL },
    { t:'App Store',       i:'logo-apple',       r:'/manage/stores',         c:N,  b:NL,  badge:1 },
    { t:'Files',           i:'folder-open',      r:'/manage/files',          c:G,  b:GL },
  ],
  internal: [
    { t:'Staff HR',        i:'briefcase',        r:'/manage/staff',          c:N,  b:NL },
    { t:'Voice OS',        i:'mic',              r:'/manage/voice',          c:G,  b:GL },
    { t:'Legal',           i:'document-text',    r:'/manage/legal',          c:N,  b:NL },
    { t:'Team Chat',       i:'people-circle',    r:'/manage/team',           c:G,  b:GL,  badge:0, sup:true },
    { t:'Academy',         i:'school',           r:'/manage/academy',        c:N,  b:NL },
    { t:'Theme & UX',      i:'color-palette',    r:'/manage/appearance',     c:G,  b:GL },
    { t:'Automation',      i:'flash',            r:'/manage/automation',     c:N,  b:NL },
    { t:'Kanban',          i:'grid',             r:'/manage/kanban',         c:G,  b:GL },
  ],
  redZone: [
    { t:'Security Hub',    i:'shield-checkmark', r:'/manage/security',       c:N,  b:NL },
    { t:'Forensics',       i:'finger-print',     r:'/manage/forensics',      c:G,  b:GL },
    { t:'API Keys',        i:'key',              r:'/manage/api',            c:N,  b:NL },
    { t:'System Logs',     i:'list',             r:'/manage/logs',           c:G,  b:GL },
    { t:'Geo Map',         i:'earth',            r:'/manage/map',            c:N,  b:NL },
    { t:'Settings',        i:'settings',         r:'/manage/settings',       c:G,  b:GL },
    { t:'PANIC ROOM',      i:'warning',          r:'/manage/panic',          c:C.red, b:C.redL },
  ],
};

const QUICK = [
  { l:'Master Hub',  i:'ribbon',        r:'/manage/super-admin',    c:N,  b:NL,  sup:true },
  { l:'Users',       i:'people',        r:'/manage/users',          c:G,  b:GL },
  { l:'Liquidity',   i:'wallet',        r:'/manage/liquidity',      c:N,  b:NL },
  { l:'Data Plans',  i:'wifi',          r:'/manage/data-plans',     c:G,  b:GL },
  { l:'Help Desk',   i:'chatbubbles',   r:'/manage/tickets',        c:N,  b:NL },
  { l:'Broadcast',   i:'megaphone',     r:'/manage/communications', c:G,  b:GL },
  { l:'KYC Queue',   i:'scan',          r:'/manage/kyc',            c:N,  b:NL },
  { l:'Panic Room',  i:'warning',       r:'/manage/panic',          c:C.red, b:C.redL, sup:true },
];

const DOCK = [
  { i:'grid',        r:'/manage',              l:'Home' },
  { i:'people',      r:'/manage/users',        l:'Users' },
  { i:'wallet',      r:'/manage/liquidity',    l:'Funds' },
  { i:'chatbubbles', r:'/manage/tickets',      l:'Tickets' },
  { i:'settings',    r:'/manage/settings',     l:'Settings' },
];

const CAT: Record<string,{title:string;icon:string;c:string;b:string}> = {
  operations: { title:'Operations & Core Services',  icon:'options',           c:G, b:GL },
  banking:    { title:'Banking, Liquidity & Assets', icon:'wallet',            c:N, b:NL },
  finance:    { title:'Finance, Crypto & Analytics', icon:'stats-chart',       c:G, b:GL },
  technical:  { title:'Technical Infrastructure',   icon:'terminal',          c:N, b:NL },
  internal:   { title:'Internal Affairs & HR',       icon:'business',          c:G, b:GL },
  redZone:    { title:'Security, Forensics & RedZone',icon:'shield-checkmark', c:C.red, b:C.redL },
};

const TABS = [
  { id:'all',        l:'All',         i:'grid-outline' },
  { id:'operations', l:'Operations',  i:'options-outline' },
  { id:'banking',    l:'Banking',     i:'wallet-outline' },
  { id:'finance',    l:'Finance',     i:'stats-chart-outline' },
  { id:'technical',  l:'Technical',   i:'terminal-outline',         sup:true },
  { id:'internal',   l:'Internal',    i:'business-outline' },
  { id:'redZone',    l:'Security',    i:'shield-checkmark-outline', sup:true },
];

export default function AdminDashboard() {
  const router    = useRouter();
  const pulse     = useRef(new Animated.Value(1)).current;
  const [profile, setProfile]   = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [logo, setLogo]         = useState<string|null>(null);
  const [tab, setTab]           = useState('all');
  const [hidden, setHidden]     = useState<string[]>([]);
  const [query, setQuery]       = useState('');
  const [counts, setCounts]     = useState({users:0,kyc:0,tickets:0,loans:0});

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse,{toValue:0.2,duration:900,useNativeDriver:true}),
      Animated.timing(pulse,{toValue:1,duration:900,useNativeDriver:true}),
    ])).start();
    AsyncStorage.getItem('@cached_admin_profile').then(s=>{
      if(s) try{setProfile(JSON.parse(s));}catch{}
    });
    load();

    const channel = supabase.channel('manage-hidden-modules-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.hidden_admin_modules' }, (payload: any) => {
        if (payload.new?.value) {
          try {
            const a = typeof payload.new.value === 'string' ? JSON.parse(payload.new.value) : payload.new.value;
            if (Array.isArray(a)) setHidden(a);
          } catch {}
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const load = async () => {
    try {
      const {data:{session}} = await supabase.auth.getSession();
      const user = session?.user || (await supabase.auth.getUser()).data.user;
      if(user){
        const {data:p} = await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle();
        const prof = p||{id:user.id,full_name:user.user_metadata?.full_name||'Admin',email:user.email,role:'admin',avatar_url:user.user_metadata?.avatar_url};
        setProfile(prof);
        AsyncStorage.setItem('@cached_admin_profile',JSON.stringify(prof));
      }
      const [lg,hd,uc,kc,tc,lc] = await Promise.all([
        supabase.from('app_settings').select('value').eq('key','app_logo_icon').single(),
        supabase.from('app_settings').select('value').eq('key','hidden_admin_modules').single(),
        supabase.from('profiles').select('*',{count:'exact',head:true}),
        supabase.from('kyc_requests').select('*',{count:'exact',head:true}).eq('status','pending'),
        supabase.from('tickets').select('*',{count:'exact',head:true}).eq('status','open'),
        supabase.from('loans').select('*',{count:'exact',head:true}).eq('status','pending'),
      ]);
      if(lg.data?.value?.url) setLogo(lg.data.value.url);
      if(hd.data?.value){const a=typeof hd.data.value==='string'?JSON.parse(hd.data.value):hd.data.value;if(Array.isArray(a))setHidden(a);}
      setCounts({users:uc.count||0,kyc:kc.count||0,tickets:tc.count||0,loans:lc.count||0});
    } catch(e){console.error(e);}
    finally{setLoading(false);}
  };

  MODS.operations[2].badge = counts.kyc;
  MODS.operations[7].badge = counts.tickets;
  MODS.banking[2].badge    = counts.loans;

  const isSuper = profile?.role==='super_admin';
  const isAdmin = isSuper || profile?.role==='admin';
  const visibleTabs = TABS.filter(t=>!t.sup||isSuper);

  const getItems = (key:keyof typeof MODS) => {
    let items = MODS[key] as any[];
    if(!isSuper) items=items.filter(it=>!hidden.includes(it.r.split('/').pop()?.replace(/-/g,'_')||''));
    if(query.trim()) items=items.filter(it=>it.t.toLowerCase().includes(query.toLowerCase()));
    return items;
  };

  const renderSection = (key:keyof typeof MODS) => {
    const meta  = CAT[key];
    const items = getItems(key);
    if(!items.length) return null;
    const totalBadge = items.reduce((s:number,it:any)=>s+(it.badge||0),0);

    return (
      <View key={key} style={s.section}>
        {/* Section header strip */}
        <LinearGradient colors={[`${meta.c}18`,`${meta.c}06`]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.secHeadGrad}>
          <View style={[s.secHeadDot,{backgroundColor:meta.c}]}/>
          <View style={[s.secHeadIcon,{backgroundColor:meta.b}]}>
            <Ionicons name={meta.icon as any} size={14} color={meta.c}/>
          </View>
          <View style={{flex:1,marginLeft:8}}>
            <Text style={s.secTitle}>{meta.title}</Text>
            <Text style={s.secSub}>{items.length} modules</Text>
          </View>
          {totalBadge>0 && (
            <View style={s.secBadge}>
              <Text style={s.secBadgeText}>{totalBadge}</Text>
            </View>
          )}
        </LinearGradient>

        {/* Grid */}
        <View style={s.grid}>
          {items.map((item:any,i:number)=>{
            const locked=(key==='redZone'||item.r==='/manage/staff'||item.r==='/manage/features')&&!isSuper;
            return (
              <TouchableOpacity
                key={i}
                style={s.modCard}
                activeOpacity={0.72}
                onPress={()=>{
                  if(locked){Alert.alert('Access Restricted 🔒','Only Super Admin can access this.');return;}
                  router.push(item.r);
                }}
              >
                {/* Left color bar */}
                <View style={[s.modBar,{backgroundColor:item.c}]}/>
                <View style={s.modInner}>
                  <View style={[s.modIcon,{backgroundColor:item.b}]}>
                    <Ionicons name={locked?'lock-closed':(item.i as any)} size={15} color={locked?C.red:item.c}/>
                  </View>
                  <Text style={s.modTitle} numberOfLines={1}>{item.t}</Text>
                  <View style={s.modFooter}>
                    {item.badge>0
                      ? <View style={s.redDot}><Text style={s.redDotText}>{item.badge}</Text></View>
                      : item.tag
                      ? <View style={[s.modTag,{backgroundColor:`${item.c}18`,borderColor:`${item.c}40`}]}>
                          <Text style={[s.modTagText,{color:item.c}]}>{item.tag}</Text>
                        </View>
                      : <Text style={s.modOpenText}>Open</Text>
                    }
                    <Ionicons name="chevron-forward" size={10} color={C.muted}/>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const stats = [
    {l:'Total Users',  v:loading?'…':counts.users.toLocaleString(), i:'people',       c:N, b:NL, r:'/manage/users'},
    {l:'Pending KYC',  v:loading?'…':String(counts.kyc),            i:'scan',         c:counts.kyc>0?C.red:N, b:counts.kyc>0?C.redL:NL, r:'/manage/kyc'},
    {l:'Open Tickets', v:loading?'…':String(counts.tickets),        i:'chatbubbles',  c:G, b:GL, r:'/manage/tickets'},
    {l:'Server',       v:'99.9%',                                    i:'server',       c:N, b:NL, r:'/manage/infrastructure'},
  ];

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.navy}/>

      <ScrollView style={{flex:1}} contentContainerStyle={{paddingBottom:100}} showsVerticalScrollIndicator={false} bounces={Platform.OS==='ios'}>

        {/* ── HEADER ── */}
        <LinearGradient colors={[C.navy,C.navyMid]} start={{x:0,y:0}} end={{x:1,y:1}} style={s.header}>
          {/* Subtle orb accents */}
          <View style={s.orb1}/>
          <View style={s.orb2}/>

          {/* Top Row */}
          <View style={s.topRow}>
            <View style={s.brand}>
              <View style={s.logoBox}>
                <Image source={logo?{uri:logo}:require('../../assets/images/logo-icon.png')} style={s.logoImg as any} resizeMode="contain"/>
              </View>
              <View>
                <Text style={s.brandName}>ABU MAFHAL</Text>
                <Text style={s.brandTag}>ADMIN CONTROL CENTRE</Text>
              </View>
            </View>
            <View style={s.topRight}>
              <TouchableOpacity style={s.switchBtn} onPress={()=>router.replace('/(app)/dashboard')} activeOpacity={0.8}>
                <Ionicons name="swap-horizontal" size={12} color={C.gold}/>
                <Text style={s.switchText}>App</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.avatarWrap} onPress={()=>router.push('/manage/profile')} activeOpacity={0.85}>
                <View style={s.avatarRing}>
                  <View style={s.avatarCircle}>
                    {profile?.avatar_url
                      ? <Image source={{uri:profile.avatar_url}} style={s.avatarImg}/>
                      : <Text style={s.avatarInit}>{profile?.full_name?.[0]?.toUpperCase()||'A'}</Text>
                    }
                  </View>
                </View>
                <Animated.View style={[s.onlineDot,{opacity:pulse}]}/>
              </TouchableOpacity>
            </View>
          </View>

          {/* Greeting */}
          <View style={s.greetRow}>
            <Text style={s.greetName}>Welcome back, {profile?.full_name?.split(' ')[0]||'Admin'} 👋</Text>
            <View style={[s.rolePill,isSuper&&s.rolePillGold]}>
              <Text style={[s.rolePillText,isSuper&&{color:C.gold}]}>
                {isSuper?'👑 MASTER KEY':'🛡️ ADMIN'}
              </Text>
            </View>
            <View style={s.statusRow}>
              <Animated.View style={[s.statusDot,{opacity:pulse}]}/>
              <Text style={s.statusText}>All Systems Online · Secured</Text>
            </View>
          </View>

          {/* Search */}
          <View style={s.searchBox}>
            <Ionicons name="search" size={15} color={C.gold}/>
            <TextInput
              placeholder="Search admin modules..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={s.searchInput}
              value={query}
              onChangeText={setQuery}
              selectionColor={C.gold}
              returnKeyType="search"
            />
            {query.length>0
              ? <TouchableOpacity onPress={()=>setQuery('')}><Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.4)"/></TouchableOpacity>
              : <View style={s.kbdHint}><Text style={s.kbdText}>⌘K</Text></View>
            }
          </View>

          {/* Gold bottom trim */}
          <View style={s.headerTrim}/>
        </LinearGradient>

        {/* ── STATS ── */}
        <View style={s.statsSec}>
          <View style={s.statsGrid}>
            {stats.map((sc,i)=>(
              <TouchableOpacity key={i} style={s.statCard} activeOpacity={0.78} onPress={()=>router.push(sc.r as any)}>
                <View style={[s.statIcon,{backgroundColor:sc.b}]}>
                  <Ionicons name={sc.i as any} size={16} color={sc.c}/>
                </View>
                <Text style={[s.statVal,{color:sc.c}]}>{sc.v}</Text>
                <Text style={s.statLbl}>{sc.l}</Text>
                <View style={[s.statProg,{backgroundColor:`${sc.c}15`}]}>
                  <View style={[s.statProgFill,{backgroundColor:sc.c,width:'70%'}]}/>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── QUICK ACTIONS ── */}
        <View style={s.qaSec}>
          <View style={s.rowBtw}>
            <View style={s.blockHead}>
              <View style={s.blockHeadDot}/>
              <Text style={s.blockLabel}>Quick Actions</Text>
            </View>
            <View style={s.goldTag}><Text style={s.goldTagText}>SHORTCUTS</Text></View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.qaScroll}>
            {QUICK.filter(a=>!a.sup||isSuper).map((a,i)=>(
              <TouchableOpacity key={i} style={s.qaCard} activeOpacity={0.75} onPress={()=>router.push(a.r as any)}>
                <View style={[s.qaIcon,{backgroundColor:a.b}]}>
                  <Ionicons name={a.i as any} size={18} color={a.c}/>
                </View>
                <Text style={s.qaLabel}>{a.l}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── TABS ── */}
        <View style={s.tabsSec}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsScroll}>
            {visibleTabs.map(t=>{
              const sel=tab===t.id;
              return (
                <TouchableOpacity key={t.id} onPress={()=>setTab(t.id)} activeOpacity={0.75}
                  style={[s.tabPill,sel&&s.tabPillSel]}>
                  <Ionicons name={t.i as any} size={12} color={sel?C.white:C.sub}/>
                  <Text style={[s.tabText,sel&&s.tabTextSel]}>{t.l}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── MODULE SECTIONS ── */}
        <View style={s.sections}>
          {(tab==='all'||tab==='operations') && renderSection('operations')}
          {(tab==='all'||tab==='banking')    && renderSection('banking')}
          {(tab==='all'||tab==='finance')    && renderSection('finance')}
          {isSuper&&(tab==='all'||tab==='technical')  && renderSection('technical')}
          {(tab==='all'||tab==='internal')   && renderSection('internal')}
          {isSuper&&(tab==='all'||tab==='redZone')    && renderSection('redZone')}
        </View>
      </ScrollView>

      {/* ── BOTTOM DOCK ── */}
      <View style={s.dock}>
        {DOCK.map((d,i)=>(
          <TouchableOpacity key={i} style={s.dockItem} onPress={()=>router.push(d.r as any)} activeOpacity={0.75}>
            <View style={s.dockIconBox}>
              <Ionicons name={d.i as any} size={18} color={C.navy}/>
            </View>
            <Text style={s.dockLabel}>{d.l}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const STAT_W  = (W - 32 - 10) / 2;
const MOD_W   = (W - 32 - 28 - 10) / 2;

const s = StyleSheet.create({
  root: { flex:1, backgroundColor:C.bg },

  // ── Body background with subtle gold tint ─────────────────────────────────

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    paddingTop: Platform.OS==='ios'?54:34,
    paddingHorizontal:16, paddingBottom:22,
    borderBottomLeftRadius:26, borderBottomRightRadius:26,
    overflow:'hidden', position:'relative',
  },
  orb1: {
    position:'absolute',top:-50,right:-40,
    width:200,height:200,borderRadius:100,
    backgroundColor:'rgba(217,119,6,0.12)',   // gold orb
  },
  orb2: {
    position:'absolute',bottom:-30,left:-50,
    width:160,height:160,borderRadius:80,
    backgroundColor:'rgba(245,158,11,0.07)',  // gold orb 2
  },
  headerTrim: {
    position:'absolute',bottom:0,left:0,right:0,
    height:3,borderRadius:2,
    backgroundColor:C.goldMid,  // solid gold trim
  },

  // Top row
  topRow: {flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16},
  brand: {flexDirection:'row',alignItems:'center',gap:9},
  logoBox: {
    width:34,height:34,borderRadius:10,
    backgroundColor:'rgba(255,255,255,0.08)',
    borderWidth:1,borderColor:'rgba(245,158,11,0.35)',
    padding:4,alignItems:'center',justifyContent:'center',
  },
  logoImg: {width:'100%',height:'100%'},
  brandName: {color:C.white,fontSize:13,fontWeight:'900',letterSpacing:0.5},
  brandTag:  {color:'rgba(245,158,11,0.85)',fontSize:8,fontWeight:'800',letterSpacing:1.1,marginTop:1},
  topRight: {flexDirection:'row',alignItems:'center',gap:8},
  switchBtn: {
    flexDirection:'row',alignItems:'center',gap:4,
    paddingHorizontal:9,paddingVertical:5,
    borderRadius:18,backgroundColor:'rgba(245,158,11,0.12)',
    borderWidth:1,borderColor:'rgba(245,158,11,0.3)',
  },
  switchText: {color:C.gold,fontSize:10,fontWeight:'800'},
  avatarWrap: {position:'relative'},
  avatarRing: {
    width:36,height:36,borderRadius:18,
    borderWidth:1.5,borderColor:C.gold,
    padding:2,alignItems:'center',justifyContent:'center',
  },
  avatarCircle: {
    width:'100%',height:'100%',borderRadius:14,
    backgroundColor:C.navyMid,overflow:'hidden',
    alignItems:'center',justifyContent:'center',
  },
  avatarImg: {width:'100%',height:'100%'},
  avatarInit: {color:C.gold,fontSize:14,fontWeight:'900'},
  onlineDot: {
    position:'absolute',bottom:0,right:0,
    width:8,height:8,borderRadius:4,
    backgroundColor:'#22C55E',borderWidth:1.5,borderColor:C.navy,
  },

  // Greeting
  greetRow: {marginBottom:14},
  greetName: {color:C.white,fontSize:17,fontWeight:'800',marginBottom:7},
  rolePill: {
    alignSelf:'flex-start',marginBottom:7,
    paddingHorizontal:9,paddingVertical:3,borderRadius:7,
    backgroundColor:'rgba(255,255,255,0.1)',
    borderWidth:1,borderColor:'rgba(255,255,255,0.12)',
  },
  rolePillGold: {backgroundColor:'rgba(245,158,11,0.18)',borderColor:'rgba(245,158,11,0.4)'},
  rolePillText: {color:'rgba(255,255,255,0.7)',fontSize:10,fontWeight:'800'},
  statusRow: {flexDirection:'row',alignItems:'center',gap:5},
  statusDot: {width:6,height:6,borderRadius:3,backgroundColor:'#22C55E'},
  statusText: {color:'rgba(255,255,255,0.45)',fontSize:10,fontWeight:'500'},

  // Search
  searchBox: {
    flexDirection:'row',alignItems:'center',gap:9,
    backgroundColor:'rgba(255,255,255,0.08)',
    borderRadius:14,paddingHorizontal:13,
    paddingVertical:Platform.OS==='ios'?10:7,
    borderWidth:1,borderColor:'rgba(245,158,11,0.25)',
  },
  searchInput: {flex:1,color:C.white,fontSize:13,fontWeight:'500'},
  kbdHint: {backgroundColor:'rgba(255,255,255,0.1)',paddingHorizontal:5,paddingVertical:2,borderRadius:4},
  kbdText: {color:'rgba(255,255,255,0.4)',fontSize:9,fontWeight:'700'},

  // ── Stats ──────────────────────────────────────────────────────────────────
  statsSec: {paddingHorizontal:16,marginTop:18},
  statsGrid: {flexDirection:'row',flexWrap:'wrap',gap:10},
  statCard: {
    width:STAT_W,backgroundColor:C.white,
    borderRadius:18,padding:12,
    borderWidth:1,borderColor:C.border,
    shadowColor:'#94A3B8',shadowOffset:{width:0,height:2},
    shadowOpacity:0.08,shadowRadius:8,elevation:3,
  },
  statIcon: {width:36,height:36,borderRadius:10,alignItems:'center',justifyContent:'center',marginBottom:8},
  statVal:  {fontSize:20,fontWeight:'900',marginBottom:2},
  statLbl:  {color:C.sub,fontSize:10,fontWeight:'600',marginBottom:8},
  statProg: {height:3,borderRadius:2,overflow:'hidden'},
  statProgFill: {height:'100%',borderRadius:2},

  // ── Quick Actions ──────────────────────────────────────────────────────────
  qaSec: {marginTop:20},
  rowBtw: {flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:16,marginBottom:10},
  blockHead: {flexDirection:'row',alignItems:'center',gap:6},
  blockHeadDot: {width:3,height:14,borderRadius:2,backgroundColor:C.gold},
  blockLabel: {fontSize:13,fontWeight:'900',color:C.text},
  goldTag: {
    backgroundColor:C.goldLight,borderWidth:1,borderColor:C.goldBorder,
    paddingHorizontal:7,paddingVertical:2,borderRadius:6,
  },
  goldTagText: {color:C.gold,fontSize:8,fontWeight:'900'},
  qaScroll: {paddingHorizontal:16,gap:10},
  qaCard: {
    backgroundColor:C.white,borderRadius:16,
    padding:11,alignItems:'center',width:78,
    borderWidth:1,borderColor:C.border,
    shadowColor:'#94A3B8',shadowOffset:{width:0,height:2},
    shadowOpacity:0.06,shadowRadius:6,elevation:2,
  },
  qaIcon: {width:38,height:38,borderRadius:11,alignItems:'center',justifyContent:'center',marginBottom:6},
  qaLabel: {fontSize:9,fontWeight:'800',color:C.text,textAlign:'center'},

  // ── Tabs ───────────────────────────────────────────────────────────────────
  tabsSec: {marginTop:20,paddingLeft:16},
  tabsScroll: {gap:7,paddingRight:16},
  tabPill: {
    flexDirection:'row',alignItems:'center',gap:5,
    paddingHorizontal:11,paddingVertical:7,borderRadius:12,
    backgroundColor:C.white,borderWidth:1,borderColor:C.border,
  },
  tabPillSel: {backgroundColor:C.navy,borderColor:C.navy},
  tabText: {fontSize:11,fontWeight:'700',color:C.sub},
  tabTextSel: {color:C.white},

  // ── Section ────────────────────────────────────────────────────────────────
  sections: {paddingHorizontal:16,marginTop:16,gap:14},
  section: {
    backgroundColor:C.white,borderRadius:20,
    overflow:'hidden',borderWidth:1,borderColor:C.border,
    shadowColor:'#94A3B8',shadowOffset:{width:0,height:3},
    shadowOpacity:0.07,shadowRadius:10,elevation:3,
  },
  secHeadGrad: {
    flexDirection:'row',alignItems:'center',
    paddingHorizontal:12,paddingVertical:10,
    position:'relative',overflow:'hidden',
  },
  secHeadDot: {width:3,height:30,borderRadius:2,marginRight:10},
  secHeadIcon: {
    width:28,height:28,borderRadius:8,
    alignItems:'center',justifyContent:'center',
  },
  secTitle: {color:C.text,fontSize:12,fontWeight:'900'},
  secSub:   {color:C.sub,fontSize:9,fontWeight:'600'},
  secBadge: {
    backgroundColor:C.red,paddingHorizontal:7,paddingVertical:2,
    borderRadius:7,marginLeft:'auto',
  },
  secBadgeText: {color:C.white,fontSize:9,fontWeight:'900'},

  // Grid of module cards
  grid: {
    flexDirection:'row',flexWrap:'wrap',
    padding:10,gap:8,
    borderTopWidth:1,borderTopColor:C.bg,
  },
  modCard: {
    width:MOD_W,backgroundColor:C.white,
    borderRadius:14,overflow:'hidden',
    borderWidth:1,borderColor:C.border,
    flexDirection:'row',minHeight:70,
    shadowColor:'#94A3B8',shadowOffset:{width:0,height:1},
    shadowOpacity:0.05,shadowRadius:4,elevation:1,
  },
  modBar: {width:3},
  modInner: {flex:1,padding:9,justifyContent:'space-between'},
  modIcon: {width:28,height:28,borderRadius:8,alignItems:'center',justifyContent:'center',marginBottom:5},
  modTitle: {fontSize:11,fontWeight:'800',color:C.text,marginBottom:4},
  modFooter: {flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  redDot: {backgroundColor:C.red,paddingHorizontal:5,paddingVertical:1,borderRadius:5},
  redDotText: {color:C.white,fontSize:8,fontWeight:'900'},
  modTag: {paddingHorizontal:4,paddingVertical:1,borderRadius:4,borderWidth:0.5},
  modTagText: {fontSize:8,fontWeight:'900'},
  modOpenText: {color:C.muted,fontSize:9,fontWeight:'500'},

  // ── Dock ───────────────────────────────────────────────────────────────────
  dock: {
    position:'absolute',bottom:12,left:12,right:12,
    backgroundColor:C.white,
    paddingVertical:9,paddingHorizontal:8,
    borderRadius:24,flexDirection:'row',justifyContent:'space-around',
    borderWidth:1.5,borderColor:C.goldBorder,
    shadowColor:'#0F172A',shadowOffset:{width:0,height:5},
    shadowOpacity:0.1,shadowRadius:14,elevation:10,
  },
  dockItem: {alignItems:'center',justifyContent:'center',flex:1,gap:2},
  dockIconBox: {
    width:32,height:32,borderRadius:9,
    backgroundColor:C.goldLight,
    alignItems:'center',justifyContent:'center',
  },
  dockLabel: {fontSize:8,fontWeight:'800',color:C.navy},
});
