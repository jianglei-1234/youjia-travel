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
    const monthData = Object.entries(monthMap).map(([m, v]) => ({
      month: `${m}月`,
      total: v.total,
      checked: v.checked,
      barHeight: total > 0 ? Math.max(4, Math.round(v.total / Math.max(...Object.values(monthMap).map(x=>x.total),1) * 160)) : 4,
    }));

    // 热门地点 Top5
    const locMap = {};
    trips.forEach(t => {
      const key = t.location;
      locMap[key] = (locMap[key]||0) + 1;
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

  onShareSummary() {
    wx.showShareMenu({ withShareTicket: true });
  },
});
