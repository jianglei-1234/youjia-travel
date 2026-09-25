/**
 * 旅行总结页 JS（年度回顾）
 */
Page({
  data: {
    currentYear: new Date().getFullYear(),
    yearList: [],
    selectedYear: new Date().getFullYear(),
    stats: null,
    monthData: [],
    topLocations: [],
    allYears: [],
  },

  onLoad() {
    this.buildStats();
  },

  onShow() {
    this.buildStats();
  },

  buildStats() {
    try {
      const raw  = wx.getStorageSync('travel_trips');
      const all  = raw ? JSON.parse(raw) : [];

      // 所有出现过的年份
      const yearSet = new Set(all.filter(t => t.date).map(t => t.date.split('-')[0]));
      const currentYStr = String(this.data.selectedYear);
      if (yearSet.size > 0 && !yearSet.has(currentYStr)) {
        yearSet.add(currentYStr);
      }
      const allYears = [...yearSet].sort((a,b) => b - a);

      this.computeStats(all, this.data.selectedYear, allYears);
    } catch {
      this.setData({ stats: null });
    }
  },

  computeStats(all, year, allYears) {
    const trips = all.filter(t => t.date && t.date.startsWith(String(year)));
    const total    = trips.length;
    const checked  = trips.filter(t => t.checked).length;
    const photos   = trips.reduce((s,t) => s + (t.photos ? t.photos.length : 0), 0);
    const important= trips.filter(t => t.isImportant).length;

    // 月度数据
    const monthMap = {};
    for (let m = 1; m <= 12; m++) monthMap[m] = { total:0, checked:0 };
    trips.forEach(t => {
      const m = parseInt(t.date.split('-')[1]);
      if (m >= 1 && m <= 12) {
        monthMap[m].total++;
        if (t.checked) monthMap[m].checked++;
      }
    });
    // 【优化 2026-09-25】柱状图区分 总数(浅色) 与 已打卡(深色)，逐月可见完成情况
    const maxTotal = Math.max(...Object.values(monthMap).map(x => x.total), 1);
    const monthData = Object.entries(monthMap).map(([m, v]) => ({
      month: `${m}月`,
      total: v.total,
      checked: v.checked,
      barHeight: v.total > 0 ? Math.max(4, Math.round(v.total / maxTotal * 160)) : 4,
      checkedHeight: v.checked > 0 ? Math.max(4, Math.round(v.checked / maxTotal * 160)) : 0,
    }));

    // 热门地点 Top5（【优化 2026-09-25】写法归一化：去掉常见行政区划后缀，
    // 并把互为前缀的名称合并到较短的写法上，如"故宫/故宫博物院"计为一处）
    const locMap = {};
    trips.forEach(t => {
      const key = (t.location || '').trim().replace(/(市|县|区|自治州)$/, '');
      if (!key) return;
      const existing = Object.keys(locMap).find(k => k !== key && (k.startsWith(key) || key.startsWith(k)));
      if (existing) {
        const short = existing.length <= key.length ? existing : key;
        locMap[short] = locMap[existing] + 1;
        if (short !== existing) delete locMap[existing];
      } else {
        locMap[key] = (locMap[key] || 0) + 1;
      }
    });
    const topLocations = Object.entries(locMap)
      .sort((a,b) => b[1]-a[1])
      .slice(0,5)
      .map(([loc, cnt]) => ({ loc, cnt }));

    // 连续打卡最多天
    const checkedDates = [...new Set(trips.filter(t=>t.checked).map(t=>t.date))].sort();
    let maxStreak = 0, streak = 0, prevDate = null;
    checkedDates.forEach(d => {
      if (prevDate) {
        const diff = (new Date(d+'T00:00:00') - new Date(prevDate+'T00:00:00')) / 86400000;
        streak = diff === 1 ? streak + 1 : 1;
      } else { streak = 1; }
      if (streak > maxStreak) maxStreak = streak;
      prevDate = d;
    });

    this.setData({
      allYears,
      selectedYear: year,
      stats: { total, checked, photos, important, pct: total ? Math.round(checked/total*100) : 0, streak: maxStreak },
      monthData,
      topLocations,
    });
  },

  onSwitchYear(e) {
    const year = parseInt(e.currentTarget.dataset.year);
    const raw  = wx.getStorageSync('travel_trips') || '[]';
    const all  = JSON.parse(raw);
    this.computeStats(all, year, this.data.allYears);
  },

  // 【优化 2026-09-25】原 onShareSummary 只是无效的 showShareMenu 调用，
  // 改为真正的分享回调：配合页面底部 open-type="share" 按钮和右上角胶囊
  onShareAppMessage() {
    const s = this.data.stats || {};
    return {
      title: `我的${this.data.selectedYear}年旅行报告：${s.total || 0} 个行程，${s.checked || 0} 次打卡`,
      path: '/pages/index/index',
    };
  },
});
