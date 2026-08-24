// pages/album/album.js
Page({
  data: {
    albums: [],
    groupedByDate: [],
    totalPhotos: 0,
    totalTrips: 0,
    viewMode: 'grid' // grid | list
  },

  onShow() {
    this.loadAlbums();
  },

  loadAlbums() {
    try {
      const raw = wx.getStorageSync('travel_trips');
      const trips = raw ? JSON.parse(raw) : [];
      const albums = [];

      trips.forEach(trip => {
        if (trip.photos && trip.photos.length > 0) {
          albums.push({
            id: trip.id,
            location: trip.location,
            date: trip.date,
            time: trip.time,
            photos: trip.photos,
            note: trip.notes || '',
            checked: trip.checked,
            important: trip.isImportant || false,
            color: trip.colorId || trip.color || 'green'
          });
        }
      });

      // 按日期分组
      const grouped = {};
      albums.forEach(a => {
        const key = a.date || '未知日期';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(a);
      });

      // 按日期降序排序 → 转为数组（wx:for 遍历对象不稳定）
      const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
      const groupedByDate = sortedKeys.map(key => ({ date: key, items: grouped[key] }));

      this.setData({
        albums,
        groupedByDate,
        totalPhotos: albums.reduce((sum, a) => sum + a.photos.length, 0),
        totalTrips: albums.length
      });
    } catch (e) {
      wx.showToast({ title: '加载相册失败', icon: 'none' });
    }
  },

  // 安全解析 dataset 中的 urls（WXML data- 会把数组序列化为 JSON 字符串）
  _parseUrls(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw); } catch { return []; }
  },

  // 预览单张大图
  previewImage(e) {
    const { url, urls } = e.currentTarget.dataset;
    const urlsArr = this._parseUrls(urls);
    wx.previewImage({
      current: url,
      urls: urlsArr.length > 0 ? urlsArr : [url]
    });
  },

  // 预览该行程所有照片
  previewAlbum(e) {
    const { urls, current } = e.currentTarget.dataset;
    const urlsArr = this._parseUrls(urls);
    wx.previewImage({
      current: current || (urlsArr[0] || ''),
      urls: urlsArr
    });
  },

  // 切换视图模式
  toggleView() {
    this.setData({
      viewMode: this.data.viewMode === 'grid' ? 'list' : 'grid'
    });
  },

  // 删除照片
  deletePhoto(e) {
    const { tripid, photoidx } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除照片',
      content: '确定要删除这张照片吗？',
      success: (res) => {
        if (res.confirm) {
          const raw = wx.getStorageSync('travel_trips');
          const trips = raw ? JSON.parse(raw) : [];
          const trip = trips.find(t => t.id === tripid);
          if (trip && trip.photos) {
            trip.photos.splice(photoidx, 1);
            wx.setStorageSync('travel_trips', JSON.stringify(trips));
            wx.showToast({ title: '已删除', icon: 'success' });
            this.loadAlbums();
          }
        }
      }
    });
  }
});
