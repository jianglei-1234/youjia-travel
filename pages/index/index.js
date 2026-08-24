/**
 * 游佳记 · 主页逻辑 v3（去除天气功能）
 * 功能：添加/编辑/删除行程、打卡、照片、重要标记、颜色主题
 *       富文本备注、搜索、倒计时、GPS打卡、一键清空、好友邀请
 */

const { COLOR_THEMES, getTheme } = require('../../utils/constants');

Page({
  data: {
    trips: [],
    filter: 'all',
    searchKeyword: '',
    showSearch: false,
    totalCount: 0,
    checkedCount: 0,
    progressPct: 0,
    displayList: [],
    dateGroups: [],
    emptyTitle: '还没有行程',

    // 弹层控制
    showAdd: false,
    showEdit: false,
    showPhoto: false,
    showInvite: false,

    // 表单（新增/编辑共用）
    form: {
      location: '', date: '', time: '', notes: '',
      colorId: 'green', isImportant: false,
    },
    editId: null,

    // 颜色主题列表
    colorThemes: COLOR_THEMES,

    // 打卡
    pendingCheckId: null,
    currentSwipeId: null,

    // Toast
    toastShow: false, toastText: '',

    // 邀请码
    inviteCode: '',
  },

  /* ══════════════════════════════════
     生命周期
  ══════════════════════════════════ */
  onLoad() {
    this.loadData();
    this.renderAll();
  },

  onShow() {
    this.renderAll();
  },

  /* ══════════════════════════════════
     持久化
  ══════════════════════════════════ */
  loadData() {
    try {
      const raw = wx.getStorageSync('travel_trips');
      const arr = raw ? JSON.parse(raw) : [];
      this.data.trips = arr.map(t => {
        if (t.photo && !t.photos) t.photos = [t.photo];
        if (!t.photos) t.photos = [];
        if (!t.colorId) t.colorId = 'green';
        delete t.photo;
        return { ...t, _swipeX: 0 };
      });
    } catch {
      this.data.trips = [];
    }
  },

  saveData() {
    try {
      const clean = this.data.trips.map(t => {
        const { _swipeX, countdownClass, countdownText, colorStyle, colorBar, colorBg, colorText, ...rest } = t;
        return rest;
      });
      wx.setStorageSync('travel_trips', JSON.stringify(clean));
    } catch {
      wx.showToast({ title: '存储空间不足', icon: 'none' });
    }
  },

  /* ══════════════════════════════════
     渲染总控
  ══════════════════════════════════ */
  renderAll() {
    const trips  = this.data.trips;
    const filter = this.data.filter;
    const kw     = (this.data.searchKeyword || '').trim().toLowerCase();

    const total   = trips.length;
    const checked = trips.filter(t => t.checked).length;
    const pct     = total ? Math.round(checked / total * 100) : 0;

    // 先搜索过滤
    let filtered = trips;
    if (kw) filtered = trips.filter(t =>
      t.location.toLowerCase().includes(kw) ||
      (t.notes || '').toLowerCase().includes(kw)
    );

    // 再状态筛选
    if (filter === 'unchecked')  filtered = filtered.filter(t => !t.checked);
    else if (filter === 'checked') filtered = filtered.filter(t => t.checked);
    else if (filter === 'important') filtered = filtered.filter(t => t.isImportant);

    const sorted = this.smartSort(filtered);
    // 注入倒计时 & 颜色样式
    sorted.forEach(t => {
      this.injectCountdown(t);
      this.injectColorStyle(t);
    });
    const groups = this.groupByDate(sorted);

    let emptyTitle = kw ? '没有匹配的行程' : '还没有行程';
    if (!kw && filter === 'unchecked')  emptyTitle = '暂无未打卡行程 🎉';
    if (!kw && filter === 'checked')    emptyTitle = '还没有已打卡的行程';
    if (!kw && filter === 'important')  emptyTitle = '还没有标记重要的行程';

    this.setData({
      totalCount: total,
      checkedCount: checked,
      progressPct: pct,
      displayList: sorted,
      dateGroups: groups,
      emptyTitle,
    });
  },

  /* ══════════════════════════════════
     排序 & 分组
  ══════════════════════════════════ */
  smartSort(arr) {
    return [...arr].sort((a, b) => {
      if (a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1;
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      return (a.time || '00:00') < (b.time || '00:00') ? -1 : 1;
    });
  },

  groupByDate(arr) {
    const map = {};
    for (const t of arr) (map[t.date] ??= []).push(t);
    return Object.entries(map)
      .sort(([a], [b]) => a < b ? -1 : 1)
      .map(([date, trips]) => ({
        date,
        fmtDate:  this.fmtDate(date),
        weekday:  this.getWeekday(date),
        isToday:  date === this.todayStr(),
        isExpired: date < this.todayStr(),
        trips,
      }));
  },

  /* ══════════════════════════════════
     日期工具
  ══════════════════════════════════ */
  todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${this.pad(d.getMonth()+1)}-${this.pad(d.getDate())}`;
  },
  pad(n) { return String(n).padStart(2,'0'); },
  fmtDate(s) { const [y,m,d] = s.split('-'); return `${y}.${m}.${d}`; },
  getWeekday(s) {
    return ['周日','周一','周二','周三','周四','周五','周六'][new Date(s+'T00:00:00').getDay()];
  },
  daysFrom(s) {
    const today = new Date(this.todayStr()+'T00:00:00');
    const d     = new Date(s+'T00:00:00');
    return Math.round((d - today) / 86400000);
  },

  /* ══════════════════════════════════
     倒计时标签
  ══════════════════════════════════ */
  injectCountdown(trip) {
    const n = this.daysFrom(trip.date);
    if (n < 0)       { trip.countdownClass='tag-expired';   trip.countdownText='已过期'; }
    else if (n===0)  { trip.countdownClass='tag-today';     trip.countdownText='今天出发 🎉'; }
    else if (n===1)  { trip.countdownClass='tag-countdown'; trip.countdownText='⏳ 明天出发'; }
    else             { trip.countdownClass='tag-countdown'; trip.countdownText=`⏳ 还剩 ${n} 天`; }
  },

  /* ══════════════════════════════════
     颜色样式注入
  ══════════════════════════════════ */
  injectColorStyle(trip) {
    const theme = getTheme(trip.colorId);
    trip.colorBar  = theme.bar;
    trip.colorBg   = theme.bg;
    trip.colorText = theme.text;
  },

  /* ══════════════════════════════════
     事件：筛选 Tab
  ══════════════════════════════════ */
  onFilter(e) {
    const f = e.currentTarget.dataset.filter;
    this.setData({ filter: f });
    this.renderAll();
    wx.vibrateShort({ type: 'light' });
  },

  /* ══════════════════════════════════
     事件：搜索
  ══════════════════════════════════ */
  onToggleSearch() {
    const show = !this.data.showSearch;
    this.setData({ showSearch: show, searchKeyword: show ? this.data.searchKeyword : '' });
    if (!show) this.renderAll();
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
    this.renderAll();
  },

  onSearchClear() {
    this.setData({ searchKeyword: '' });
    this.renderAll();
  },

  /* ══════════════════════════════════
     事件：新增行程弹层
  ══════════════════════════════════ */
  onOpenAdd() {
    this.setData({
      showAdd: true,
      editId: null,
      form: {
        location: '', date: this.todayStr(), time: '',
        notes: '', colorId: 'green', isImportant: false,
      },
    });
  },
  onCloseAdd() { this.setData({ showAdd: false }); },

  /* ══════════════════════════════════
     事件：编辑行程
  ══════════════════════════════════ */
  onEditTrip(e) {
    const id = e.currentTarget.dataset.id;
    const trip = this.data.trips.find(t => t.id === id);
    if (!trip) return;
    this.setData({
      showEdit: true,
      editId: id,
      form: {
        location:    trip.location,
        date:        trip.date,
        time:        trip.time || '',
        notes:       trip.notes || '',
        colorId:     trip.colorId || 'green',
        isImportant: trip.isImportant || false,
      },
    });
  },
  onCloseEdit() { this.setData({ showEdit: false, editId: null }); },

  /* ══════════════════════════════════
     颜色选择
  ══════════════════════════════════ */
  onPickColor(e) {
    this.setData({ 'form.colorId': e.currentTarget.dataset.id });
  },

  /* ══════════════════════════════════
     重要标记切换
  ══════════════════════════════════ */
  onToggleImportant() {
    this.setData({ 'form.isImportant': !this.data.form.isImportant });
  },

  onToggleImportantDirect(e) {
    const id = e.currentTarget.dataset.id;
    const trips = this.data.trips.map(t =>
      t.id === id ? { ...t, isImportant: !t.isImportant } : t
    );
    this.data.trips = trips;
    this.saveData();
    this.renderAll();
    wx.vibrateShort({ type: 'light' });
  },

  /* ══════════════════════════════════
     表单输入
  ══════════════════════════════════ */
  onInputLocation(e) { this.setData({ 'form.location': e.detail.value }); },
  onInputNotes(e)    { this.setData({ 'form.notes':    e.detail.value }); },
  onPickDate(e)      { this.setData({ 'form.date':     e.detail.value }); },
  onPickTime(e)      { this.setData({ 'form.time':     e.detail.value }); },

  /* ══════════════════════════════════
     事件：保存新行程
  ══════════════════════════════════ */
  onSaveTrip() {
    const { location, date } = this.data.form;
    if (!location.trim()) { wx.showToast({ title:'请输入地点名称', icon:'none' }); return; }
    if (!date)            { wx.showToast({ title:'请选择日期',     icon:'none' }); return; }

    const trip = {
      id:          Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      location:    location.trim(),
      date,
      time:        this.data.form.time,
      notes:       this.data.form.notes.trim(),
      colorId:     this.data.form.colorId || 'green',
      isImportant: this.data.form.isImportant || false,
      checked:     false,
      photos:      [],
      checkedAt:   null,
      createdAt:   Date.now(),
    };

    this.data.trips = [trip, ...this.data.trips];
    this.setData({ showAdd: false });
    this.saveData();
    this.renderAll();
    this.showToast('行程已添加 ✅');
  },

  /* ══════════════════════════════════
     事件：保存编辑
  ══════════════════════════════════ */
  onSaveEdit() {
    const id = this.data.editId;
    if (!id) return;
    const { location, date } = this.data.form;
    if (!location.trim()) { wx.showToast({ title:'请输入地点名称', icon:'none' }); return; }
    if (!date)            { wx.showToast({ title:'请选择日期',     icon:'none' }); return; }

    this.data.trips = this.data.trips.map(t =>
      t.id === id ? {
        ...t,
        location:    location.trim(),
        date,
        time:        this.data.form.time,
        notes:       this.data.form.notes.trim(),
        colorId:     this.data.form.colorId || 'green',
        isImportant: this.data.form.isImportant || false,
      } : t
    );
    this.setData({ showEdit: false, editId: null });
    this.saveData();
    this.renderAll();
    this.showToast('修改已保存 ✅');
  },

  /* ══════════════════════════════════
     一键清空已打卡行程
  ══════════════════════════════════ */
  onClearChecked() {
    const checkedCount = this.data.trips.filter(t => t.checked).length;
    if (checkedCount === 0) { this.showToast('没有已打卡的行程'); return; }
    wx.showModal({
      title: '清空已打卡行程',
      content: `确定删除全部 ${checkedCount} 条已打卡行程？此操作不可撤销。`,
      confirmColor: '#fa5151',
      success: (res) => {
        if (res.confirm) {
          this.data.trips = this.data.trips.filter(t => !t.checked);
          this.saveData();
          this.renderAll();
          this.showToast(`已清空 ${checkedCount} 条行程`);
        }
      },
    });
  },

  /* ══════════════════════════════════
     事件：打卡（点击复选框）
  ══════════════════════════════════ */
  onCheckTap(e) {
    const id = e.currentTarget.dataset.id;
    const trip = this.data.trips.find(t => t.id === id);
    if (!trip) return;

    if (trip.checked) {
      // 取消打卡
      this.data.trips = this.data.trips.map(t =>
        t.id === id ? { ...t, checked: false, checkedAt: null } : t
      );
      this.saveData();
      this.renderAll();
      this.showToast('已取消打卡');
    } else {
      // 弹出拍照选项
      this.setData({ showPhoto: true, pendingCheckId: id });
    }
  },

  /* ══════════════════════════════════
     事件：拍照 / 相册
  ══════════════════════════════════ */
  onTakePhoto() {
    this.setData({ showPhoto: false });
    wx.chooseMedia({
      count: 50, mediaType: ['image'], sourceType: ['camera'], sizeType: ['compressed'],
      success: (res) => this.doPhotoCheckIn(res.tempFiles.map(f => f.tempFilePath)),
      fail: () => {
        wx.chooseMedia({
          count: 50, mediaType: ['image'], sourceType: ['album'], sizeType: ['compressed'],
          success: (r) => this.doPhotoCheckIn(r.tempFiles.map(f => f.tempFilePath)),
          fail: () => this.doCheckInOnly(this.data.pendingCheckId),
        });
      },
    });
  },

  onChoosePhoto() {
    this.setData({ showPhoto: false });
    wx.chooseMedia({
      count: 50, mediaType: ['image'], sourceType: ['album'], sizeType: ['compressed'],
      success: (res) => this.doPhotoCheckIn(res.tempFiles.map(f => f.tempFilePath)),
      fail: () => this.doCheckInOnly(this.data.pendingCheckId),
    });
  },

  onSkipPhoto() {
    const id = this.data.pendingCheckId;
    this.setData({ showPhoto: false, pendingCheckId: null });
    if (id) this.doCheckInOnly(id);
  },

  doPhotoCheckIn(tempPaths) {
    const id = this.data.pendingCheckId;
    this.setData({ pendingCheckId: null });
    if (!id || !tempPaths || tempPaths.length === 0) return;

    const fs = wx.getFileSystemManager();
    const photos = [];
    for (const p of tempPaths) {
      try { photos.push('data:image/jpeg;base64,' + fs.readFileSync(p, 'base64')); } catch {}
    }

    this.data.trips = this.data.trips.map(t =>
      t.id === id ? { ...t, checked: true, checkedAt: Date.now(), photos: [...(t.photos||[]), ...photos] } : t
    );
    this.saveData();
    this.renderAll();
    this.showToast(`打卡成功 📸 +${photos.length} 张`);
  },

  doCheckInOnly(id) {
    if (!id) return;
    this.data.trips = this.data.trips.map(t =>
      t.id === id ? { ...t, checked: true, checkedAt: Date.now() } : t
    );
    this.saveData();
    this.renderAll();
    this.showToast('打卡成功 ✅');
  },

  /* ══════════════════════════════════
     GPS 打卡（保留，但去掉 geocode 依赖，直接用坐标记录）
  ══════════════════════════════════ */
  onGPSCheckIn(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '定位中…' });
    wx.getLocation({
      type: 'gcj02',
      success: (locRes) => {
        wx.hideLoading();
        const { latitude: lat, longitude: lon } = locRes;
        wx.showModal({
          title: '📍 GPS 打卡',
          content: `当前坐标：${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          showCancel: false,
          confirmText: '确认打卡',
          success: () => {
            this.data.trips = this.data.trips.map(t =>
              t.id === id ? { ...t, checked: true, checkedAt: Date.now(), gpsLat: lat, gpsLon: lon } : t
            );
            this.saveData();
            this.renderAll();
            this.showToast('📍 GPS 打卡成功');
          },
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '获取位置失败，请授权', icon: 'none' });
      },
    });
  },

  /* ══════════════════════════════════
     事件：删除
  ══════════════════════════════════ */
  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个行程吗？',
      confirmColor: '#fa5151',
      success: (res) => {
        if (res.confirm) {
          this.data.trips = this.data.trips.filter(t => t.id !== id);
          this.saveData();
          this.renderAll();
          this.showToast('已删除');
        }
      },
    });
  },

  /* ══════════════════════════════════
     滑动删除
  ══════════════════════════════════ */
  onTouchStart(e) {
    this._ts = { id: e.currentTarget.dataset.id, x0: e.touches[0].clientX, y0: e.touches[0].clientY, lock: null };
  },
  onTouchMove(e) {
    const ts = this._ts; if (!ts) return;
    const dx = e.touches[0].clientX - ts.x0;
    const dy = e.touches[0].clientY - ts.y0;
    if (!ts.lock) ts.lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    if (ts.lock !== 'h') return;
    this.updateSwipeX(ts.id, Math.max(-160, Math.min(0, dx)));
  },
  onTouchEnd() {
    const ts = this._ts; if (!ts) return;
    const trip = this.data.trips.find(t => t.id === ts.id);
    const x = trip ? (trip._swipeX || 0) : 0;
    if (x < -100) {
      this.updateSwipeX(ts.id, -160);
      setTimeout(() => this.onDelete({ currentTarget: { dataset: { id: ts.id } } }), 200);
    } else {
      this.updateSwipeX(ts.id, 0);
    }
    this._ts = null;
  },
  updateSwipeX(id, x) {
    const trips = this.data.trips.map(t => t.id === id ? { ...t, _swipeX: x } : t);
    this.setData({ trips, currentSwipeId: x < -20 ? id : null });
  },

  /* ══════════════════════════════════
     跳转详情页
  ══════════════════════════════════ */
  onGoDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  /* ══════════════════════════════════
     事件：预览照片
  ══════════════════════════════════ */
  onPreviewPhoto(e) {
    const id  = e.currentTarget.dataset.id;
    const idx = parseInt(e.currentTarget.dataset.index) || 0;
    const trip = this.data.trips.find(t => t.id === id);
    if (trip && trip.photos && trip.photos.length > 0) {
      wx.previewImage({ urls: trip.photos, current: trip.photos[idx] });
    }
  },

  /* ══════════════════════════════════
     好友邀请 / 多人同行
  ══════════════════════════════════ */
  onOpenInvite() {
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    this.setData({ showInvite: true, inviteCode: code });
  },
  onCloseInvite() { this.setData({ showInvite: false }); },

  onCopyInviteCode() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => this.showToast('邀请码已复制 🎉'),
    });
  },

  /* ══════════════════════════════════
     分享（配合 open-type="share" 按钮）
  ══════════════════════════════════ */
  onShareAppMessage() {
    return {
      title: '游佳记 · 记录每一次旅行的美好',
      path: '/pages/index/index',
      imageUrl: ''
    };
  },

  /* ══════════════════════════════════
     noop（阻止事件冒泡，用于弹层内容区 catchtap）
  ══════════════════════════════════ */
  noop() {},

  /* ══════════════════════════════════
     Toast
  ══════════════════════════════════ */
  _toastTimer: null,
  showToast(text) {
    clearTimeout(this._toastTimer);
    this.setData({ toastShow: true, toastText: text });
    this._toastTimer = setTimeout(() => this.setData({ toastShow: false }), 2200);
  },

});
