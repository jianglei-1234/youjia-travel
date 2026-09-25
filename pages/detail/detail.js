/**
 * 行程详情页 JS
 */
const { getTheme } = require('../../utils/constants');

Page({
  data: {
    trip: null,
    colorBar: '#07c160',
    colorBg: '#edfbf4',
    colorText: '#07c160',
    checkedAtFmt: '',
    showShare: false,
  },

  onLoad(options) {
    const id = options.id;
    const trips = this.loadTrips();
    const trip = trips.find(t => t.id === id);
    if (!trip) {
      // 【优化 2026-09-25】行程不存在（数据损坏或已被删）时给出提示，不再无声返回
      wx.showToast({ title: '行程不存在或已删除', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }

    const theme = getTheme(trip.colorId);
    const checkedAtFmt = trip.checkedAt
      ? this.fmtTime(trip.checkedAt)
      : '';

    this.setData({
      trip,
      colorBar:  theme.bar,
      colorBg:   theme.bg,
      colorText: theme.text,
      checkedAtFmt,
    });

    // 更新导航栏标题
    wx.setNavigationBarTitle({ title: trip.location });
  },

  loadTrips() {
    try {
      const raw = wx.getStorageSync('travel_trips');
      const arr = raw ? JSON.parse(raw) : [];
      // 【优化 2026-09-25】增加数据格式校验，storage 损坏时返回空数组而不是抛错
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  },

  fmtTime(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  onPreviewPhoto(e) {
    const idx  = parseInt(e.currentTarget.dataset.index) || 0;
    const urls = this.data.trip.photos || [];
    if (urls.length > 0) wx.previewImage({ urls, current: urls[idx] });
  },

  // 【优化 2026-09-25】胶囊右上角分享：详情页此前未声明该方法，导致分享按钮置灰
  onShareAppMessage() {
    const { trip } = this.data;
    return {
      title: trip ? `我在游佳记记录了「${trip.location}」` : '游佳记 · 记录每一次旅行的美好',
      path: trip ? `/pages/detail/detail?id=${trip.id}` : '/pages/index/index',
    };
  },

  // 【优化 2026-09-25】新增详情页编辑入口：回主页并打开编辑弹层（复用主页的 onEditTrip）
  onEdit() {
    const pages = getCurrentPages();
    const prev = pages[pages.length - 2];
    if (prev && prev.onEditTrip) {
      prev.onEditTrip({ currentTarget: { dataset: { id: this.data.trip.id } } });
      wx.navigateBack();
    } else {
      wx.showToast({ title: '请从主页进入后编辑', icon: 'none' });
    }
  },

  onBack() {
    wx.navigateBack();
  },

  onDelete() {
    const { trip } = this.data;
    wx.showModal({
      title: '确认删除',
      content: `确定删除「${trip.location}」行程吗？`,
      confirmColor: '#fa5151',
      success: (res) => {
        if (res.confirm) {
          try {
            const raw  = wx.getStorageSync('travel_trips');
            const arr  = raw ? JSON.parse(raw) : [];
            const next = arr.filter(t => t.id !== trip.id);
            wx.setStorageSync('travel_trips', JSON.stringify(next));
            wx.showToast({ title:'已删除', icon:'none' });
            // 【优化 2026-09-25】等待 toast 播完（默认 1500ms）再返回，避免提示被截断
            setTimeout(() => wx.navigateBack(), 1500);
          } catch {}
        }
      },
    });
  },
});
