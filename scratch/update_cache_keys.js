const fs = require('fs');
const path = require('path');

// 1. Update dashboard.tsx
const dashboardPath = path.join(__dirname, '../app/(app)/dashboard.tsx');
if (fs.existsSync(dashboardPath)) {
    let content = fs.readFileSync(dashboardPath, 'utf8');

    // Update CACHE_KEY version
    content = content.replace("const CACHE_KEY = '@dashboard_data_v1';", "const CACHE_KEY = '@dashboard_data_v2';");

    // Update loadCachedData and saveCache
    const targetLoadSave = `  const loadCachedData = async () => {
    try {
      const cachedStr = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        if (cached.userData) setUserData(cached.userData);
        if (cached.transactions) setTransactions(cached.transactions);
        if (cached.featureFlags) setFeatureFlags(cached.featureFlags);
        if (cached.logoUrl) setLogoUrl(cached.logoUrl);
        setLoading(false); // UI instantly ready!
      }
    } catch (e) {
      console.warn("Cache read error:", e);
    }
  };

  const saveCache = async (data: any) => {
    try {
      const currentCacheStr = await AsyncStorage.getItem(CACHE_KEY);
      const currentCache = currentCacheStr ? JSON.parse(currentCacheStr) : {};
      const newCache = { ...currentCache, ...data };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
    } catch (e) {
      console.warn("Cache write error:", e);
    }
  };`;

    const replacementLoadSave = `  const loadCachedData = async () => {
    try {
      const cachedStr = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        
        // Stale checking (1 hour limit) to avoid displaying old/outdated configuration when offline or slow
        const cacheAgeMs = Date.now() - (cached.updatedAt || 0);
        const IS_CACHE_STALE = cacheAgeMs > 60 * 60 * 1000;
        
        if (cached.userData) setUserData(cached.userData);
        if (cached.transactions) setTransactions(cached.transactions);
        
        if (!IS_CACHE_STALE) {
          if (cached.featureFlags) setFeatureFlags(cached.featureFlags);
          if (cached.logoUrl) setLogoUrl(cached.logoUrl);
        } else {
          console.log("Cached feature flags are stale (older than 1 hour). Skipping cache load for flags.");
        }
        
        setLoading(false); // UI instantly ready!
      }
    } catch (e) {
      console.warn("Cache read error:", e);
    }
  };

  const saveCache = async (data: any) => {
    try {
      const currentCacheStr = await AsyncStorage.getItem(CACHE_KEY);
      const currentCache = currentCacheStr ? JSON.parse(currentCacheStr) : {};
      const newCache = { ...currentCache, ...data, updatedAt: Date.now() };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
    } catch (e) {
      console.warn("Cache write error:", e);
    }
  };`;

    const normContent = content.replace(/\r\n/g, '\n');
    const normTarget = targetLoadSave.replace(/\r\n/g, '\n');
    const normReplacement = replacementLoadSave.replace(/\r\n/g, '\n');

    const index = normContent.indexOf(normTarget);
    if (index !== -1) {
        const updated = normContent.slice(0, index) + normReplacement + normContent.slice(index + normTarget.length);
        fs.writeFileSync(dashboardPath, updated, 'utf8');
        console.log('Successfully updated dashboard.tsx caching logic!');
    } else {
        console.error('Could not find loadCachedData/saveCache target in dashboard.tsx');
    }
} else {
    console.error('dashboard.tsx path not found.');
}

// 2. Update profile.tsx
const profilePath = path.join(__dirname, '../app/(app)/profile.tsx');
if (fs.existsSync(profilePath)) {
    let content = fs.readFileSync(profilePath, 'utf8');

    // Update CACHE_KEY version
    content = content.replace("const CACHE_KEY = '@profile_data_v1';", "const CACHE_KEY = '@profile_data_v2';");

    // Update loadCachedData and saveCache
    const targetLoadSaveProfile = `    const loadCachedData = async () => {
        try {
            const cachedStr = await AsyncStorage.getItem(CACHE_KEY);
            if (cachedStr) {
                const cached = JSON.parse(cachedStr);
                if (cached.profile) setProfile(cached.profile);
                if (cached.txCount !== undefined) setTxCount(cached.txCount);
                if (cached.kycStatus) setKycStatus(cached.kycStatus);
                setLoading(false); // Instantly ready
            }
        } catch (e) {
            console.warn("Cache read error:", e);
        }
    };

    const saveCache = async (data: any) => {
        try {
            const currentCacheStr = await AsyncStorage.getItem(CACHE_KEY);
            const currentCache = currentCacheStr ? JSON.parse(currentCacheStr) : {};
            const newCache = { ...currentCache, ...data };
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
        } catch (e) {
            console.warn("Cache write error:", e);
        }
    };`;

    const replacementLoadSaveProfile = `    const loadCachedData = async () => {
        try {
            const cachedStr = await AsyncStorage.getItem(CACHE_KEY);
            if (cachedStr) {
                const cached = JSON.parse(cachedStr);
                
                // Stale check (1 hour limit)
                const cacheAgeMs = Date.now() - (cached.updatedAt || 0);
                const IS_CACHE_STALE = cacheAgeMs > 60 * 60 * 1000;
                
                if (cached.profile) setProfile(cached.profile);
                if (cached.txCount !== undefined) setTxCount(cached.txCount);
                
                if (!IS_CACHE_STALE) {
                    if (cached.kycStatus) setKycStatus(cached.kycStatus);
                }
                
                setLoading(false); // Instantly ready
            }
        } catch (e) {
            console.warn("Cache read error:", e);
        }
    };

    const saveCache = async (data: any) => {
        try {
            const currentCacheStr = await AsyncStorage.getItem(CACHE_KEY);
            const currentCache = currentCacheStr ? JSON.parse(currentCacheStr) : {};
            const newCache = { ...currentCache, ...data, updatedAt: Date.now() };
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
        } catch (e) {
            console.warn("Cache write error:", e);
        }
    };`;

    const normContent = content.replace(/\r\n/g, '\n');
    const normTarget = targetLoadSaveProfile.replace(/\r\n/g, '\n');
    const normReplacement = replacementLoadSaveProfile.replace(/\r\n/g, '\n');

    const index = normContent.indexOf(normTarget);
    if (index !== -1) {
        const updated = normContent.slice(0, index) + normReplacement + normContent.slice(index + normTarget.length);
        fs.writeFileSync(profilePath, updated, 'utf8');
        console.log('Successfully updated profile.tsx caching logic!');
    } else {
        console.error('Could not find loadCachedData/saveCache target in profile.tsx');
    }
} else {
    console.error('profile.tsx path not found.');
}
