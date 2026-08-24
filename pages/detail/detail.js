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
    if (!trip) { wx.navigateBack(); return; }

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
      return raw ? JSON.parse(raw) : [];
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

  onShareDetail() {
    wx.showShareMenu({ withShareTicket: true });
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
            setTimeout(() => wx.navigateBack(), 800);
          } catch {}
        }
      },
    });
  },
});
