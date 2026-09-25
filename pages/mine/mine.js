// pages/mine/mine.js
const { PROVINCE_MAP } = require('../../utils/constants');

Page({
  data: {
    userInfo: null,
    hasLogin: false,
    stats: {},
    streak: 0,
    cityCount: 0,
    provinceCount: 0,
    achievements: [],
    dataSize: '0 KB',
    showClearDialog: false,
    showAbout: false
  },

  onShow() {
    this.loadStats();
  },

  onLoad() {
    // 尝试读取缓存的用户信息
    try {
      const cached = wx.getStorageSync('userInfo');
      if (cached) {
        this.setData({ userInfo: cached, hasLogin: true });
      }
    } catch (e) {}
    this.loadStats();
  },

  loadStats() {
    try {
      const rawData = wx.getStorageSync('travel_trips');
      const trips = rawData ? JSON.parse(rawData) : [];
      const checked = trips.filter(t => t.checked);
      const photos = trips.reduce((sum, t) => sum + (t.photos ? t.photos.length : 0), 0);
      const important = trips.filter(t => t.isImportant).length;

      // 城市/省份统计
      const cities = new Set();
      const provinces = new Set();

      trips.forEach(t => {
        if (t.checked && t.location) {
          // 尝试匹配城市
          for (let c in PROVINCE_MAP) {
            if (t.location.includes(c)) {
              cities.add(c);
              provinces.add(PROVINCE_MAP[c]);
              break;
            }
          }
        }
      });

      // 连续打卡天数（【优化 2026-09-25】最近一次打卡必须是今天才计连续，否则视为已中断）
      const dates = [...new Set(checked.map(t => t.date).filter(Boolean))].sort((a, b) => b.localeCompare(a));
      const now = new Date();
      const pad2 = n => String(n).padStart(2, '0');
      const todayStr = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}`;
      let streak = 0;
      if (dates.length > 0 && dates[0] === todayStr) {
        streak = 1;
        for (let i = 1; i < dates.length; i++) {
          const d1 = new Date(dates[i-1]);
          const d2 = new Date(dates[i]);
          const diff = (d1 - d2) / (1000 * 60 * 60 * 24);
          if (diff === 1) streak++;
          else break;
        }
      }

      // 成就
      const achievements = [];
      if (trips.length >= 1) achievements.push({ icon: '🚀', title: '初次出行', desc: '创建了第一个行程', unlocked: true });
      if (trips.length >= 10) achievements.push({ icon: '🌟', title: '旅行达人', desc: '累计创建10个行程', unlocked: trips.length >= 10 });
      if (checked.length >= 5) achievements.push({ icon: '✅', title: '打卡积极分子', desc: '完成5次打卡', unlocked: checked.length >= 5 });
      if (streak >= 7) achievements.push({ icon: '🔥', title: '周游不停', desc: '连续7天打卡', unlocked: streak >= 7 });
      if (cities.size >= 5) achievements.push({ icon: '🏙️', title: '城市猎人', desc: '涉足5座城市', unlocked: cities.size >= 5 });
      if (photos >= 50) achievements.push({ icon: '📸', title: '摄影师', desc: '累计拍摄50张照片', unlocked: true });
      if (important >= 10) achievements.push({ icon: '💎', title: '收藏家', desc: '标记10个重要行程', unlocked: true });
      if (provinces.size >= 3) achievements.push({ icon: '🏆', title: '走遍三省', desc: '涉足3个以上省份', unlocked: provinces.size >= 3 });

      // 数据占用（【优化 2026-09-25】优先读取官方 storage 实际占用（KB），拿不到再按字符串长度估算）
      let size;
      try {
        size = wx.getStorageInfoSync().currentSize + ' KB';
      } catch (err) {
        const raw = JSON.stringify(trips);
        size = raw.length > 1024 ? (raw.length / 1024).toFixed(1) + ' KB' : raw.length + ' B';
      }

      this.setData({
        stats: {
          total: trips.length,
          checked: checked.length,
          photos,
          important,
          rate: trips.length > 0 ? Math.round(checked.length / trips.length * 100) : 0
        },
        streak,
        cityCount: cities.size,
        provinceCount: provinces.size,
        achievements,
        dataSize: size
      });
    } catch (e) {
      wx.showToast({ title: '加载统计数据失败', icon: 'none' });
    }
  },

  // 【优化 2026-09-25】open-type="getUserInfo" 已被微信废弃，
  // 改用新版头像/昵称填写能力：头像 open-type="chooseAvatar"，昵称 input type="nickname"
  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl;
    if (!avatarUrl) return;
    const info = { ...(this.data.userInfo || {}), avatarUrl };
    this.setData({ userInfo: info, hasLogin: true });
    wx.setStorageSync('userInfo', info);
  },

  onNicknameInput(e) {
    const nickName = (e.detail.value || '').trim();
    if (!nickName) return;
    const info = { ...(this.data.userInfo || {}), nickName };
    this.setData({ userInfo: info, hasLogin: true });
    wx.setStorageSync('userInfo', info);
  },

  // 清空所有数据
  showClearConfirm() {
    wx.showModal({
      title: '⚠️ 危险操作',
      content: '确定要清空所有行程数据吗？此操作不可恢复！',
      confirmColor: '#ff4444',
      success: (res) => {
        if (res.confirm) {
          wx.showModal({
            title: '再次确认',
            content: '真的所有行程和照片都会被删除哦',
            confirmColor: '#ff4444',
            success: (r2) => {
              if (r2.confirm) {
                wx.removeStorageSync('travel_trips');
                wx.showToast({ title: '已清空', icon: 'success' });
                this.loadStats();
              }
            }
          });
        }
      }
    });
  },

  // 显示关于
  toggleAbout() {
    this.setData({ showAbout: !this.data.showAbout });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '游佳记 · 记录每一次旅行的美好',
      path: '/pages/index/index'
    };
  },

  // 导出数据
  exportData() {
    const raw = wx.getStorageSync('travel_trips');
    const trips = raw ? JSON.parse(raw) : [];
    if (trips.length === 0) {
      wx.showToast({ title: '暂无数据可导出', icon: 'none' });
      return;
    }
    const exportObj = {
      exportTime: new Date().toISOString(),
      stats: this.data.stats,
      trips: trips.map(t => ({
        location: t.location,
        date: t.date,
        time: t.time,
        note: t.notes,
        checked: t.checked,
        important: t.isImportant,
        color: t.colorId,
        photoCount: (t.photos || []).length
      }))
    };
    wx.setClipboardData({
      data: JSON.stringify(exportObj, null, 2),
      success: () => {
        wx.showToast({ title: '已复制到剪贴板（不含照片）', icon: 'none', duration: 2500 });
      }
    });
  }
});
